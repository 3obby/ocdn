import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import { schnorr } from "@noble/curves/secp256k1.js";
import { prisma } from "./db";
import { getRpc } from "./bitcoin/rpc";
import { NETWORK, addUtxo } from "./bitcoin/wallet";
import {
  loadPortalKey,
  reserveUtxo,
  releaseUtxo,
  markUtxoSpent,
} from "./bitcoin/wallet";
import { createPostEnvelope, createReplyEnvelope } from "./protocol/create";
import { createBurnPayload } from "./protocol/create";
import { buildCommitRevealTxs, broadcastCommitReveal, buildBurnTx, broadcastTx } from "./bitcoin/tx";
import { log } from "./api-utils";

bitcoin.initEccLib(ecc);

/**
 * Check pending payment requests against the UTXO set (confirmed) and mempool.
 * Returns the number of payments detected and settled.
 */
export async function checkAndSettlePayments(): Promise<number> {
  const pending = await prisma.paymentRequest.findMany({
    where: {
      status: "pending",
      expiresAt: { gt: new Date() },
    },
  });

  if (pending.length === 0) return 0;

  const rpc = getRpc();
  let settled = 0;

  // Batch check via scantxoutset for confirmed UTXOs
  const descriptors = pending.map((p) => ({ desc: `addr(${p.paymentAddress})`, range: 0 }));
  try {
    const scanResult = await rpc.call<{
      success: boolean;
      unspents: Array<{
        txid: string;
        vout: number;
        scriptPubKey: string;
        amount: number;
        height: number;
        desc: string;
      }>;
    }>("scantxoutset", ["start", descriptors]);

    if (scanResult.success && scanResult.unspents.length > 0) {
      const addressToUtxo = new Map<string, { txid: string; vout: number; amount: number }>();

      for (const u of scanResult.unspents) {
        // Parse address from descriptor in result
        const addrMatch = u.desc.match(/addr\(([^)]+)\)/);
        if (addrMatch) {
          const existing = addressToUtxo.get(addrMatch[1]);
          const amountSats = Math.round(u.amount * 1e8);
          if (!existing || amountSats > existing.amount) {
            addressToUtxo.set(addrMatch[1], { txid: u.txid, vout: u.vout, amount: amountSats });
          }
        }
      }

      for (const payment of pending) {
        const utxo = addressToUtxo.get(payment.paymentAddress);
        if (utxo && utxo.amount >= payment.amountSats) {
          try {
            await settlePayment(payment.id, utxo.txid, utxo.vout, utxo.amount);
            settled++;
          } catch (err) {
            log("error", "payment-settler", `Failed to settle payment ${payment.id}`, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }
  } catch (err) {
    log("error", "payment-settler", "scantxoutset failed, trying mempool", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Also check mempool for 0-conf payments (for payments not found in UTXO set)
  const stillPending = await prisma.paymentRequest.findMany({
    where: { id: { in: pending.map((p) => p.id) }, status: "pending" },
  });

  if (stillPending.length > 0) {
    settled += await checkMempoolForPayments(stillPending);
  }

  // Expire old payment requests
  await prisma.paymentRequest.updateMany({
    where: {
      status: "pending",
      expiresAt: { lt: new Date() },
    },
    data: { status: "expired" },
  });

  return settled;
}

const _seenMempoolTxids = new Set<string>();

async function checkMempoolForPayments(
  payments: Array<{ id: string; paymentAddress: string; amountSats: number }>,
): Promise<number> {
  const rpc = getRpc();
  let settled = 0;

  try {
    const mempoolTxids: string[] = await rpc.call("getrawmempool", [false]);
    const newTxids = mempoolTxids.filter((t) => !_seenMempoolTxids.has(t));

    // Only check a bounded number of new txids per cycle
    const toCheck = newTxids.slice(0, 200);

    const addressMap = new Map(payments.map((p) => [p.paymentAddress, p]));

    for (const txid of toCheck) {
      _seenMempoolTxids.add(txid);
      try {
        const tx = await rpc.getRawTransaction(txid, true);
        for (const vout of tx.vout) {
          if (vout.scriptPubKey.address && addressMap.has(vout.scriptPubKey.address)) {
            const payment = addressMap.get(vout.scriptPubKey.address)!;
            const amountSats = Math.round(vout.value * 1e8);
            if (amountSats >= payment.amountSats) {
              try {
                await settlePayment(payment.id, txid, vout.n, amountSats);
                settled++;
                addressMap.delete(payment.paymentAddress);
              } catch (err) {
                log("error", "payment-settler", `Mempool settle failed ${payment.id}`, {
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }
          }
        }
      } catch {
        // tx may have been mined between getrawmempool and getrawtransaction
      }
    }

    // Cap the seen set to avoid unbounded growth
    if (_seenMempoolTxids.size > 100_000) {
      const arr = [..._seenMempoolTxids];
      _seenMempoolTxids.clear();
      for (const t of arr.slice(-50_000)) _seenMempoolTxids.add(t);
    }
  } catch (err) {
    log("warn", "payment-settler", "mempool check failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return settled;
}

/**
 * Settle a single payment: mark detected, broadcast the action, mark confirmed.
 */
async function settlePayment(
  paymentId: string,
  paidTxid: string,
  paidVout: number,
  paidAmountSats: number,
): Promise<void> {
  const payment = await prisma.paymentRequest.update({
    where: { id: paymentId, status: "pending" },
    data: { status: "detected", paidTxid, paidVout },
  });

  log("info", "payment-settler", "payment detected", {
    id: paymentId,
    paidTxid,
    paidAmountSats,
  });

  // Add the payment UTXO to the portal pool (available after 1 conf)
  const privkey = Buffer.from(payment.paymentKeyHex, "hex");
  const xPub = Buffer.from(schnorr.getPublicKey(privkey));
  const p2tr = bitcoin.payments.p2tr({ internalPubkey: xPub, network: NETWORK });
  const scriptPubkey = Buffer.from(p2tr.output!);

  await addUtxo(paidTxid, paidVout, BigInt(paidAmountSats), scriptPubkey);

  // Now broadcast the user's action
  await prisma.paymentRequest.update({
    where: { id: paymentId },
    data: { status: "broadcasting" },
  });

  const payload = payment.actionPayload as Record<string, unknown>;
  const portal = loadPortalKey();
  const rpc = getRpc();
  const feeEst = await rpc.estimateSmartFee(6);
  const feeRate = feeEst.feerate ? Math.ceil((feeEst.feerate * 1e8) / 1000) : 2;

  let contentHashHex: string | undefined;
  let utxoId: number | null = null;

  try {
    if (payment.actionType === "post" || payment.actionType === "reply") {
      const content = payload.content as string;

      const envelopeResult =
        payment.actionType === "post"
          ? createPostEnvelope(
              new Uint8Array(portal.privkey),
              content,
              (payload.topic as string) ?? "",
            )
          : createReplyEnvelope(
              new Uint8Array(portal.privkey),
              content,
              Buffer.from(payload.parentHash as string, "hex"),
            );

      contentHashHex = Buffer.from(envelopeResult.contentHash).toString("hex");

      const utxo = await reserveUtxo(BigInt(10_000));
      utxoId = utxo.id;

      const txResult = buildCommitRevealTxs(
        portal.privkey,
        envelopeResult.envelope,
        { txid: utxo.txid, vout: utxo.vout, amount: utxo.amount, scriptPubkey: utxo.scriptPubkey },
        feeRate,
      );

      const { commitTxid, revealTxid } = await broadcastCommitReveal(
        txResult.commitHex,
        txResult.revealHex,
      );

      await markUtxoSpent(utxo.id, commitTxid);
      utxoId = null;

      await prisma.pendingTx.create({
        data: {
          commitTxid,
          revealTxid,
          txType: payment.actionType,
          payload: { contentHash: contentHashHex, ...(payload.topic ? { topic: payload.topic } : {}), ...(payload.parentHash ? { parentHash: payload.parentHash } : {}) },
          status: "revealed",
          feeRate,
          attempts: 1,
        },
      });

      log("info", "payment-settler", "action broadcast", {
        paymentId,
        actionType: payment.actionType,
        contentHash: contentHashHex,
        commitTxid,
        revealTxid,
      });
    } else if (payment.actionType === "burn") {
      const targetHash = payload.targetHash as string;
      const burnAmount = Number(payload.burnAmount);

      const burnPayload = createBurnPayload(Buffer.from(targetHash, "hex"));

      const utxo = await reserveUtxo(BigInt(burnAmount + 1000));
      utxoId = utxo.id;

      const txResult = buildBurnTx(
        portal.privkey,
        burnPayload,
        { txid: utxo.txid, vout: utxo.vout, amount: utxo.amount, scriptPubkey: utxo.scriptPubkey },
        feeRate,
        BigInt(burnAmount),
      );

      const txid = await broadcastTx(txResult.hex);
      await markUtxoSpent(utxo.id, txid);
      utxoId = null;

      await prisma.pendingTx.create({
        data: {
          commitTxid: txid,
          txType: "burn",
          payload: { targetHash, amount: burnAmount },
          status: "revealed",
          feeRate,
          attempts: 1,
        },
      });

      log("info", "payment-settler", "burn broadcast", { paymentId, txid, targetHash });
    }

    await prisma.paymentRequest.update({
      where: { id: paymentId },
      data: { status: "confirmed", contentHash: contentHashHex },
    });

    // Update linked ephemeral post if any
    await prisma.ephemeralPost.updateMany({
      where: { paymentId },
      data: { status: "upgraded" },
    });
  } catch (err) {
    if (utxoId !== null) {
      try {
        await releaseUtxo(utxoId);
      } catch { /* best effort */ }
    }

    await prisma.paymentRequest.update({
      where: { id: paymentId },
      data: { status: "failed" },
    });

    throw err;
  }
}
