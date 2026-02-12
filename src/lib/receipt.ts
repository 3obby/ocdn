import { POW_TARGET_BASE } from "./constants";

// Use Web Crypto for hashing, nostr-tools for ed25519 verification
// (noble/curves and noble/hashes use .js exports that need special TS config)

/** Convert hex string to Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/** Convert Uint8Array to hex string */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify receipt token: Ed25519 verify against mint pubkey.
 * receipt_token = Sign_mint_sk("R2" || host_pubkey || epoch || block_cid || response_hash || price_sats || payment_hash)
 *
 * Uses Web Crypto Ed25519 (available Node 20+, modern browsers).
 */
export async function verifyReceiptToken(
  receiptTokenHex: string,
  mintPubkeyHex: string,
  message: Uint8Array
): Promise<boolean> {
  try {
    const publicKey = await crypto.subtle.importKey(
      "raw",
      hexToBytes(mintPubkeyHex) as BufferSource,
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify(
      "Ed25519",
      publicKey,
      hexToBytes(receiptTokenHex) as BufferSource,
      message as BufferSource
    );
  } catch {
    return false;
  }
}

/** Build the message that a receipt token signs */
export function buildReceiptMessage(opts: {
  hostPubkey: string;
  epoch: number;
  contentHash: string;
  responseHash: string;
  priceSats: bigint;
  paymentHash: string;
}): Uint8Array {
  const msg = `R2${opts.hostPubkey}${opts.epoch}${opts.contentHash}${opts.responseHash}${opts.priceSats}${opts.paymentHash}`;
  return new TextEncoder().encode(msg);
}

/** Sign a receipt token (mint-side) using Web Crypto */
export async function signReceiptToken(
  mintPrivateKeyHex: string,
  message: Uint8Array
): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    "raw",
    hexToBytes(mintPrivateKeyHex) as BufferSource,
    { name: "Ed25519" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("Ed25519", privateKey, message as BufferSource);
  return bytesToHex(new Uint8Array(sig));
}

/**
 * Verify PoW: hash must be below target.
 * Target scales with difficulty (per client/host/day schedule).
 */
export function verifyPow(
  powHash: string,
  difficultyMultiplier: number = 1
): boolean {
  const hashBig = BigInt("0x" + powHash);
  const target = POW_TARGET_BASE / BigInt(difficultyMultiplier);
  return hashBig < target;
}

/**
 * Compute PoW difficulty multiplier based on receipt count per client/host/day.
 * 1-8: 1x, 9-16: 2x, 17-32: 4x, 33+: 8x+
 */
export function powDifficulty(receiptCount: number): number {
  if (receiptCount <= 8) return 1;
  if (receiptCount <= 16) return 2;
  if (receiptCount <= 32) return 4;
  return 8 * Math.pow(2, Math.floor(Math.log2(receiptCount / 32)));
}

/** Compute SHA-256 hash using Web Crypto */
export async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data)
  );
  return bytesToHex(new Uint8Array(hash));
}

/** Compute PoW hash for anti-sybil */
export async function computePowHash(nonce: string, data: string): Promise<string> {
  return sha256Hex(nonce + data);
}
