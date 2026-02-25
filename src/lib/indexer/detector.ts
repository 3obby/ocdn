import type { RawTransaction, TxInput } from "../bitcoin/rpc";
import { PROTOCOL_TAG_BYTES } from "../protocol/constants";
import {
  parseWitnessEnvelope,
  parseOpReturn,
  verifyEnvelope,
} from "../protocol/parse";
import { topicHash } from "../protocol/crypto";
import type { WitnessEnvelope, OpReturnPayload } from "../protocol/types";

// ═══ TYPES ═══

export interface DetectedEnvelope {
  txid: string;
  envelope: WitnessEnvelope;
  contentHash: Uint8Array;
  valid: boolean;
}

export interface DetectedOpReturn {
  txid: string;
  payload: OpReturnPayload;
  fee: bigint;
  signerPubkey: string | null;
}

export interface DetectedExternalPost {
  txid: string;
  protocol: string;
  content: string;
  fee: bigint;
  signerPubkey: string | null;
}

export interface BlockItems {
  envelopes: DetectedEnvelope[];
  opReturns: DetectedOpReturn[];
  externalPosts: DetectedExternalPost[];
}

// ═══ HEX UTILITIES ═══

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// ═══ TOPIC NORMALIZATION ═══

export function normalizeTopic(topic: string): string {
  return topic.toLowerCase().trim().normalize("NFC");
}

export function normalizedTopicHash(topic: string): string {
  return toHex(topicHash(normalizeTopic(topic)));
}

// ═══ BITCOIN SCRIPT PARSING ═══

const OP_0 = 0x00;
const OP_IF = 0x63;
const OP_ENDIF = 0x68;
const OP_PUSHDATA1 = 0x4c;
const OP_PUSHDATA2 = 0x4d;
const OP_PUSHDATA4 = 0x4e;
const OP_RETURN = 0x6a;

/**
 * Read a single push data item from compiled script bytecode.
 * Returns the data bytes and next read position, or null if not a push op.
 */
function readPush(
  script: Uint8Array,
  pos: number,
): { data: Uint8Array; next: number } | null {
  if (pos >= script.length) return null;
  const op = script[pos];

  if (op === OP_0) {
    return { data: new Uint8Array(0), next: pos + 1 };
  }
  // OP_1 through OP_16 push the integer value 1–16 as a single byte
  if (op >= 0x51 && op <= 0x60) {
    return { data: new Uint8Array([op - 0x50]), next: pos + 1 };
  }
  // OP_1NEGATE pushes 0x81 (-1 in script number encoding)
  if (op === 0x4f) {
    return { data: new Uint8Array([0x81]), next: pos + 1 };
  }
  if (op >= 0x01 && op <= 0x4b) {
    const end = pos + 1 + op;
    if (end > script.length) return null;
    return { data: script.slice(pos + 1, end), next: end };
  }
  if (op === OP_PUSHDATA1) {
    if (pos + 2 > script.length) return null;
    const len = script[pos + 1];
    const end = pos + 2 + len;
    if (end > script.length) return null;
    return { data: script.slice(pos + 2, end), next: end };
  }
  if (op === OP_PUSHDATA2) {
    if (pos + 3 > script.length) return null;
    const len = script[pos + 1] | (script[pos + 2] << 8);
    const end = pos + 3 + len;
    if (end > script.length) return null;
    return { data: script.slice(pos + 3, end), next: end };
  }
  if (op === OP_PUSHDATA4) {
    if (pos + 5 > script.length) return null;
    const len =
      script[pos + 1] |
      (script[pos + 2] << 8) |
      (script[pos + 3] << 16) |
      (script[pos + 4] << 24);
    const end = pos + 5 + len;
    if (end > script.length) return null;
    return { data: script.slice(pos + 5, end), next: end };
  }

  return null;
}

/** Skip past a single script operation (opcode + any push data). */
function skipOp(script: Uint8Array, pos: number): number {
  if (pos >= script.length) return script.length;
  const op = script[pos];
  if (op >= 0x01 && op <= 0x4b) return Math.min(pos + 1 + op, script.length);
  if (op === OP_PUSHDATA1 && pos + 1 < script.length)
    return Math.min(pos + 2 + script[pos + 1], script.length);
  if (op === OP_PUSHDATA2 && pos + 2 < script.length)
    return Math.min(
      pos + 3 + (script[pos + 1] | (script[pos + 2] << 8)),
      script.length,
    );
  if (op === OP_PUSHDATA4 && pos + 4 < script.length)
    return Math.min(
      pos +
        5 +
        (script[pos + 1] |
          (script[pos + 2] << 8) |
          (script[pos + 3] << 16) |
          (script[pos + 4] << 24)),
      script.length,
    );
  return pos + 1;
}

/**
 * Parse a Taproot leaf script for OP_FALSE OP_IF ... OP_ENDIF envelope blocks.
 * Returns an array of push-data arrays, one per envelope found.
 * Supports multi-envelope scripts (multiple OP_FALSE OP_IF blocks).
 */
export function parseScriptForEnvelopes(script: Uint8Array): Uint8Array[][] {
  const envelopes: Uint8Array[][] = [];
  let pos = 0;

  while (pos < script.length - 1) {
    if (script[pos] === OP_0 && script[pos + 1] === OP_IF) {
      pos += 2;
      const pushes: Uint8Array[] = [];
      let valid = true;

      while (pos < script.length && script[pos] !== OP_ENDIF) {
        const push = readPush(script, pos);
        if (push) {
          pushes.push(push.data);
          pos = push.next;
        } else {
          valid = false;
          break;
        }
      }

      if (valid && pos < script.length && script[pos] === OP_ENDIF) {
        pos++;
        if (pushes.length > 0) envelopes.push(pushes);
      }
    } else {
      pos = skipOp(script, pos);
    }
  }

  return envelopes;
}

/** Extract the raw data payload from an OP_RETURN scriptPubKey hex string. */
export function extractOpReturnData(scriptHex: string): Uint8Array | null {
  const script = fromHex(scriptHex);
  if (script.length < 2 || script[0] !== OP_RETURN) return null;
  const push = readPush(script, 1);
  return push ? push.data : null;
}

// ═══ TRANSACTION SCANNING ═══

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isTaprootScriptPath(vin: TxInput): boolean {
  const w = vin.txinwitness;
  if (!w || w.length < 2) return false;
  if (vin.prevout?.scriptPubKey.type !== "witness_v1_taproot") return false;
  // Control block: at least 33 bytes (1 version + 32 internal key) = 66 hex chars
  const cb = w[w.length - 1];
  if (!cb || cb.length < 66) return false;
  // Tapscript leaf version 0xC0 (mask 0xFE strips the parity bit)
  return (parseInt(cb.substring(0, 2), 16) & 0xfe) === 0xc0;
}

/** Extract all OCDN witness envelopes from a single transaction. */
export function extractWitnessEnvelopes(
  tx: RawTransaction,
): DetectedEnvelope[] {
  const results: DetectedEnvelope[] = [];

  for (const vin of tx.vin) {
    if (!vin.txinwitness || !vin.prevout) continue;
    if (!isTaprootScriptPath(vin)) continue;

    const witness = vin.txinwitness!;
    const scriptHex = witness[witness.length - 2];
    const script = fromHex(scriptHex);

    for (const pushes of parseScriptForEnvelopes(script)) {
      if (
        pushes.length < 1 ||
        !bytesEqual(pushes[0], PROTOCOL_TAG_BYTES)
      )
        continue;

      const envelope = parseWitnessEnvelope(pushes);
      if (!envelope) continue;

      const { valid, contentHash } = verifyEnvelope(envelope);
      results.push({ txid: tx.txid, envelope, contentHash, valid });
    }
  }

  return results;
}

/** Extract all OCDN OP_RETURN payloads from a single transaction. */
export function extractOpReturns(tx: RawTransaction): DetectedOpReturn[] {
  const results: DetectedOpReturn[] = [];

  for (const vout of tx.vout) {
    if (vout.scriptPubKey.type !== "nulldata") continue;

    const data = extractOpReturnData(vout.scriptPubKey.hex);
    if (!data || data.length < 6) continue;
    if (!bytesEqual(data.slice(0, 4), PROTOCOL_TAG_BYTES)) continue;

    const payload = parseOpReturn(data);
    if (!payload) continue;

    const fee = computeTxFee(tx);
    const signerPubkey = extractSignerPubkey(tx);
    results.push({ txid: tx.txid, payload, fee, signerPubkey });
  }

  return results;
}

// ═══ EXTERNAL PROTOCOL DETECTION ═══

const EW_PREFIX = new Uint8Array([0x45, 0x57]); // "EW"
const decoder = new TextDecoder("utf-8", { fatal: true });

function isValidUtf8(data: Uint8Array): boolean {
  try {
    decoder.decode(data);
    return true;
  } catch {
    return false;
  }
}

/** Extract Eternity Wall and other recognized external protocol posts. */
export function extractExternalPosts(tx: RawTransaction): DetectedExternalPost[] {
  const results: DetectedExternalPost[] = [];

  for (const vout of tx.vout) {
    if (vout.scriptPubKey.type !== "nulldata") continue;

    const data = extractOpReturnData(vout.scriptPubKey.hex);
    if (!data || data.length < 3) continue;

    // Skip ocdn-tagged payloads (handled by extractOpReturns)
    if (data.length >= 4 && bytesEqual(data.slice(0, 4), PROTOCOL_TAG_BYTES)) continue;

    // Eternity Wall: UTF-8 starting with "EW"
    if (data.length >= 2 && bytesEqual(data.slice(0, 2), EW_PREFIX) && isValidUtf8(data)) {
      const text = decoder.decode(data.slice(2)).trim();
      if (text.length === 0) continue;

      const fee = computeTxFee(tx);
      const signerPubkey = extractSignerPubkey(tx);
      results.push({ txid: tx.txid, protocol: "ew", content: text, fee, signerPubkey });
    }
  }

  return results;
}

/**
 * Compute the transaction fee: sum(input prevout values) - sum(output values).
 * Requires verbosity-2 block data so prevout fields are populated.
 * Values arrive as BTC floats; we convert to integer satoshis.
 */
export function computeTxFee(tx: RawTransaction): bigint {
  let inputSats = 0n;
  let outputSats = 0n;

  for (const vin of tx.vin) {
    if (!vin.prevout) return 0n; // coinbase
    inputSats += BigInt(Math.round(vin.prevout.value * 1e8));
  }
  for (const vout of tx.vout) {
    outputSats += BigInt(Math.round(vout.value * 1e8));
  }

  return inputSats - outputSats;
}

/**
 * Extract the x-only public key from the first input's spent Taproot output.
 * P2TR scriptPubKey hex: "5120" + 64 hex chars (32-byte x-only key).
 */
export function extractSignerPubkey(tx: RawTransaction): string | null {
  if (tx.vin.length === 0) return null;
  const spk = tx.vin[0].prevout?.scriptPubKey;
  if (!spk) return null;
  if (
    spk.type === "witness_v1_taproot" &&
    spk.hex.length === 68 &&
    spk.hex.startsWith("5120")
  ) {
    return spk.hex.substring(4);
  }
  return null;
}

/** Scan every transaction in a block for OCDN and external protocol data. */
export function detectBlockItems(
  txs: RawTransaction[],
): BlockItems {
  const envelopes: DetectedEnvelope[] = [];
  const opReturns: DetectedOpReturn[] = [];
  const externalPosts: DetectedExternalPost[] = [];

  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    if (i === 0 && (!tx.vin[0] || !tx.vin[0].prevout)) continue;

    envelopes.push(...extractWitnessEnvelopes(tx));
    opReturns.push(...extractOpReturns(tx));
    externalPosts.push(...extractExternalPosts(tx));
  }

  return { envelopes, opReturns, externalPosts };
}
