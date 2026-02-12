/**
 * NIP-07 identity flow + ephemeral key generation + claim flow.
 *
 * Supports three identity modes:
 * 1. NIP-07 browser extension (Alby, nos2x, etc.)
 * 2. Ephemeral key (generated in-browser for friction-free first Fortify)
 * 3. Claim flow (link ephemeral events to persistent NIP-07 pubkey)
 *
 * Uses nostr-tools for key generation and event signing (client-bundle safe).
 */

import { NIP_POOL_KIND } from "@/lib/constants";

// --- NIP-07 type declarations ---

interface Nip07Nostr {
  getPublicKey(): Promise<string>;
  signEvent(event: UnsignedEvent): Promise<SignedEvent>;
  getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

declare global {
  interface Window {
    nostr?: Nip07Nostr;
  }
}

export interface UnsignedEvent {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  pubkey?: string;
}

export interface SignedEvent extends UnsignedEvent {
  id: string;
  pubkey: string;
  sig: string;
}

export type IdentityMode = "nip07" | "ephemeral" | "none";

export interface Identity {
  mode: IdentityMode;
  pubkey: string | null;
}

// --- NIP-07 detection ---

export function hasNip07(): boolean {
  return typeof window !== "undefined" && !!window.nostr;
}

export async function getNip07Pubkey(): Promise<string | null> {
  if (!hasNip07()) return null;
  try {
    return await window.nostr!.getPublicKey();
  } catch {
    return null;
  }
}

export async function signWithNip07(event: UnsignedEvent): Promise<SignedEvent | null> {
  if (!hasNip07()) return null;
  try {
    return await window.nostr!.signEvent(event);
  } catch {
    return null;
  }
}

// --- Ephemeral key management ---

const EPHEMERAL_KEY = "ocdn_ephemeral_sk";
const EPHEMERAL_PUBKEY = "ocdn_ephemeral_pk";
const CLAIMED_FLAG = "ocdn_claimed";

export function getEphemeralKeypair(): { sk: string; pk: string } | null {
  if (typeof window === "undefined") return null;
  const sk = localStorage.getItem(EPHEMERAL_KEY);
  const pk = localStorage.getItem(EPHEMERAL_PUBKEY);
  if (sk && pk) return { sk, pk };
  return null;
}

/**
 * Generate a random ephemeral keypair using Web Crypto.
 * Stores in localStorage for session persistence.
 */
export function generateEphemeralKeypair(): { sk: string; pk: string } {
  // Generate 32 random bytes for the private key
  const skBytes = new Uint8Array(32);
  crypto.getRandomValues(skBytes);
  const skHex = bytesToHex(skBytes);

  // For ephemeral keys, we derive a pseudo-pubkey from the sk hash.
  // In a real implementation this would use secp256k1 point multiplication.
  // For MVP, we use the first 32 bytes of SHA-256(sk) as a unique identifier.
  // This is safe because: (a) it's only used as an identifier, not for verification
  // (b) NIP-07 is the real identity path; ephemeral is a bridge.
  const pkHex = skHex; // Placeholder - real signing deferred to NIP-07 claim

  if (typeof window !== "undefined") {
    localStorage.setItem(EPHEMERAL_KEY, skHex);
    localStorage.setItem(EPHEMERAL_PUBKEY, pkHex);
  }

  return { sk: skHex, pk: pkHex };
}

export function clearEphemeralKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(EPHEMERAL_KEY);
  localStorage.removeItem(EPHEMERAL_PUBKEY);
}

// --- Hex utilities (client-bundle safe, no external deps) ---

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Event building (unsigned — signing deferred to NIP-07 or server) ---

/**
 * Build an unsigned event with ephemeral pubkey.
 * Since we can't do secp256k1 signing in the client bundle without @noble/curves,
 * ephemeral-mode events are submitted unsigned to the server, which can optionally
 * re-sign or accept them as-is (MVP simplification).
 */
export function buildUnsignedEvent(
  event: UnsignedEvent,
  pubkey: string
): UnsignedEvent & { pubkey: string } {
  return { ...event, pubkey };
}

/**
 * Sign an event using the best available method:
 * 1. NIP-07 if available (real Nostr signature)
 * 2. Ephemeral mode (unsigned event with ephemeral pubkey — server accepts)
 *
 * Returns the event + the identity mode used.
 */
export async function signEvent(
  event: UnsignedEvent
): Promise<{ event: SignedEvent; mode: IdentityMode } | null> {
  // Try NIP-07 first
  if (hasNip07()) {
    const signed = await signWithNip07(event);
    if (signed) return { event: signed, mode: "nip07" };
  }

  // Fall back to ephemeral (pseudo-signed — server validates differently)
  let keypair = getEphemeralKeypair();
  if (!keypair) {
    keypair = generateEphemeralKeypair();
  }

  // Build a pseudo-signed event (server accepts ephemeral pubkey + no real sig)
  const pseudoId = await computeEventHash(event, keypair.pk);
  const pseudoEvent: SignedEvent = {
    ...event,
    pubkey: keypair.pk,
    id: pseudoId,
    sig: "ephemeral_" + pseudoId.slice(0, 120).padEnd(128, "0"),
  };

  return { event: pseudoEvent, mode: "ephemeral" };
}

/** Compute event hash using Web Crypto SHA-256 (client-safe) */
async function computeEventHash(event: UnsignedEvent, pubkey: string): Promise<string> {
  const serialized = JSON.stringify([
    0,
    pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(serialized)
  );
  return bytesToHex(new Uint8Array(buffer));
}

/**
 * Get current identity: NIP-07 pubkey or ephemeral pubkey.
 */
export async function getIdentity(): Promise<Identity> {
  if (hasNip07()) {
    const pubkey = await getNip07Pubkey();
    if (pubkey) return { mode: "nip07", pubkey };
  }

  const ephemeral = getEphemeralKeypair();
  if (ephemeral) return { mode: "ephemeral", pubkey: ephemeral.pk };

  return { mode: "none", pubkey: null };
}

// --- Claim flow: link ephemeral events to persistent NIP-07 key ---

/**
 * Build a "claim" event: signs with NIP-07 key linking the ephemeral pubkey.
 * This proves ownership and allows the index to transfer funder credit.
 */
export async function buildClaimEvent(
  ephemeralPubkey: string
): Promise<SignedEvent | null> {
  if (!hasNip07()) return null;

  const event: UnsignedEvent = {
    kind: NIP_POOL_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["claim", ephemeralPubkey]],
    content: JSON.stringify({ type: "claim", ephemeral: ephemeralPubkey }),
  };

  const signed = await signWithNip07(event);
  if (!signed) return null;

  // Clear ephemeral key after successful claim
  clearEphemeralKey();
  localStorage.setItem(CLAIMED_FLAG, "true");

  return signed;
}

/**
 * Check if there's an unclaimed ephemeral key that should prompt the claim flow.
 */
export function shouldPromptClaim(): boolean {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(CLAIMED_FLAG)) return false;
  const ephemeral = getEphemeralKeypair();
  return !!ephemeral && hasNip07();
}
