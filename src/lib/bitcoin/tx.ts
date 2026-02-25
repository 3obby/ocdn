import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import { schnorr } from "@noble/curves/secp256k1.js";
import {
  serializeWitnessEnvelope,
  serializeBurnOpReturn,
  serializeSignalOpReturn,
} from "../protocol";
import type {
  WitnessEnvelope,
  BurnPayload,
  SignalPayload,
} from "../protocol";
import { getRpc } from "./rpc";
import {
  NETWORK,
  DUST_LIMIT,
  RBF_SEQUENCE,
  createKeyPathSigner,
  createScriptPathSigner,
  toXOnly,
  type PoolUtxo,
  type TaprootSigner,
} from "./wallet";

bitcoin.initEccLib(ecc);

// ═══ TYPES ═══

export interface UtxoInput {
  txid: string;
  vout: number;
  amount: bigint;
  scriptPubkey: Buffer;
}

export interface CommitRevealResult {
  commitHex: string;
  revealHex: string;
  commitTxid: string;
  revealTxid: string;
  commitVsize: number;
  revealVsize: number;
  commitFee: bigint;
  revealFee: bigint;
  totalFee: bigint;
  leafScript: Buffer;
  scriptTree: { output: Buffer };
  commitOutputValue: bigint;
  changeAmount: bigint;
}

export interface SingleTxResult {
  hex: string;
  txid: string;
  vsize: number;
  fee: bigint;
  changeAmount: bigint;
}

export interface CostEstimate {
  commitVsize: number;
  revealVsize: number;
  totalVsize: number;
  totalFeeSats: bigint;
}

export interface SingleTxCostEstimate {
  vsize: number;
  feeSats: bigint;
}

// ═══ ENVELOPE SCRIPT BUILDER ═══

/**
 * Build the Taproot leaf script for a witness envelope.
 * Structure: <portal_xonly_pubkey> OP_CHECKSIG OP_FALSE OP_IF <pushes...> OP_ENDIF
 * The OP_CHECKSIG ensures only the portal can reveal.
 * The OP_FALSE OP_IF envelope is the data carrier (never executed).
 */
export function buildEnvelopeScript(
  xOnlyPubkey: Buffer,
  envelopePushes: Uint8Array[],
): Buffer {
  const parts: (Buffer | number)[] = [
    xOnlyPubkey,
    bitcoin.opcodes.OP_CHECKSIG,
    bitcoin.opcodes.OP_FALSE,
    bitcoin.opcodes.OP_IF,
    ...envelopePushes.map((p) => Buffer.from(p)),
    bitcoin.opcodes.OP_ENDIF,
  ];
  return Buffer.from(bitcoin.script.compile(parts));
}

// ═══ COMMIT / REVEAL TX PAIR (POST & REPLY) ═══

/**
 * Build a commit/reveal transaction pair for a POST or REPLY envelope.
 *
 * Commit tx: spends a portal UTXO via key-path, creates a P2TR output
 * with the envelope script tree + change to portal.
 *
 * Reveal tx: spends the commit output via script-path, placing the
 * envelope data in the witness. Change to portal.
 */
export function buildCommitRevealTxs(
  privkey: Buffer,
  envelope: WitnessEnvelope,
  utxo: UtxoInput,
  feeRate: number,
): CommitRevealResult {
  const xOnlyPubkey = Buffer.from(schnorr.getPublicKey(privkey));

  const pushes = serializeWitnessEnvelope(envelope);
  const leafScript = buildEnvelopeScript(xOnlyPubkey, pushes);

  const scriptTree: { output: Buffer } = { output: leafScript };

  const commitPayment = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    scriptTree,
    redeem: { output: leafScript },
    network: NETWORK,
  });

  const portalPayment = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: NETWORK,
  });

  const controlBlock = Buffer.from(
    commitPayment.witness![commitPayment.witness!.length - 1],
  );

  // Estimate reveal tx vsize to determine commit output value
  const revealVsize = estimateRevealVsize(leafScript.length, controlBlock.length);
  const revealFee = BigInt(Math.ceil(revealVsize * feeRate));

  // Commit output = reveal fee + postage (for change output on reveal)
  const postage = BigInt(DUST_LIMIT);
  const commitOutputValue = revealFee + postage;

  // Estimate commit tx vsize (1 input, 2 outputs)
  const commitVsize = estimateKeyPathTxVsize(1, 2);
  const commitFee = BigInt(Math.ceil(commitVsize * feeRate));

  const totalNeeded = commitOutputValue + commitFee;
  const changeAmount = utxo.amount - totalNeeded;

  if (changeAmount < 0n) {
    throw new Error(
      `Insufficient UTXO: have ${utxo.amount} sats, need ${totalNeeded}`,
    );
  }

  // ── BUILD COMMIT TX ──

  const commitPsbt = new bitcoin.Psbt({ network: NETWORK });
  commitPsbt.addInput({
    hash: utxo.txid,
    index: utxo.vout,
    witnessUtxo: {
      script: utxo.scriptPubkey,
      value: utxo.amount,
    },
    tapInternalKey: xOnlyPubkey,
    sequence: RBF_SEQUENCE,
  });

  commitPsbt.addOutput({
    address: commitPayment.address!,
    value: commitOutputValue,
  });

  if (changeAmount >= BigInt(DUST_LIMIT)) {
    commitPsbt.addOutput({
      address: portalPayment.address!,
      value: changeAmount,
    });
  }

  const keyPathSigner = createKeyPathSigner(privkey);
  commitPsbt.signInput(0, keyPathSigner);
  commitPsbt.finalizeAllInputs();
  const commitTx = commitPsbt.extractTransaction();

  // ── BUILD REVEAL TX ──

  const revealPsbt = new bitcoin.Psbt({ network: NETWORK });
  revealPsbt.addInput({
    hash: commitTx.getId(),
    index: 0,
    witnessUtxo: {
      script: Buffer.from(commitPayment.output!),
      value: commitOutputValue,
    },
    tapLeafScript: [
      {
        leafVersion: 0xc0,
        script: leafScript,
        controlBlock: controlBlock,
      },
    ],
    sequence: RBF_SEQUENCE,
  });

  revealPsbt.addOutput({
    address: portalPayment.address!,
    value: postage,
  });

  const scriptPathSigner = createScriptPathSigner(privkey);
  revealPsbt.signInput(0, scriptPathSigner);
  revealPsbt.finalizeAllInputs();
  const revealTx = revealPsbt.extractTransaction();

  return {
    commitHex: commitTx.toHex(),
    revealHex: revealTx.toHex(),
    commitTxid: commitTx.getId(),
    revealTxid: revealTx.getId(),
    commitVsize: commitTx.virtualSize(),
    revealVsize: revealTx.virtualSize(),
    commitFee: utxo.amount - commitOutputValue - changeAmount,
    revealFee: commitOutputValue - postage,
    totalFee:
      utxo.amount - changeAmount - postage,
    leafScript,
    scriptTree,
    commitOutputValue,
    changeAmount,
  };
}

// ═══ KEY-PATH RECOVERY ═══

/**
 * Recover funds from a stuck commit output via key-path spend.
 * Used when the reveal tx gets stuck and can't be bumped.
 * The portal's internal key is always the Taproot internal key,
 * so it can always reclaim the commit output.
 */
export function buildKeyPathRecoveryTx(
  privkey: Buffer,
  commitTxid: string,
  commitVout: number,
  commitAmount: bigint,
  commitOutputScript: Buffer,
  scriptTree: { output: Buffer },
  feeRate: number,
): SingleTxResult {
  const xOnlyPubkey = Buffer.from(schnorr.getPublicKey(privkey));

  const portalPayment = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: NETWORK,
  });

  // The commit output has a script tree; we need the merkle root for key-path tweaking
  const commitPayment = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    scriptTree,
    network: NETWORK,
  });

  const vsize = estimateKeyPathTxVsize(1, 1);
  const fee = BigInt(Math.ceil(vsize * feeRate));
  const outputValue = commitAmount - fee;

  if (outputValue < BigInt(DUST_LIMIT)) {
    throw new Error("Recovery output would be dust");
  }

  const psbt = new bitcoin.Psbt({ network: NETWORK });
  psbt.addInput({
    hash: commitTxid,
    index: commitVout,
    witnessUtxo: {
      script: commitOutputScript,
      value: commitAmount,
    },
    tapInternalKey: xOnlyPubkey,
    tapMerkleRoot: commitPayment.hash ? Buffer.from(commitPayment.hash) : undefined,
    sequence: RBF_SEQUENCE,
  });

  psbt.addOutput({
    address: portalPayment.address!,
    value: outputValue,
  });

  // Key-path spend with merkle root tweak
  const merkleRoot = commitPayment.hash ? Buffer.from(commitPayment.hash) : undefined;
  const signer = createKeyPathSigner(privkey, merkleRoot);
  psbt.signInput(0, signer);
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();

  return {
    hex: tx.toHex(),
    txid: tx.getId(),
    vsize: tx.virtualSize(),
    fee,
    changeAmount: outputValue,
  };
}

// ═══ BURN TX (OP_RETURN) ═══

/**
 * Build a BURN transaction: OP_RETURN with target hash + change.
 * The tx fee IS the burn amount (sats destroyed as ranking signal).
 *
 * @param desiredBurn - The amount to burn (goes to miners as fee).
 *   If the UTXO can't produce a non-dust change output, the actual
 *   burn will be higher (entire UTXO consumed).
 */
export function buildBurnTx(
  privkey: Buffer,
  payload: BurnPayload,
  utxo: UtxoInput,
  feeRate: number,
  desiredBurn: bigint,
): SingleTxResult {
  const xOnlyPubkey = Buffer.from(schnorr.getPublicKey(privkey));

  const portalPayment = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: NETWORK,
  });

  const opReturnData = serializeBurnOpReturn(payload);
  const opReturnScript = Buffer.from(
    bitcoin.script.compile([
      bitcoin.opcodes.OP_RETURN,
      Buffer.from(opReturnData),
    ]),
  );

  // Min fee = tx overhead at the given feerate
  const baseVsize = estimateKeyPathTxVsize(1, 2); // OP_RETURN + change
  const baseFee = BigInt(Math.ceil(baseVsize * feeRate));

  // The burn is the tx fee: input - change - 0 (OP_RETURN has 0 value)
  // Total cost to user: desiredBurn (most goes to miners)
  // We need: input >= desiredBurn + change(optional)
  // Actual fee = input - change = desiredBurn (ideally)
  const targetChange = utxo.amount - desiredBurn;

  let changeAmount: bigint;
  if (targetChange >= BigInt(DUST_LIMIT)) {
    changeAmount = targetChange;
  } else {
    changeAmount = 0n;
  }

  const actualFee = utxo.amount - changeAmount;
  if (actualFee < baseFee) {
    throw new Error(
      `Burn amount ${desiredBurn} below min relay fee ${baseFee}`,
    );
  }

  const psbt = new bitcoin.Psbt({ network: NETWORK });
  psbt.addInput({
    hash: utxo.txid,
    index: utxo.vout,
    witnessUtxo: {
      script: utxo.scriptPubkey,
      value: utxo.amount,
    },
    tapInternalKey: xOnlyPubkey,
    sequence: RBF_SEQUENCE,
  });

  psbt.addOutput({ script: opReturnScript, value: 0n });

  if (changeAmount > 0n) {
    psbt.addOutput({
      address: portalPayment.address!,
      value: changeAmount,
    });
  }

  const signer = createKeyPathSigner(privkey);
  psbt.signInput(0, signer);
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();

  return {
    hex: tx.toHex(),
    txid: tx.getId(),
    vsize: tx.virtualSize(),
    fee: actualFee,
    changeAmount,
  };
}

// ═══ SIGNAL TX (OP_RETURN, SELF-SIGNED) ═══

/**
 * Build a SIGNAL transaction: OP_RETURN with ordered refs + change.
 * Self-signed mode: the UTXO signer IS the signal author.
 * The tx fee is the economic weight of the signal.
 */
export function buildSignalTx(
  privkey: Buffer,
  payload: SignalPayload,
  utxo: UtxoInput,
  feeRate: number,
): SingleTxResult {
  const xOnlyPubkey = Buffer.from(schnorr.getPublicKey(privkey));

  const portalPayment = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: NETWORK,
  });

  const opReturnData = serializeSignalOpReturn(payload);
  const opReturnScript = Buffer.from(
    bitcoin.script.compile([
      bitcoin.opcodes.OP_RETURN,
      Buffer.from(opReturnData),
    ]),
  );

  const vsize = estimateKeyPathTxVsize(1, 2);
  const fee = BigInt(Math.ceil(vsize * feeRate));
  const changeAmount = utxo.amount - fee;

  if (changeAmount < BigInt(DUST_LIMIT)) {
    throw new Error(
      `Insufficient UTXO for signal tx: have ${utxo.amount}, need ${fee + BigInt(DUST_LIMIT)}`,
    );
  }

  const psbt = new bitcoin.Psbt({ network: NETWORK });
  psbt.addInput({
    hash: utxo.txid,
    index: utxo.vout,
    witnessUtxo: {
      script: utxo.scriptPubkey,
      value: utxo.amount,
    },
    tapInternalKey: xOnlyPubkey,
    sequence: RBF_SEQUENCE,
  });

  psbt.addOutput({ script: opReturnScript, value: 0n });
  psbt.addOutput({
    address: portalPayment.address!,
    value: changeAmount,
  });

  const signer = createKeyPathSigner(privkey);
  psbt.signInput(0, signer);
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();

  return {
    hex: tx.toHex(),
    txid: tx.getId(),
    vsize: tx.virtualSize(),
    fee,
    changeAmount,
  };
}

// ═══ UTXO FAN-OUT ═══

/**
 * Pre-split a large UTXO into many concurrent-ready outputs.
 * Each output goes to the portal's P2TR address.
 */
export function buildFanOutTx(
  privkey: Buffer,
  utxo: UtxoInput,
  count: number,
  targetAmount: bigint,
  feeRate: number,
): { hex: string; txid: string; outputs: { vout: number; amount: bigint }[] } {
  const xOnlyPubkey = Buffer.from(schnorr.getPublicKey(privkey));

  const portalPayment = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: NETWORK,
  });

  const vsize = estimateKeyPathTxVsize(1, count + 1);
  const fee = BigInt(Math.ceil(vsize * feeRate));
  const totalOutputAmount = targetAmount * BigInt(count);
  const needed = totalOutputAmount + fee;

  if (utxo.amount < needed) {
    throw new Error(
      `Insufficient UTXO for fan-out: have ${utxo.amount}, need ${needed}`,
    );
  }

  const change = utxo.amount - needed;

  const psbt = new bitcoin.Psbt({ network: NETWORK });
  psbt.addInput({
    hash: utxo.txid,
    index: utxo.vout,
    witnessUtxo: {
      script: utxo.scriptPubkey,
      value: utxo.amount,
    },
    tapInternalKey: xOnlyPubkey,
    sequence: RBF_SEQUENCE,
  });

  const outputs: { vout: number; amount: bigint }[] = [];
  for (let i = 0; i < count; i++) {
    psbt.addOutput({
      address: portalPayment.address!,
      value: targetAmount,
    });
    outputs.push({ vout: i, amount: targetAmount });
  }

  if (change >= BigInt(DUST_LIMIT)) {
    psbt.addOutput({
      address: portalPayment.address!,
      value: change,
    });
    outputs.push({ vout: count, amount: change });
  }

  const signer = createKeyPathSigner(privkey);
  psbt.signInput(0, signer);
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();

  return { hex: tx.toHex(), txid: tx.getId(), outputs };
}

// ═══ UTXO CONSOLIDATION ═══

/**
 * Merge many small UTXOs into a single output.
 * Reduces UTXO fragmentation from change outputs.
 */
export function buildConsolidationTx(
  privkey: Buffer,
  utxos: UtxoInput[],
  feeRate: number,
): { hex: string; txid: string; outputAmount: bigint } {
  if (utxos.length < 2) throw new Error("Need at least 2 UTXOs to consolidate");

  const xOnlyPubkey = Buffer.from(schnorr.getPublicKey(privkey));

  const portalPayment = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: NETWORK,
  });

  const n = utxos.length;
  const vsize = estimateKeyPathTxVsize(n, 1);
  const fee = BigInt(Math.ceil(vsize * feeRate));

  const totalInput = utxos.reduce((sum, u) => sum + u.amount, 0n);
  const outputAmount = totalInput - fee;

  if (outputAmount < BigInt(DUST_LIMIT)) {
    throw new Error("Consolidation would produce dust output");
  }

  const psbt = new bitcoin.Psbt({ network: NETWORK });
  for (const utxo of utxos) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: utxo.scriptPubkey,
        value: utxo.amount,
      },
      tapInternalKey: xOnlyPubkey,
      sequence: RBF_SEQUENCE,
    });
  }

  psbt.addOutput({
    address: portalPayment.address!,
    value: outputAmount,
  });

  const signer = createKeyPathSigner(privkey);
  for (let i = 0; i < n; i++) {
    psbt.signInput(i, signer);
  }
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();

  return { hex: tx.toHex(), txid: tx.getId(), outputAmount };
}

// ═══ RBF FEE BUMPING ═══

/**
 * Build an RBF replacement for a key-path spend tx (burn, signal, fan-out, consolidation).
 * Reconstructs the tx with a higher fee by reducing the change output.
 * Only works for single-input key-path txs where we know the UTXO.
 */
export function buildRbfBump(
  privkey: Buffer,
  utxo: UtxoInput,
  originalOutputs: { script: Buffer; value: bigint }[],
  newFeeRate: number,
): SingleTxResult {
  const xOnlyPubkey = Buffer.from(schnorr.getPublicKey(privkey));
  const nOutputs = originalOutputs.length;

  const vsize = estimateKeyPathTxVsize(1, nOutputs);
  const newFee = BigInt(Math.ceil(vsize * newFeeRate));

  const nonChangeValue = originalOutputs
    .slice(0, -1)
    .reduce((s, o) => s + o.value, 0n);
  const newChange = utxo.amount - nonChangeValue - newFee;

  if (newChange < BigInt(DUST_LIMIT)) {
    throw new Error("RBF bump leaves insufficient change");
  }

  const psbt = new bitcoin.Psbt({ network: NETWORK });
  psbt.addInput({
    hash: utxo.txid,
    index: utxo.vout,
    witnessUtxo: {
      script: utxo.scriptPubkey,
      value: utxo.amount,
    },
    tapInternalKey: xOnlyPubkey,
    sequence: RBF_SEQUENCE,
  });

  for (let i = 0; i < nOutputs - 1; i++) {
    psbt.addOutput({
      script: originalOutputs[i].script,
      value: originalOutputs[i].value,
    });
  }
  psbt.addOutput({
    script: originalOutputs[nOutputs - 1].script,
    value: newChange,
  });

  const signer = createKeyPathSigner(privkey);
  psbt.signInput(0, signer);
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();

  return {
    hex: tx.toHex(),
    txid: tx.getId(),
    vsize: tx.virtualSize(),
    fee: newFee,
    changeAmount: newChange,
  };
}

/**
 * RBF-bump a commit/reveal pair. Rebuilds both transactions
 * at a higher fee rate (new commit txid invalidates old reveal).
 */
export function bumpCommitReveal(
  privkey: Buffer,
  envelope: WitnessEnvelope,
  utxo: UtxoInput,
  newFeeRate: number,
): CommitRevealResult {
  return buildCommitRevealTxs(privkey, envelope, utxo, newFeeRate);
}

// ═══ COST ESTIMATOR ═══

/**
 * Estimate vsize for a Taproot key-path spend transaction.
 * Formula derived from BIP-141 weight calculation:
 *   base_size = 10 + nInputs*41 + nOutputs*43
 *   witness_size = 2 + nInputs*66
 *   weight = base_size*3 + (base_size + witness_size)
 *   vsize = ceil(weight / 4)
 */
export function estimateKeyPathTxVsize(
  nInputs: number,
  nOutputs: number,
): number {
  const baseSize = 10 + nInputs * 41 + nOutputs * 43;
  const witnessSize = 2 + nInputs * 66;
  const weight = baseSize * 3 + baseSize + witnessSize;
  return Math.ceil(weight / 4);
}

/**
 * Estimate vsize for a Taproot script-path reveal tx.
 * The witness contains: [signature(65), leafScript(variable), controlBlock(33+)].
 */
export function estimateRevealVsize(
  scriptLen: number,
  controlBlockLen: number,
): number {
  const baseSize = 10 + 1 * 41 + 1 * 43; // 1 input, 1 output (change)

  // Witness: stack count(1) + sig(1+64) + script(varint+data) + controlBlock(varint+data)
  const scriptVarInt = scriptLen < 253 ? 1 : scriptLen < 65536 ? 3 : 5;
  const cbVarInt = controlBlockLen < 253 ? 1 : 3;
  const witnessSize =
    2 + // marker + flag
    1 + // witness stack items count
    1 +
    64 + // signature length + signature
    scriptVarInt +
    scriptLen +
    cbVarInt +
    controlBlockLen;

  const weight = baseSize * 3 + baseSize + witnessSize;
  return Math.ceil(weight / 4);
}

/**
 * Estimate the total cost (in sats) for a commit/reveal pair
 * based on the serialized envelope.
 */
export function estimateCommitRevealCost(
  envelope: WitnessEnvelope,
  feeRate: number,
  xOnlyPubkey?: Buffer,
): CostEstimate {
  const pubkey =
    xOnlyPubkey ?? Buffer.from(schnorr.utils.randomSecretKey()).subarray(0, 32);
  const pushes = serializeWitnessEnvelope(envelope);
  const leafScript = buildEnvelopeScript(pubkey, pushes);

  // Control block for single-leaf tree: 1 (version|parity) + 32 (internal key) = 33
  const controlBlockLen = 33;

  const commitVsize = estimateKeyPathTxVsize(1, 2);
  const revealVsize = estimateRevealVsize(leafScript.length, controlBlockLen);
  const totalVsize = commitVsize + revealVsize;

  return {
    commitVsize,
    revealVsize,
    totalVsize,
    totalFeeSats: BigInt(Math.ceil(totalVsize * feeRate)),
  };
}

/** Estimate cost for a burn tx (excludes the burn amount itself). */
export function estimateBurnCost(feeRate: number): SingleTxCostEstimate {
  const vsize = estimateKeyPathTxVsize(1, 2);
  return { vsize, feeSats: BigInt(Math.ceil(vsize * feeRate)) };
}

/** Estimate cost for a signal tx. */
export function estimateSignalCost(feeRate: number): SingleTxCostEstimate {
  const vsize = estimateKeyPathTxVsize(1, 2);
  return { vsize, feeSats: BigInt(Math.ceil(vsize * feeRate)) };
}

// ═══ BROADCAST ═══

/**
 * Broadcast a commit/reveal pair using 1-parent-1-child package relay.
 * Bitcoin Core 28+ supports submitpackage for 1P1C.
 */
export async function broadcastCommitReveal(
  commitHex: string,
  revealHex: string,
): Promise<{ commitTxid: string; revealTxid: string }> {
  const rpc = getRpc();

  try {
    const result = await rpc.submitPackage([commitHex, revealHex]);

    if (result.package_msg === "success" && result.tx_results) {
      const txids = Object.values(result.tx_results).map((r) => r.txid);
      return { commitTxid: txids[0], revealTxid: txids[1] };
    }

    if (result.tx_results) {
      const errors = Object.entries(result.tx_results)
        .filter(([, v]) => v.error)
        .map(([k, v]) => `${k}: ${v.error}`)
        .join("; ");
      throw new Error(`Package broadcast failed: ${result.package_msg} — ${errors}`);
    }

    throw new Error(`Package broadcast failed: ${result.package_msg}`);
  } catch {
    const commitTxid = await rpc.sendRawTransaction(commitHex);
    const revealTxid = await rpc.sendRawTransaction(revealHex);
    return { commitTxid, revealTxid };
  }
}

/** Broadcast a single transaction. */
export async function broadcastTx(hex: string): Promise<string> {
  const rpc = getRpc();
  return rpc.sendRawTransaction(hex);
}

/** Test if a transaction would be accepted by the mempool. */
export async function testMempoolAccept(
  hex: string,
): Promise<{ accepted: boolean; reason?: string }> {
  const rpc = getRpc();
  const results = await rpc.testMempoolAccept([hex]);
  const r = results[0];
  return { accepted: r.allowed, reason: r["reject-reason"] };
}

// ═══ RETRY PIPELINE ═══

export type PendingTxStatus =
  | "queued"
  | "committed"
  | "revealed"
  | "confirmed"
  | "failed";

export interface RetryAction {
  action: "rebroadcast" | "rbf_bump" | "key_path_recovery" | "confirmed" | "give_up";
  details?: string;
}

/**
 * Determine the next retry action for a pending commit/reveal publication.
 * Checks mempool status and decides whether to rebroadcast, RBF bump,
 * or recover via key-path.
 */
export async function diagnoseCommitReveal(
  commitTxid: string | null,
  revealTxid: string | null,
  attempts: number,
  maxAttempts: number = 10,
): Promise<RetryAction> {
  if (attempts >= maxAttempts) {
    return commitTxid
      ? { action: "key_path_recovery", details: "Max attempts reached" }
      : { action: "give_up", details: "Max attempts, no commit" };
  }

  const rpc = getRpc();

  if (revealTxid) {
    try {
      const revealInfo = await rpc.getRawTransaction(revealTxid, true);
      if (revealInfo.confirmations && revealInfo.confirmations > 0) {
        return { action: "confirmed" };
      }
      return { action: "rebroadcast", details: "Reveal in mempool, waiting" };
    } catch {
      // Reveal not found — might have been evicted
    }
  }

  if (commitTxid) {
    try {
      const commitInfo = await rpc.getRawTransaction(commitTxid, true);
      if (commitInfo.confirmations && commitInfo.confirmations > 0) {
        // Commit confirmed but reveal missing/evicted
        if (attempts > 3) {
          return { action: "key_path_recovery", details: "Reveal stuck after commit confirmed" };
        }
        return { action: "rebroadcast", details: "Commit confirmed, reveal needs rebroadcast" };
      }
      // Commit in mempool, not confirmed
      return { action: "rbf_bump", details: "Commit in mempool, not confirming" };
    } catch {
      // Commit not found — evicted
      return { action: "rebroadcast", details: "Commit evicted from mempool" };
    }
  }

  return { action: "rebroadcast", details: "No txids, initial broadcast needed" };
}

/**
 * Determine retry action for a single tx (burn or signal).
 */
export async function diagnoseSingleTx(
  txid: string | null,
  attempts: number,
  maxAttempts: number = 10,
): Promise<RetryAction> {
  if (attempts >= maxAttempts) {
    return { action: "give_up", details: "Max attempts reached" };
  }

  if (!txid) {
    return { action: "rebroadcast", details: "No txid, initial broadcast needed" };
  }

  const rpc = getRpc();
  try {
    const info = await rpc.getRawTransaction(txid, true);
    if (info.confirmations && info.confirmations > 0) {
      return { action: "confirmed" };
    }
    if (attempts > 2) {
      return { action: "rbf_bump", details: "Tx in mempool but not confirming" };
    }
    return { action: "rebroadcast", details: "Waiting for confirmation" };
  } catch {
    return { action: "rebroadcast", details: "Tx evicted from mempool" };
  }
}
