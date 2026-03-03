/**
 * Nostr client utilities for OCDN ephemeral layer.
 * Runs client-side only (browser).
 */

import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/curves/utils.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UnsignedEvent = {
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
};

export type SignedEvent = UnsignedEvent & {
  id: string;
  sig: string;
};

export type BroadcastResult = {
  relay: string;
  ok: boolean;
  message?: string;
};

// ── Serialization & ID ────────────────────────────────────────────────────────

export function serializeEvent(e: UnsignedEvent): string {
  return JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]);
}

export function getEventId(e: UnsignedEvent): string {
  const bytes = sha256(new TextEncoder().encode(serializeEvent(e)));
  return bytesToHex(bytes);
}

export function countLeadingZeroBits(id: string): number {
  let bits = 0;
  for (let i = 0; i < id.length; i += 2) {
    const byte = parseInt(id.slice(i, i + 2), 16);
    if (byte === 0) {
      bits += 8;
    } else {
      for (let b = 7; b >= 0; b--) {
        if ((byte >> b) & 1) break;
        bits++;
      }
      break;
    }
  }
  return bits;
}

// ── Keypair management ────────────────────────────────────────────────────────

export function generateEphemeralKeypair(): { privkey: Uint8Array; pubkey: string } {
  const privkey = schnorr.utils.randomSecretKey();
  const pubkey = bytesToHex(schnorr.getPublicKey(privkey));
  return { privkey, pubkey };
}

/** Get or create ephemeral session keypair from sessionStorage. Client-side only. */
export function getOrCreateSessionKeypair(): { privkey: Uint8Array; pubkey: string } {
  const stored = sessionStorage.getItem("ocdn_nostr_priv");
  if (stored) {
    try {
      const privkey = hexToBytes(stored);
      const pubkey = bytesToHex(schnorr.getPublicKey(privkey));
      return { privkey, pubkey };
    } catch {}
  }
  const kp = generateEphemeralKeypair();
  sessionStorage.setItem("ocdn_nostr_priv", bytesToHex(kp.privkey));
  return kp;
}

export function getSessionPubkey(): string | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem("ocdn_nostr_priv");
  if (!stored) return null;
  try {
    const privkey = hexToBytes(stored);
    return bytesToHex(schnorr.getPublicKey(privkey));
  } catch {
    return null;
  }
}

// ── Event building ────────────────────────────────────────────────────────────

export function buildPostEvent({
  content,
  pubkey,
  topic,
  parentContentHash,
  parentNostrId,
}: {
  content: string;
  pubkey: string;
  topic?: string | null;
  parentContentHash?: string | null;
  parentNostrId?: string | null;
}): UnsignedEvent {
  const tags: string[][] = [["t", "ocdn"]];
  if (topic) tags.push(["t", topic]);
  if (parentContentHash) tags.push(["ocdn-ref", parentContentHash]);
  if (parentNostrId) tags.push(["e", parentNostrId, "", "reply"]);

  return {
    kind: 1,
    content,
    tags,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
  };
}

export function buildBoostEvent({
  pubkey,
  targetNostrId,
}: {
  pubkey: string;
  targetNostrId?: string | null;
}): UnsignedEvent {
  const tags: string[][] = [];
  if (targetNostrId) tags.push(["e", targetNostrId]);

  return {
    kind: 7,
    content: "+",
    tags,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
  };
}

// ── Signing ───────────────────────────────────────────────────────────────────

export function signEvent(event: UnsignedEvent & { id: string }, privkey: Uint8Array): SignedEvent {
  const sig = bytesToHex(schnorr.sign(hexToBytes(event.id), privkey));
  return { ...event, sig };
}

export function verifySignedEvent(event: SignedEvent): boolean {
  try {
    const expectedId = getEventId(event);
    if (expectedId !== event.id) return false;
    return schnorr.verify(hexToBytes(event.sig), hexToBytes(event.id), hexToBytes(event.pubkey));
  } catch {
    return false;
  }
}

// ── Relay broadcast ───────────────────────────────────────────────────────────

const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nos.lol",
];

export async function broadcastToRelays(
  event: SignedEvent,
  relays: string[] = DEFAULT_RELAYS,
  timeoutMs = 4000,
): Promise<BroadcastResult[]> {
  return Promise.allSettled(
    relays.map((relay) => broadcastToRelay(event, relay, timeoutMs)),
  ).then((results) =>
    results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { relay: relays[i], ok: false, message: String(r.reason) },
    ),
  );
}

function broadcastToRelay(
  event: SignedEvent,
  relay: string,
  timeoutMs: number,
): Promise<BroadcastResult> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean, message?: string) => {
      if (done) return;
      done = true;
      try { ws.close(); } catch {}
      resolve({ relay, ok, message });
    };

    const timer = setTimeout(() => finish(false, "timeout"), timeoutMs);
    const ws = new WebSocket(relay);

    ws.onopen = () => {
      ws.send(JSON.stringify(["EVENT", event]));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg[0] === "OK") {
          clearTimeout(timer);
          finish(msg[2] === true, msg[3]);
        }
      } catch {}
    };

    ws.onerror = () => {
      clearTimeout(timer);
      finish(false, "connection error");
    };

    ws.onclose = () => {
      clearTimeout(timer);
      if (!done) finish(false, "closed");
    };
  });
}

// ── Session identity (localStorage) ──────────────────────────────────────────

export type SessionIdentity = {
  bitcoinPubkey: string;
  nostrPubkeys: string[];
  linkedAt: number;
};

export function getStoredIdentity(): SessionIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ocdn_identity");
    if (!raw) return null;
    return JSON.parse(raw) as SessionIdentity;
  } catch {
    return null;
  }
}

export function linkSessionIdentity(bitcoinPubkey: string): void {
  if (typeof window === "undefined") return;
  const nostrPubkey = getSessionPubkey();
  if (!nostrPubkey) return;

  const existing = getStoredIdentity();
  const nostrPubkeys = existing?.nostrPubkeys ?? [];
  if (!nostrPubkeys.includes(nostrPubkey)) {
    nostrPubkeys.push(nostrPubkey);
  }
  // Keep last 10 session pubkeys
  const trimmed = nostrPubkeys.slice(-10);

  const identity: SessionIdentity = {
    bitcoinPubkey,
    nostrPubkeys: trimmed,
    linkedAt: Date.now(),
  };
  localStorage.setItem("ocdn_identity", JSON.stringify(identity));
}
