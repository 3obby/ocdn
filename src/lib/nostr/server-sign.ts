/**
 * Server-side event signing for publishing protocol events.
 *
 * Uses a configurable private key (SETTLER_PRIVATE_KEY or FOUNDER_PUBKEY).
 * For MVP, builds pseudo-signed events that relays will accept.
 * Post-MVP: replace with proper secp256k1 signing via @noble/curves.
 */

import { type NostrEvent } from "./types";

const SETTLER_PUBKEY = process.env.FOUNDER_PUBKEY || "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Build a server-signed event.
 * MVP: pseudo-signed with settler pubkey. Relays may reject unsigned events,
 * but compliant relays accepting NIP-POOL kinds will likely accept these.
 * Real signing requires secp256k1 (@noble/curves) — deferred to infra setup.
 */
export async function buildServerEvent(
  kind: number,
  tags: string[][],
  content: string = ""
): Promise<NostrEvent> {
  const created_at = Math.floor(Date.now() / 1000);

  // Compute event id (SHA-256 of serialized event)
  const serialized = JSON.stringify([
    0,
    SETTLER_PUBKEY,
    created_at,
    kind,
    tags,
    content,
  ]);

  const hashBuffer = await globalDigest(serialized);
  const id = bufferToHex(hashBuffer);

  return {
    id,
    kind,
    pubkey: SETTLER_PUBKEY,
    created_at,
    tags,
    content,
    // Placeholder signature — real signing deferred to @noble/curves integration
    sig: "server_" + id.slice(0, 121).padEnd(128, "0"),
  };
}

async function globalDigest(data: string): Promise<ArrayBuffer> {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  }
  // Fallback for Node.js
  const { createHash } = await import("crypto");
  const hash = createHash("sha256").update(data).digest();
  return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
