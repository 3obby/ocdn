"use client";

/**
 * Main-thread interface to the NIP-13 PoW WebWorker.
 */

import type { UnsignedEvent, SignedEvent } from "./client";
import { signEvent, countLeadingZeroBits } from "./client";

export type MiningProgress = {
  currentDifficulty: number;
  nonce: number;
};

export type MiningHandle = {
  /** Stop mining and return the best event found so far (partial PoW is valid). */
  stop: () => (UnsignedEvent & { id: string }) | null;
  /** Current best difficulty achieved. */
  currentDifficulty: number;
};

/**
 * Start NIP-13 PoW mining in a WebWorker.
 *
 * @param eventTemplate  Unsigned event (without nonce tag, without id/sig)
 * @param targetDifficulty  Number of leading zero bits to target
 * @param privkey  Session privkey for signing once PoW is done
 * @param onProgress  Called periodically with current difficulty
 * @returns  Promise that resolves with the signed event, plus a handle to stop early
 */
export function startMining(
  eventTemplate: UnsignedEvent,
  targetDifficulty: number,
  privkey: Uint8Array,
  onProgress?: (p: MiningProgress) => void,
): { promise: Promise<SignedEvent>; handle: MiningHandle } {
  let worker: Worker | null = null;
  let bestUnsigned: (UnsignedEvent & { id: string }) | null = null;
  let currentDifficulty = 0;
  let resolvePromise: (event: SignedEvent) => void;
  let rejectPromise: (err: Error) => void;

  const promise = new Promise<SignedEvent>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const handle: MiningHandle = {
    stop: () => {
      if (worker) {
        worker.terminate();
        worker = null;
      }
      return bestUnsigned;
    },
    get currentDifficulty() {
      return currentDifficulty;
    },
  };

  // Spawn worker
  try {
    worker = new Worker(new URL("./pow.worker.ts", import.meta.url));
  } catch (err) {
    rejectPromise!(new Error(`Failed to create worker: ${err}`));
    return { promise, handle };
  }

  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data as
      | { type: "progress"; currentDifficulty: number; nonce: number }
      | { type: "done"; event: UnsignedEvent & { id: string }; difficulty: number; nonce: number };

    if (msg.type === "progress") {
      currentDifficulty = msg.currentDifficulty;
      onProgress?.({ currentDifficulty: msg.currentDifficulty, nonce: msg.nonce });
    } else if (msg.type === "done") {
      currentDifficulty = msg.difficulty;
      bestUnsigned = msg.event;
      worker?.terminate();
      worker = null;
      const signed = signEvent(msg.event, privkey);
      resolvePromise(signed);
    }
  };

  worker.onerror = (e) => {
    worker?.terminate();
    worker = null;
    rejectPromise(new Error(e.message));
  };

  worker.postMessage({ eventTemplate, targetDifficulty });

  return { promise, handle };
}

/**
 * Quick single-shot PoW: mine at low difficulty for fast (~100ms) posting.
 * Returns the signed event.
 */
export function mineAndSign(
  eventTemplate: UnsignedEvent,
  privkey: Uint8Array,
  targetDifficulty = 8,
  onProgress?: (p: MiningProgress) => void,
): { promise: Promise<SignedEvent>; handle: MiningHandle } {
  return startMining(eventTemplate, targetDifficulty, privkey, onProgress);
}

/** Verify the PoW difficulty of a signed event. */
export function verifyPoW(event: { id: string }): number {
  return countLeadingZeroBits(event.id);
}
