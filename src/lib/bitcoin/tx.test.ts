import { describe, it } from "node:test";
import assert from "node:assert/strict";

import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import { schnorr } from "@noble/curves/secp256k1.js";

bitcoin.initEccLib(ecc);

import {
  createPostEnvelope,
  createReplyEnvelope,
  createBurnPayload,
  createSignalPayload,
  createTopicBurnPayload,
  generateKeyPair,
  serializeBurnOpReturn,
  serializeSignalOpReturn,
  PROTOCOL_TAG_BYTES,
  PROTOCOL_VERSION,
  TYPE_POST,
  TYPE_REPLY,
  TYPE_BURN,
  TYPE_SIGNAL,
} from "../protocol";

import type { SignalRef } from "../protocol";

import {
  buildEnvelopeScript,
  buildCommitRevealTxs,
  buildKeyPathRecoveryTx,
  buildBurnTx,
  buildSignalTx,
  buildFanOutTx,
  buildConsolidationTx,
  buildRbfBump,
  estimateKeyPathTxVsize,
  estimateRevealVsize,
  estimateCommitRevealCost,
  estimateBurnCost,
  estimateSignalCost,
} from "./tx";

import {
  NETWORK,
  DUST_LIMIT,
  RBF_SEQUENCE,
  createKeyPathSigner,
  createScriptPathSigner,
} from "./wallet";

import type { UtxoInput } from "./tx";

// ═══ HELPERS ═══

function makePortalKey(): { privkey: Buffer; xOnlyPubkey: Buffer } {
  const privkey = Buffer.from(schnorr.utils.randomSecretKey());
  const xOnlyPubkey = Buffer.from(schnorr.getPublicKey(privkey));
  return { privkey, xOnlyPubkey };
}

function makeUtxo(
  privkey: Buffer,
  amount: bigint = 100_000n,
  txid: string = "a".repeat(64),
): UtxoInput {
  const xOnlyPubkey = Buffer.from(schnorr.getPublicKey(privkey));
  const p2tr = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: NETWORK,
  });
  return {
    txid,
    vout: 0,
    amount,
    scriptPubkey: Buffer.from(p2tr.output!),
  };
}

// ═══ ENVELOPE SCRIPT ═══

describe("buildEnvelopeScript", () => {
  it("produces valid script with OP_CHECKSIG envelope pattern", () => {
    const { xOnlyPubkey } = makePortalKey();
    const pushes = [
      PROTOCOL_TAG_BYTES,
      new Uint8Array([PROTOCOL_VERSION]),
      new Uint8Array([TYPE_POST]),
      new Uint8Array(8), // nonce
      new Uint8Array(32), // pubkey
      new Uint8Array(64), // sig
      new Uint8Array(0), // empty topic
      new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]), // "Hello"
    ];

    const script = buildEnvelopeScript(xOnlyPubkey, pushes);
    assert.ok(script.length > 0);

    const decompiled = bitcoin.script.decompile(script);
    assert.ok(decompiled);

    assert.deepEqual(decompiled![0], xOnlyPubkey);
    assert.equal(decompiled![1], bitcoin.opcodes.OP_CHECKSIG);
    assert.equal(decompiled![2], bitcoin.opcodes.OP_0); // OP_FALSE
    assert.equal(decompiled![3], bitcoin.opcodes.OP_IF);
    assert.equal(decompiled![decompiled!.length - 1], bitcoin.opcodes.OP_ENDIF);
  });

  it("handles long content with multiple pushes", () => {
    const { xOnlyPubkey } = makePortalKey();
    const pushes = [
      PROTOCOL_TAG_BYTES,
      new Uint8Array([PROTOCOL_VERSION]),
      new Uint8Array([TYPE_POST]),
      new Uint8Array(8),
      new Uint8Array(32),
      new Uint8Array(64),
      new Uint8Array(0),
      new Uint8Array(520).fill(0x41),
      new Uint8Array(520).fill(0x42),
    ];

    const script = buildEnvelopeScript(xOnlyPubkey, pushes);
    assert.ok(script.length > 1040);
  });
});

// ═══ SIGNER UTILITIES ═══

describe("createKeyPathSigner", () => {
  it("produces valid Schnorr signature", () => {
    const { privkey } = makePortalKey();
    const signer = createKeyPathSigner(privkey);
    const hash = Buffer.alloc(32, 0xab);
    const sig = signer.signSchnorr(hash);
    assert.equal(sig.length, 64);
  });

  it("tweaked pubkey differs from internal key", () => {
    const { privkey, xOnlyPubkey } = makePortalKey();
    const signer = createKeyPathSigner(privkey);
    const signerXOnly = Buffer.from(signer.publicKey).subarray(1, 33);
    assert.ok(!signerXOnly.equals(xOnlyPubkey));
  });

  it("with merkleRoot produces different tweak", () => {
    const { privkey } = makePortalKey();
    const s1 = createKeyPathSigner(privkey);
    const merkleRoot = Buffer.alloc(32, 0xff);
    const s2 = createKeyPathSigner(privkey, merkleRoot);
    assert.ok(!Buffer.from(s1.publicKey).equals(Buffer.from(s2.publicKey)));
  });
});

describe("createScriptPathSigner", () => {
  it("produces valid Schnorr signature with untweaked key", () => {
    const { privkey, xOnlyPubkey } = makePortalKey();
    const signer = createScriptPathSigner(privkey);
    const signerXOnly = Buffer.from(signer.publicKey).subarray(1, 33);
    assert.ok(signerXOnly.equals(xOnlyPubkey));
  });
});

// ═══ COMMIT / REVEAL TRANSACTIONS ═══

describe("buildCommitRevealTxs", () => {
  it("builds valid commit/reveal for POST with topic", () => {
    const portal = makePortalKey();
    const author = generateKeyPair();
    const { envelope } = createPostEnvelope(
      author.privkey,
      "Hello, Bitcoin!",
      "bitcoin",
    );

    const utxo = makeUtxo(portal.privkey, 100_000n);
    const result = buildCommitRevealTxs(portal.privkey, envelope, utxo, 1);

    assert.ok(result.commitHex.length > 0);
    assert.ok(result.revealHex.length > 0);
    assert.equal(result.commitTxid.length, 64);
    assert.equal(result.revealTxid.length, 64);
    assert.ok(result.commitVsize > 0);
    assert.ok(result.revealVsize > 0);
    assert.ok(result.totalFee > 0n);
    assert.ok(result.commitOutputValue > 0n);

    // Verify commit tx structure
    const commitTx = bitcoin.Transaction.fromHex(result.commitHex);
    assert.equal(commitTx.ins.length, 1);
    assert.ok(commitTx.outs.length >= 1);
    assert.equal(commitTx.ins[0].sequence, RBF_SEQUENCE);

    // Verify reveal tx structure
    const revealTx = bitcoin.Transaction.fromHex(result.revealHex);
    assert.equal(revealTx.ins.length, 1);
    assert.equal(revealTx.outs.length, 1);
    assert.equal(revealTx.ins[0].sequence, RBF_SEQUENCE);

    // Reveal input references commit output 0
    const revealPrevHash = Buffer.from(revealTx.ins[0].hash).reverse().toString("hex");
    assert.equal(revealPrevHash, result.commitTxid);
    assert.equal(revealTx.ins[0].index, 0);
  });

  it("builds valid commit/reveal for standalone POST", () => {
    const portal = makePortalKey();
    const author = generateKeyPair();
    const { envelope } = createPostEnvelope(author.privkey, "Standalone post");

    const utxo = makeUtxo(portal.privkey, 50_000n);
    const result = buildCommitRevealTxs(portal.privkey, envelope, utxo, 1);

    assert.ok(result.commitHex.length > 0);
    assert.ok(result.revealHex.length > 0);
  });

  it("builds valid commit/reveal for REPLY", () => {
    const portal = makePortalKey();
    const author1 = generateKeyPair();
    const { contentHash: parentHash } = createPostEnvelope(
      author1.privkey,
      "Parent",
      "bitcoin",
    );

    const author2 = generateKeyPair();
    const { envelope } = createReplyEnvelope(
      author2.privkey,
      "This is a reply",
      parentHash,
    );

    const utxo = makeUtxo(portal.privkey, 100_000n);
    const result = buildCommitRevealTxs(portal.privkey, envelope, utxo, 1);

    assert.ok(result.commitHex.length > 0);
    assert.ok(result.revealHex.length > 0);
  });

  it("handles long content (2KB)", () => {
    const portal = makePortalKey();
    const author = generateKeyPair();
    const longContent = "A".repeat(2000);
    const { envelope } = createPostEnvelope(
      author.privkey,
      longContent,
      "test",
    );

    const utxo = makeUtxo(portal.privkey, 500_000n);
    const result = buildCommitRevealTxs(portal.privkey, envelope, utxo, 1);

    assert.ok(result.revealVsize > 500);
    assert.ok(result.totalFee > 500n);
  });

  it("rejects insufficient UTXO", () => {
    const portal = makePortalKey();
    const author = generateKeyPair();
    const { envelope } = createPostEnvelope(
      author.privkey,
      "Hello",
      "test",
    );

    const utxo = makeUtxo(portal.privkey, 100n); // way too small
    assert.throws(() => {
      buildCommitRevealTxs(portal.privkey, envelope, utxo, 1);
    }, /Insufficient UTXO/);
  });

  it("all txs signal RBF (sequence < 0xfffffffe)", () => {
    const portal = makePortalKey();
    const author = generateKeyPair();
    const { envelope } = createPostEnvelope(author.privkey, "RBF test", "rbf");

    const utxo = makeUtxo(portal.privkey, 100_000n);
    const result = buildCommitRevealTxs(portal.privkey, envelope, utxo, 1);

    const commitTx = bitcoin.Transaction.fromHex(result.commitHex);
    const revealTx = bitcoin.Transaction.fromHex(result.revealHex);

    for (const inp of commitTx.ins) {
      assert.ok(inp.sequence < 0xfffffffe, "Commit input must signal RBF");
    }
    for (const inp of revealTx.ins) {
      assert.ok(inp.sequence < 0xfffffffe, "Reveal input must signal RBF");
    }
  });
});

// ═══ KEY-PATH RECOVERY ═══

describe("buildKeyPathRecoveryTx", () => {
  it("recovers funds from commit output via key-path", () => {
    const portal = makePortalKey();
    const author = generateKeyPair();
    const { envelope } = createPostEnvelope(
      author.privkey,
      "Recovery test",
      "test",
    );

    const utxo = makeUtxo(portal.privkey, 100_000n);
    const cr = buildCommitRevealTxs(portal.privkey, envelope, utxo, 1);

    // Now recover the commit output via key-path instead of script-path
    const commitTx = bitcoin.Transaction.fromHex(cr.commitHex);
    const commitOutputScript = commitTx.outs[0].script;

    const recovery = buildKeyPathRecoveryTx(
      portal.privkey,
      cr.commitTxid,
      0,
      cr.commitOutputValue,
      Buffer.from(commitOutputScript),
      cr.scriptTree,
      1,
    );

    assert.ok(recovery.hex.length > 0);
    assert.equal(recovery.txid.length, 64);
    assert.ok(recovery.fee > 0n);
    assert.ok(recovery.changeAmount > 0n);

    const recoveryTx = bitcoin.Transaction.fromHex(recovery.hex);
    assert.equal(recoveryTx.ins.length, 1);
    assert.equal(recoveryTx.outs.length, 1);
    assert.equal(recoveryTx.ins[0].sequence, RBF_SEQUENCE);
  });
});

// ═══ BURN TRANSACTION ═══

describe("buildBurnTx", () => {
  it("builds valid burn tx with OP_RETURN", () => {
    const portal = makePortalKey();
    const author = generateKeyPair();
    const { contentHash } = createPostEnvelope(
      author.privkey,
      "Target post",
      "bitcoin",
    );

    const payload = createBurnPayload(contentHash);
    const utxo = makeUtxo(portal.privkey, 50_000n);
    const result = buildBurnTx(portal.privkey, payload, utxo, 1, 10_000n);

    assert.ok(result.hex.length > 0);
    assert.ok(result.fee >= 10_000n);

    const tx = bitcoin.Transaction.fromHex(result.hex);
    assert.equal(tx.ins.length, 1);
    assert.ok(tx.outs.length >= 1);
    assert.equal(tx.ins[0].sequence, RBF_SEQUENCE);

    // Verify OP_RETURN output
    const opReturnOut = tx.outs.find((o) => o.script[0] === bitcoin.opcodes.OP_RETURN);
    assert.ok(opReturnOut, "Must have OP_RETURN output");
    assert.equal(opReturnOut!.value, 0n);

    // OP_RETURN contains ocdn prefix
    const opReturnData = bitcoin.script.decompile(opReturnOut!.script);
    assert.ok(opReturnData);
    const dataPayload = opReturnData![1] as Buffer;
    assert.equal(dataPayload[0], 0x6f); // 'o'
    assert.equal(dataPayload[1], 0x63); // 'c'
    assert.equal(dataPayload[2], 0x64); // 'd'
    assert.equal(dataPayload[3], 0x6e); // 'n'
    assert.equal(dataPayload[4], PROTOCOL_VERSION);
    assert.equal(dataPayload[5], TYPE_BURN);
  });

  it("burns with topic hash", () => {
    const portal = makePortalKey();
    const payload = createTopicBurnPayload("bitcoin");
    const utxo = makeUtxo(portal.privkey, 50_000n);
    const result = buildBurnTx(portal.privkey, payload, utxo, 1, 5_000n);

    assert.ok(result.hex.length > 0);
    assert.ok(result.fee >= 5_000n);
  });

  it("entire UTXO consumed when change would be dust", () => {
    const portal = makePortalKey();
    const payload = createBurnPayload(Buffer.alloc(32, 0xaa));
    const utxo = makeUtxo(portal.privkey, 2_000n);
    const result = buildBurnTx(portal.privkey, payload, utxo, 1, 1_800n);

    assert.equal(result.changeAmount, 0n);
    assert.equal(result.fee, 2_000n);
  });
});

// ═══ SIGNAL TRANSACTION ═══

describe("buildSignalTx", () => {
  it("builds valid signal tx with OP_RETURN", () => {
    const portal = makePortalKey();
    const refs: SignalRef[] = [
      { kind: "text", value: "McDonald's" },
      { kind: "text", value: "wage theft" },
    ];
    const payload = createSignalPayload(refs);
    const utxo = makeUtxo(portal.privkey, 50_000n);
    const result = buildSignalTx(portal.privkey, payload, utxo, 1);

    assert.ok(result.hex.length > 0);
    assert.ok(result.fee > 0n);
    assert.ok(result.changeAmount > 0n);

    const tx = bitcoin.Transaction.fromHex(result.hex);
    assert.equal(tx.ins.length, 1);
    assert.equal(tx.outs.length, 2); // OP_RETURN + change

    // OP_RETURN output
    const opReturnOut = tx.outs.find((o) => o.script[0] === bitcoin.opcodes.OP_RETURN);
    assert.ok(opReturnOut);
    assert.equal(opReturnOut!.value, 0n);

    const opReturnData = bitcoin.script.decompile(opReturnOut!.script);
    const dataPayload = opReturnData![1] as Buffer;
    assert.equal(dataPayload[5], TYPE_SIGNAL);
  });

  it("builds signal with mixed text and content refs", () => {
    const portal = makePortalKey();
    const refs: SignalRef[] = [
      { kind: "text", value: "Oracle" },
      { kind: "content", hashPrefix: new Uint8Array(8).fill(0xab) },
    ];
    const payload = createSignalPayload(refs);
    const utxo = makeUtxo(portal.privkey, 50_000n);
    const result = buildSignalTx(portal.privkey, payload, utxo, 1);

    assert.ok(result.hex.length > 0);
  });
});

// ═══ FAN-OUT ═══

describe("buildFanOutTx", () => {
  it("splits UTXO into multiple outputs", () => {
    const portal = makePortalKey();
    const utxo = makeUtxo(portal.privkey, 500_000n);
    const result = buildFanOutTx(portal.privkey, utxo, 10, 10_000n, 1);

    assert.ok(result.hex.length > 0);
    assert.ok(result.outputs.length >= 10);

    const tx = bitcoin.Transaction.fromHex(result.hex);
    assert.ok(tx.outs.length >= 10);

    for (let i = 0; i < 10; i++) {
      assert.equal(tx.outs[i].value, 10_000n);
    }
  });

  it("includes change output when remainder is above dust", () => {
    const portal = makePortalKey();
    const utxo = makeUtxo(portal.privkey, 200_000n);
    const result = buildFanOutTx(portal.privkey, utxo, 5, 10_000n, 1);

    const tx = bitcoin.Transaction.fromHex(result.hex);
    assert.ok(tx.outs.length > 5, "Should have change output");
  });

  it("rejects insufficient UTXO", () => {
    const portal = makePortalKey();
    const utxo = makeUtxo(portal.privkey, 1_000n);
    assert.throws(() => {
      buildFanOutTx(portal.privkey, utxo, 10, 10_000n, 1);
    }, /Insufficient UTXO/);
  });
});

// ═══ CONSOLIDATION ═══

describe("buildConsolidationTx", () => {
  it("merges multiple UTXOs into one", () => {
    const portal = makePortalKey();
    const utxos = Array.from({ length: 5 }, (_, i) =>
      makeUtxo(portal.privkey, 10_000n, `${"a".repeat(63)}${i}`),
    );

    const result = buildConsolidationTx(portal.privkey, utxos, 1);

    assert.ok(result.hex.length > 0);
    assert.ok(result.outputAmount > 0n);
    assert.ok(result.outputAmount < 50_000n);

    const tx = bitcoin.Transaction.fromHex(result.hex);
    assert.equal(tx.ins.length, 5);
    assert.equal(tx.outs.length, 1);
  });

  it("rejects single UTXO", () => {
    const portal = makePortalKey();
    const utxos = [makeUtxo(portal.privkey, 10_000n)];
    assert.throws(() => {
      buildConsolidationTx(portal.privkey, utxos, 1);
    }, /Need at least 2/);
  });
});

// ═══ RBF FEE BUMPING ═══

describe("buildRbfBump", () => {
  it("rebuilds tx at higher fee rate", () => {
    const portal = makePortalKey();
    const signalPayload = createSignalPayload([
      { kind: "text", value: "test" },
    ]);
    const utxo = makeUtxo(portal.privkey, 50_000n);

    const original = buildSignalTx(portal.privkey, signalPayload, utxo, 1);

    const origTx = bitcoin.Transaction.fromHex(original.hex);
    const outputs = origTx.outs.map((o) => ({
      script: Buffer.from(o.script),
      value: o.value as bigint,
    }));

    const bumped = buildRbfBump(portal.privkey, utxo, outputs, 5);

    assert.ok(bumped.fee > original.fee, "Bumped fee should be higher");
    assert.notEqual(bumped.txid, original.txid, "Different txid (RBF replacement)");
  });
});

// ═══ COST ESTIMATOR ═══

describe("cost estimation", () => {
  it("estimateKeyPathTxVsize produces reasonable values", () => {
    const v1i1o = estimateKeyPathTxVsize(1, 1);
    const v1i2o = estimateKeyPathTxVsize(1, 2);
    const v2i1o = estimateKeyPathTxVsize(2, 1);

    assert.ok(v1i1o > 50 && v1i1o < 200, `1-in-1-out: ${v1i1o} vB`);
    assert.ok(v1i2o > v1i1o, "More outputs = larger");
    assert.ok(v2i1o > v1i1o, "More inputs = larger");
  });

  it("estimateRevealVsize scales with script size", () => {
    const small = estimateRevealVsize(200, 33);
    const large = estimateRevealVsize(2000, 33);

    assert.ok(large > small, "Larger script = larger vsize");
    assert.ok(small > 50 && small < 500);
    assert.ok(large > 300);
  });

  it("estimateCommitRevealCost matches actual tx", () => {
    const portal = makePortalKey();
    const author = generateKeyPair();
    const { envelope } = createPostEnvelope(
      author.privkey,
      "Hello, Bitcoin!",
      "bitcoin",
    );

    const estimate = estimateCommitRevealCost(envelope, 1, portal.xOnlyPubkey);

    const utxo = makeUtxo(portal.privkey, 500_000n);
    const actual = buildCommitRevealTxs(portal.privkey, envelope, utxo, 1);

    // Estimates should be within 20% of actual
    const commitRatio = estimate.commitVsize / actual.commitVsize;
    const revealRatio = estimate.revealVsize / actual.revealVsize;

    assert.ok(
      commitRatio > 0.8 && commitRatio < 1.2,
      `Commit estimate ratio: ${commitRatio}`,
    );
    assert.ok(
      revealRatio > 0.7 && revealRatio < 1.3,
      `Reveal estimate ratio: ${revealRatio}`,
    );
  });

  it("estimateBurnCost returns non-zero", () => {
    const est = estimateBurnCost(1);
    assert.ok(est.vsize > 0);
    assert.ok(est.feeSats > 0n);
  });

  it("estimateSignalCost returns non-zero", () => {
    const est = estimateSignalCost(1);
    assert.ok(est.vsize > 0);
    assert.ok(est.feeSats > 0n);
  });

  it("cost scales linearly with fee rate", () => {
    const at1 = estimateBurnCost(1);
    const at10 = estimateBurnCost(10);
    assert.equal(at10.feeSats, at1.feeSats * 10n);
  });
});

// ═══ CROSS-CUTTING PROPERTIES ═══

describe("cross-cutting properties", () => {
  it("all tx types produce valid hex", () => {
    const portal = makePortalKey();
    const author = generateKeyPair();

    const { envelope: postEnv } = createPostEnvelope(
      author.privkey,
      "Post",
      "topic",
    );

    const utxo = makeUtxo(portal.privkey, 100_000n);

    // Commit/reveal
    const cr = buildCommitRevealTxs(portal.privkey, postEnv, utxo, 1);
    assert.doesNotThrow(() => bitcoin.Transaction.fromHex(cr.commitHex));
    assert.doesNotThrow(() => bitcoin.Transaction.fromHex(cr.revealHex));

    // Burn
    const burnPayload = createBurnPayload(Buffer.alloc(32, 0xaa));
    const burn = buildBurnTx(portal.privkey, burnPayload, utxo, 1, 5_000n);
    assert.doesNotThrow(() => bitcoin.Transaction.fromHex(burn.hex));

    // Signal
    const signalPayload = createSignalPayload([
      { kind: "text", value: "test" },
    ]);
    const signal = buildSignalTx(portal.privkey, signalPayload, utxo, 1);
    assert.doesNotThrow(() => bitcoin.Transaction.fromHex(signal.hex));
  });

  it("all txs use signet-compatible addresses", () => {
    const portal = makePortalKey();
    const p2tr = bitcoin.payments.p2tr({
      internalPubkey: portal.xOnlyPubkey,
      network: NETWORK,
    });
    assert.ok(p2tr.address!.startsWith("tb1p"), "Should be tb1p address (signet/testnet)");
  });

  it("fee accounting is consistent", () => {
    const portal = makePortalKey();
    const author = generateKeyPair();
    const { envelope } = createPostEnvelope(author.privkey, "Accounting test", "test");

    const utxo = makeUtxo(portal.privkey, 100_000n);
    const cr = buildCommitRevealTxs(portal.privkey, envelope, utxo, 1);

    // input = commitFee + commitOutputValue + change
    const inputTotal = cr.commitFee + cr.commitOutputValue + cr.changeAmount;
    assert.equal(inputTotal, utxo.amount, "Commit fee + commit output + change = input");

    // total fee = input - change - postage (546 sats to portal from reveal)
    assert.equal(
      cr.totalFee,
      utxo.amount - cr.changeAmount - BigInt(DUST_LIMIT),
      "Total fee = input - change - postage",
    );
  });
});
