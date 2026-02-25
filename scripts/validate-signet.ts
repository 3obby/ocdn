import "dotenv/config";
import ws from "ws";
import { neonConfig } from "@neondatabase/serverless";

neonConfig.webSocketConstructor = ws;

async function main() {
  // Dynamic imports ensure neonConfig.webSocketConstructor is set
  // before any module triggers db.ts → PrismaNeon creation
  const walletMod = await import("../src/lib/bitcoin/wallet.js");
  const txMod = await import("../src/lib/bitcoin/tx.js");
  const protocolCreate = await import("../src/lib/protocol/create.js");
  const rpcMod = await import("../src/lib/bitcoin/rpc.js");
  const { PrismaNeon } = await import("@prisma/adapter-neon");
  const { PrismaClient } = await import(
    "../src/generated/prisma/client.js"
  );

  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL!,
  });
  const db = new PrismaClient({ adapter }) as any;
  const rpc = rpcMod.getRpc();

  const step = process.argv[2] ?? "all";
  const results: { name: string; ok: boolean; detail: string }[] = [];

  function log(msg: string) {
    console.log(`  ${msg}`);
  }
  function pass(name: string, detail: string) {
    results.push({ name, ok: true, detail });
    console.log(`  \x1b[32mPASS\x1b[0m ${name}: ${detail}`);
  }
  function fail(name: string, detail: string) {
    results.push({ name, ok: false, detail });
    console.log(`  \x1b[31mFAIL\x1b[0m ${name}: ${detail}`);
  }

  // ═══════════════════════════════════════════════════
  // STEP 1: SETUP — check prerequisites
  // ═══════════════════════════════════════════════════
  if (step === "all" || step === "setup") {
    console.log("\n═══ SETUP ═══\n");

    // Check portal key
    try {
      const portal = walletMod.loadPortalKey();
      pass("portal-key", `address: ${portal.p2trAddress}`);
    } catch (e: any) {
      fail("portal-key", e.message);
      console.log(
        "\n  Set PORTAL_PRIVKEY in .env. Generate with:\n  node --input-type=module -e \"import{schnorr}from'@noble/curves/secp256k1.js';console.log(Buffer.from(schnorr.utils.randomSecretKey()).toString('hex'))\"\n",
      );
      await db.$disconnect();
      return;
    }

    // Check RPC
    try {
      const height = await rpc.getBlockCount();
      const hash = await rpc.getBestBlockHash();
      pass("rpc", `signet tip: ${height} (${hash.slice(0, 16)}…)`);
    } catch (e: any) {
      fail("rpc", e.message);
      console.log(
        "\n  Bitcoin Core RPC not reachable. Either:\n  1. Run this script on the VPS\n  2. SSH tunnel: ssh -L 38332:127.0.0.1:38332 -i ~/.ssh/id_ed25519_ocdn ocdn@185.165.169.8\n",
      );
      await db.$disconnect();
      return;
    }

    // Check indexer state
    const state = await db.indexerState.findFirst();
    if (state) {
      pass(
        "indexer",
        `chain tip: ${state.chainTipHeight}, updated: ${state.updatedAt.toISOString()}`,
      );
    } else {
      fail("indexer", "no indexer state found — is the indexer running?");
    }

    // Check DB post count
    const postCount = await db.post.count();
    log(`posts in DB: ${postCount}`);
  }

  // ═══════════════════════════════════════════════════
  // STEP 2: SCAN — find portal UTXOs on-chain, import
  // ═══════════════════════════════════════════════════
  if (step === "all" || step === "scan") {
    console.log("\n═══ SCAN UTXOs ═══\n");

    const portal = walletMod.loadPortalKey();
    log(`scanning for UTXOs at ${portal.p2trAddress}…`);

    // Use listunspent if available, otherwise scan with importaddress
    try {
      // Try scantxoutset for non-wallet nodes
      const scanResult = await rpc.call("scantxoutset", [
        "start",
        [`addr(${portal.p2trAddress})`],
      ]);

      if (scanResult.unspents && scanResult.unspents.length > 0) {
        let imported = 0;
        for (const u of scanResult.unspents) {
          const amountSats = BigInt(Math.round(u.amount * 1e8));
          await walletMod.addUtxo(
            u.txid,
            u.vout,
            amountSats,
            Buffer.from(u.scriptPubKey, "hex"),
          );
          imported++;
          log(`  ${u.txid}:${u.vout} — ${amountSats} sats`);
        }
        pass(
          "scan",
          `found ${scanResult.unspents.length} UTXOs, ${imported} imported`,
        );
      } else {
        fail(
          "scan",
          `no UTXOs found at ${portal.p2trAddress}`,
        );
        console.log(
          `\n  Fund the portal address on signet:\n  https://signet.bc-2.jp/  →  ${portal.p2trAddress}\n  Then re-run: npx tsx scripts/validate-signet.ts scan\n`,
        );
      }
    } catch (e: any) {
      fail("scan", `scantxoutset failed: ${e.message}`);
      console.log(
        "  Trying listunspent fallback (requires wallet with address imported)…",
      );
    }

    // Show pool state
    const pool = await walletMod.getAvailableUtxos();
    log(`UTXO pool: ${pool.length} available`);
    for (const u of pool) {
      log(`  ${u.txid}:${u.vout} — ${u.amount} sats`);
    }
  }

  // ═══════════════════════════════════════════════════
  // STEP 3: FAN-OUT — split UTXOs for parallel tests
  // ═══════════════════════════════════════════════════
  if (step === "all" || step === "fanout") {
    console.log("\n═══ FAN-OUT ═══\n");

    const portal = walletMod.loadPortalKey();
    const pool = await walletMod.getAvailableUtxos();

    if (pool.length === 0) {
      fail("fanout", "no UTXOs available — run scan first");
    } else if (pool.length >= 5) {
      log(`already have ${pool.length} UTXOs, skipping fan-out`);
      pass("fanout", `${pool.length} UTXOs ready`);
    } else {
      // Fan out the largest UTXO into 6 pieces
      const largest = pool[0];
      log(
        `splitting ${largest.txid}:${largest.vout} (${largest.amount} sats) into 6 UTXOs…`,
      );

      try {
        const targetAmount = 20_000n;
        const result = txMod.buildFanOutTx(
          portal.privkey,
          {
            txid: largest.txid,
            vout: largest.vout,
            amount: largest.amount,
            scriptPubkey: largest.scriptPubkey,
          },
          6,
          targetAmount,
          2,
        );

        const txid = await txMod.broadcastTx(result.hex);
        log(`broadcast: ${txid}`);

        // Mark old UTXO as spent
        await walletMod.markUtxoSpent(largest.id, txid);

        // Add new UTXOs to pool
        for (const out of result.outputs) {
          await walletMod.addUtxo(
            txid,
            out.vout,
            out.amount,
            portal.p2trOutput,
          );
        }

        pass("fanout", `${result.outputs.length} UTXOs created, txid: ${txid}`);
      } catch (e: any) {
        fail("fanout", e.message);
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // STEP 4: POST — construct + broadcast
  // ═══════════════════════════════════════════════════

  let postContentHash: string | null = null;

  if (step === "all" || step === "post") {
    console.log("\n═══ POST ═══\n");

    const portal = walletMod.loadPortalKey();
    const pool = await walletMod.getAvailableUtxos();

    if (pool.length === 0) {
      fail("post", "no UTXOs — run scan/fanout first");
    } else {
      try {
        const utxo = await walletMod.reserveUtxo(10_000n);
        const { envelope, contentHash } = protocolCreate.createPostEnvelope(
          new Uint8Array(portal.privkey),
          "hello signet — ocdn validation test",
          "signet-test",
        );
        const contentHashHex = Buffer.from(contentHash).toString("hex");

        log(`content hash: ${contentHashHex}`);
        log(`topic: signet-test`);

        const feeEst = await rpc.estimateSmartFee(6);
        const feeRate = feeEst.feerate
          ? Math.ceil((feeEst.feerate * 1e8) / 1000)
          : 2;
        log(`fee rate: ${feeRate} sat/vB`);

        const result = txMod.buildCommitRevealTxs(
          portal.privkey,
          envelope,
          {
            txid: utxo.txid,
            vout: utxo.vout,
            amount: utxo.amount,
            scriptPubkey: utxo.scriptPubkey,
          },
          feeRate,
        );

        log(`commit: ${result.commitTxid} (${result.commitVsize} vB)`);
        log(`reveal: ${result.revealTxid} (${result.revealVsize} vB)`);
        log(`total fee: ${result.totalFee} sats`);

        const { commitTxid, revealTxid } =
          await txMod.broadcastCommitReveal(
            result.commitHex,
            result.revealHex,
          );

        await walletMod.markUtxoSpent(utxo.id, commitTxid);

        // Add change UTXO back to pool if it exists
        if (result.changeAmount >= BigInt(walletMod.DUST_LIMIT)) {
          await walletMod.addUtxo(
            commitTxid,
            1,
            result.changeAmount,
            portal.p2trOutput,
          );
        }
        // Add reveal output (postage) back to pool
        await walletMod.addUtxo(
          revealTxid,
          0,
          result.commitOutputValue -
            (result.commitOutputValue - 546n),
          portal.p2trOutput,
        );

        postContentHash = contentHashHex;

        await db.pendingTx.create({
          data: {
            commitTxid,
            revealTxid,
            txType: "post",
            payload: { contentHash: contentHashHex, topic: "signet-test" },
            status: "revealed",
            feeRate,
            attempts: 1,
          },
        });

        pass(
          "post-broadcast",
          `commit: ${commitTxid}, reveal: ${revealTxid}`,
        );
      } catch (e: any) {
        fail("post-broadcast", e.message);
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // STEP 5: REPLY — construct + broadcast
  // ═══════════════════════════════════════════════════
  if (step === "all" || step === "reply") {
    console.log("\n═══ REPLY ═══\n");

    // Use postContentHash from step 4, or find most recent test post
    let parentHash = postContentHash;
    if (!parentHash) {
      const recent = await db.post.findFirst({
        where: { topic: "signet-test" },
        orderBy: { blockHeight: "desc" },
      });
      if (recent) parentHash = recent.contentHash;
    }

    if (!parentHash) {
      fail("reply", "no parent post found — run post step first");
    } else {
      const portal = walletMod.loadPortalKey();
      try {
        const utxo = await walletMod.reserveUtxo(10_000n);
        const parentHashBytes = new Uint8Array(
          Buffer.from(parentHash, "hex"),
        );
        const { envelope, contentHash } =
          protocolCreate.createReplyEnvelope(
            new Uint8Array(portal.privkey),
            "reply to signet test post",
            parentHashBytes,
          );
        const contentHashHex = Buffer.from(contentHash).toString("hex");

        log(`reply content hash: ${contentHashHex}`);
        log(`parent hash: ${parentHash}`);

        const feeRate = 2;
        const result = txMod.buildCommitRevealTxs(
          portal.privkey,
          envelope,
          {
            txid: utxo.txid,
            vout: utxo.vout,
            amount: utxo.amount,
            scriptPubkey: utxo.scriptPubkey,
          },
          feeRate,
        );

        const { commitTxid, revealTxid } =
          await txMod.broadcastCommitReveal(
            result.commitHex,
            result.revealHex,
          );

        await walletMod.markUtxoSpent(utxo.id, commitTxid);
        if (result.changeAmount >= BigInt(walletMod.DUST_LIMIT)) {
          await walletMod.addUtxo(
            commitTxid,
            1,
            result.changeAmount,
            portal.p2trOutput,
          );
        }

        await db.pendingTx.create({
          data: {
            commitTxid,
            revealTxid,
            txType: "reply",
            payload: { contentHash: contentHashHex, parentHash },
            status: "revealed",
            feeRate,
            attempts: 1,
          },
        });

        pass(
          "reply-broadcast",
          `commit: ${commitTxid}, reveal: ${revealTxid}`,
        );
      } catch (e: any) {
        fail("reply-broadcast", e.message);
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // STEP 6: BURN — construct + broadcast
  // ═══════════════════════════════════════════════════
  if (step === "all" || step === "burn") {
    console.log("\n═══ BURN ═══\n");

    let targetHash = postContentHash;
    if (!targetHash) {
      const recent = await db.post.findFirst({
        where: { topic: "signet-test" },
        orderBy: { blockHeight: "desc" },
      });
      if (recent) targetHash = recent.contentHash;
    }

    if (!targetHash) {
      fail("burn", "no target post found — run post step first");
    } else {
      const portal = walletMod.loadPortalKey();
      try {
        const utxo = await walletMod.reserveUtxo(5_000n);
        const targetHashBytes = new Uint8Array(
          Buffer.from(targetHash, "hex"),
        );
        const payload = protocolCreate.createBurnPayload(targetHashBytes);

        log(`burn target: ${targetHash}`);

        const feeRate = 2;
        const result = txMod.buildBurnTx(
          portal.privkey,
          payload,
          {
            txid: utxo.txid,
            vout: utxo.vout,
            amount: utxo.amount,
            scriptPubkey: utxo.scriptPubkey,
          },
          feeRate,
          1_000n,
        );

        const txid = await txMod.broadcastTx(result.hex);
        await walletMod.markUtxoSpent(utxo.id, txid);

        if (result.changeAmount > 0n) {
          await walletMod.addUtxo(
            txid,
            1,
            result.changeAmount,
            portal.p2trOutput,
          );
        }

        pass(
          "burn-broadcast",
          `txid: ${txid}, fee(burn): ${result.fee} sats`,
        );
      } catch (e: any) {
        fail("burn-broadcast", e.message);
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // STEP 7: SIGNAL — construct + broadcast
  // ═══════════════════════════════════════════════════
  if (step === "all" || step === "signal") {
    console.log("\n═══ SIGNAL ═══\n");

    let refHash = postContentHash;
    if (!refHash) {
      const recent = await db.post.findFirst({
        where: { topic: "signet-test" },
        orderBy: { blockHeight: "desc" },
      });
      if (recent) refHash = recent.contentHash;
    }

    if (!refHash) {
      fail("signal", "no ref post found — run post step first");
    } else {
      const portal = walletMod.loadPortalKey();
      try {
        const utxo = await walletMod.reserveUtxo(5_000n);
        const payload = protocolCreate.createSignalPayload([
          {
            kind: "content" as const,
            value: refHash,
            hashPrefix: new Uint8Array(
              Buffer.from(refHash.slice(0, 16), "hex"),
            ),
          },
        ]);

        log(`signal ref: ${refHash}`);

        const feeRate = 2;
        const result = txMod.buildSignalTx(
          portal.privkey,
          payload,
          {
            txid: utxo.txid,
            vout: utxo.vout,
            amount: utxo.amount,
            scriptPubkey: utxo.scriptPubkey,
          },
          feeRate,
        );

        const txid = await txMod.broadcastTx(result.hex);
        await walletMod.markUtxoSpent(utxo.id, txid);

        if (result.changeAmount > 0n) {
          await walletMod.addUtxo(
            txid,
            1,
            result.changeAmount,
            portal.p2trOutput,
          );
        }

        pass(
          "signal-broadcast",
          `txid: ${txid}, fee: ${result.fee} sats`,
        );
      } catch (e: any) {
        fail("signal-broadcast", e.message);
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // STEP 8: WAIT — poll for block confirmation
  // ═══════════════════════════════════════════════════
  if (step === "all" || step === "wait") {
    console.log("\n═══ WAITING FOR BLOCK ═══\n");

    const startHeight = await rpc.getBlockCount();
    log(`current tip: ${startHeight}`);
    log("waiting for next block (signet ~10 min)…");

    const maxWait = 15 * 60 * 1000;
    const pollInterval = 15_000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      await new Promise((r) => setTimeout(r, pollInterval));
      const currentHeight = await rpc.getBlockCount();
      if (currentHeight > startHeight) {
        pass(
          "block-confirmed",
          `new block at height ${currentHeight}`,
        );
        break;
      }
      const elapsed = Math.round((Date.now() - start) / 1000);
      log(`${elapsed}s — still at ${currentHeight}…`);
    }

    if (results.every((r) => r.name !== "block-confirmed")) {
      fail(
        "block-confirmed",
        `no new block after ${maxWait / 1000}s — try again later`,
      );
    }
  }

  // ═══════════════════════════════════════════════════
  // STEP 9: VERIFY — check indexer processed everything
  // ═══════════════════════════════════════════════════
  if (step === "all" || step === "verify") {
    console.log("\n═══ VERIFY ═══\n");

    // Give indexer time to process
    if (step === "all") {
      log("waiting 15s for indexer to process…");
      await new Promise((r) => setTimeout(r, 15_000));
    }

    // Check for signet-test posts
    const testPosts = await db.post.findMany({
      where: { topic: "signet-test" },
      orderBy: { blockHeight: "desc" },
    });

    if (testPosts.length > 0) {
      pass("verify-post", `found ${testPosts.length} test post(s)`);
      for (const p of testPosts) {
        log(
          `  ${p.contentHash.slice(0, 16)}… — "${p.content.slice(0, 40)}" (block ${p.blockHeight})`,
        );
      }
    } else {
      fail(
        "verify-post",
        "no test posts found — indexer may not have processed the block yet",
      );
    }

    // Check threading (reply has parentHash)
    const replies = testPosts.filter(
      (p: any) => p.parentHash !== null,
    );
    if (replies.length > 0) {
      pass("verify-reply", `found ${replies.length} reply(ies) with threading`);
    } else if (testPosts.length > 0) {
      fail(
        "verify-reply",
        "no replies found — reply may be in a later block",
      );
    }

    // Check burns
    const burnCount = await db.burn.count();
    if (burnCount > 0) {
      pass("verify-burn", `found ${burnCount} burn(s)`);

      if (testPosts.length > 0) {
        const testBurns = await db.burn.findMany({
          where: { targetHash: testPosts[0].contentHash },
        });
        if (testBurns.length > 0) {
          const totalBurned = testBurns.reduce(
            (sum: bigint, b: any) => sum + b.amount,
            0n,
          );
          log(
            `  burns on test post: ${testBurns.length}, total: ${totalBurned} sats`,
          );
        }
      }
    } else {
      fail("verify-burn", "no burns found");
    }

    // Check signals
    const signalCount = await db.signal.count();
    if (signalCount > 0) {
      pass("verify-signal", `found ${signalCount} signal(s)`);
    } else {
      fail("verify-signal", "no signals found");
    }

    // Check topic aggregates
    const testTopic = await db.topicAggregate.findFirst({
      where: { topicName: "signet-test" },
    });
    if (testTopic) {
      pass(
        "verify-topic",
        `topic "signet-test" — ${testTopic.postCount} posts, ${testTopic.totalBurned} sats burned`,
      );
    } else {
      fail("verify-topic", 'topic "signet-test" not found in aggregates');
    }

    // Check author aggregates
    const portal = walletMod.loadPortalKey();
    const pubkeyHex = portal.xOnlyPubkey.toString("hex");
    const author = await db.authorAggregate.findUnique({
      where: { pubkey: pubkeyHex },
    });
    if (author) {
      pass(
        "verify-author",
        `portal author: ${author.postCount} posts, burns received: ${author.totalBurnsReceived}`,
      );
    } else {
      fail("verify-author", "portal author aggregate not found");
    }
  }

  // ═══════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════
  console.log("\n═══ SUMMARY ═══\n");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    `  ${passed} passed, ${failed} failed, ${results.length} total\n`,
  );

  if (failed > 0) {
    console.log("  Failed tests:");
    for (const r of results.filter((r) => !r.ok)) {
      console.log(`    - ${r.name}: ${r.detail}`);
    }
    console.log();
  }

  // Show UTXO pool state
  const pool = await walletMod.getAvailableUtxos();
  console.log(`  UTXO pool: ${pool.length} available\n`);

  await db.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
