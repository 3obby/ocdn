/// <reference lib="webworker" />

/**
 * NIP-13 Proof-of-Work miner — runs in a Web Worker off the main thread.
 *
 * Input message:  { eventTemplate: UnsignedEvent, targetDifficulty: number }
 * Output messages:
 *   { type: "progress", currentDifficulty: number, nonce: number }
 *   { type: "done", event: UnsignedEvent & { id: string }, difficulty: number, nonce: number }
 */

import { sha256 } from "@noble/hashes/sha2.js";

type UnsignedEvent = {
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
};

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function serializeEvent(e: UnsignedEvent): string {
  return JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]);
}

function getEventId(e: UnsignedEvent): string {
  return bytesToHex(sha256(new TextEncoder().encode(serializeEvent(e))));
}

function countLeadingZeroBits(id: string): number {
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

self.onmessage = (
  e: MessageEvent<{ eventTemplate: UnsignedEvent; targetDifficulty: number }>,
) => {
  const { eventTemplate, targetDifficulty } = e.data;
  const baseTags = eventTemplate.tags.filter((t) => t[0] !== "nonce");

  let nonce = 0;
  let bestDifficulty = 0;
  let bestEvent: (UnsignedEvent & { id: string }) | null = null;

  while (true) {
    const tags = [...baseTags, ["nonce", String(nonce), String(targetDifficulty)]];
    const event: UnsignedEvent = { ...eventTemplate, tags };
    const id = getEventId(event);
    const diff = countLeadingZeroBits(id);

    if (diff > bestDifficulty) {
      bestDifficulty = diff;
      bestEvent = { ...event, id };
    }

    if (diff >= targetDifficulty) {
      self.postMessage({ type: "done", event: bestEvent, difficulty: diff, nonce });
      return;
    }

    if (nonce % 10_000 === 0 && nonce > 0) {
      self.postMessage({ type: "progress", currentDifficulty: bestDifficulty, nonce });
    }

    nonce++;
  }
};
