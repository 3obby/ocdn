"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  getOrCreateSessionKeypair,
  buildBoostEvent,
  signEvent,
  broadcastToRelays,
} from "@/lib/nostr/client";
import { startMining } from "@/lib/nostr/pow";
import type { MiningHandle } from "@/lib/nostr/pow";
import { POW } from "@/lib/pow-config";
import { Zap } from "lucide-react";

type BoostState = "idle" | "mining" | "submitting" | "done" | "error";

export type BoostTarget = {
  nostrEventId?: string | null;
};

export function BoostButton({
  target,
  size = 14,
  onBoosted,
  onMiningProgress,
  containerRef,
}: {
  target: BoostTarget;
  size?: number;
  onBoosted?: (equivalentZeros: number) => void;
  onMiningProgress?: (difficulty: number) => void;
  containerRef?: React.RefObject<HTMLElement | null>;
}) {
  const [state, setState] = useState<BoostState>("idle");
  const [currentDifficulty, setCurrentDifficulty] = useState(0);

  const handleRef = useRef<MiningHandle | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSubmittedDiff = useRef(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const targetRef = useRef(target.nostrEventId);
  targetRef.current = target.nostrEventId;

  // Stable refs for callback props so closures always see latest
  const stateRef = useRef<BoostState>("idle");
  const onBoostedRef = useRef(onBoosted);
  onBoostedRef.current = onBoosted;

  useEffect(() => {
    onMiningProgress?.(currentDifficulty);
  }, [currentDifficulty, onMiningProgress]);

  const clearCycle = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Submit the current best event to the server. Returns true if submitted.
  const submitCurrent = useCallback(async (): Promise<boolean> => {
    const handle = handleRef.current;
    if (!handle) return false;

    const diff = handle.currentDifficulty;
    if (diff < POW.MIN_BOOST || diff <= lastSubmittedDiff.current) return false;

    lastSubmittedDiff.current = diff;
    const bestEvent = handle.stop();
    handleRef.current = null;
    if (!bestEvent) return false;

    try {
      const { privkey } = getOrCreateSessionKeypair();
      const signed = signEvent(bestEvent, privkey);
      const res = await fetch("/api/ephemeral/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedEvent: signed }),
      });
      const data = await res.json();
      broadcastToRelays(signed).catch(() => {});
      const eqZ = data.equivalentZeros ?? data.powDifficulty ?? diff;
      onBoostedRef.current?.(Number(eqZ));
      return true;
    } catch {
      return false;
    }
  }, []);

  // Start a fresh mining worker
  const spawnWorker = useCallback(() => {
    try {
      const { privkey, pubkey } = getOrCreateSessionKeypair();
      const template = buildBoostEvent({
        pubkey,
        targetNostrId: targetRef.current,
      });
      const { handle } = startMining(
        template,
        Number.MAX_SAFE_INTEGER,
        privkey,
        (p) => setCurrentDifficulty(p.currentDifficulty),
      );
      handleRef.current = handle;
    } catch {
      // worker creation failed — stop gracefully
      stateRef.current = "error";
      setState("error");
      clearCycle();
      setTimeout(() => { stateRef.current = "idle"; setState("idle"); }, 2000);
    }
  }, [clearCycle]);

  // Submit best and stop everything (for off-screen / manual stop)
  const finishMining = useCallback(async () => {
    clearCycle();
    await submitCurrent();
    handleRef.current?.stop();
    handleRef.current = null;
    stateRef.current = "done";
    setState("done");
    setTimeout(() => { stateRef.current = "idle"; setState("idle"); }, 1500);
  }, [clearCycle, submitCurrent]);

  // Recurring cycle: submit improvement, restart worker, keep going
  const cycleSubmit = useCallback(async () => {
    if (stateRef.current !== "mining") return;

    const submitted = await submitCurrent();
    // Restart worker for the next cycle (regardless of whether we submitted —
    // the old worker is exhausted once stopped, and if we didn't submit we
    // just keep the current worker running)
    if (submitted) {
      spawnWorker();
    }
  }, [submitCurrent, spawnWorker]);

  // Visibility: when post scrolls off-screen, finish immediately
  useEffect(() => {
    const el = containerRef?.current ?? btnRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && stateRef.current === "mining") {
          finishMining();
        }
      },
      { threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, finishMining]);

  const toggle = useCallback(() => {
    if (stateRef.current === "mining") {
      finishMining();
      return;
    }

    if (stateRef.current !== "idle" && stateRef.current !== "done" && stateRef.current !== "error") return;

    stateRef.current = "mining";
    setState("mining");
    setCurrentDifficulty(0);
    lastSubmittedDiff.current = 0;

    spawnWorker();

    intervalRef.current = setInterval(
      () => cycleSubmit(),
      POW.AUTO_SUBMIT_INTERVAL_MS,
    );
  }, [finishMining, spawnWorker, cycleSubmit]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCycle();
      handleRef.current?.stop();
      handleRef.current = null;
    };
  }, [clearCycle]);

  return (
    <button
      ref={btnRef}
      onClick={toggle}
      className={`transition-colors ${
        state === "mining"
          ? "text-[#f4b63f]/70 animate-pulse"
          : state === "submitting"
            ? "text-[#f4b63f]/40 animate-pulse"
            : state === "done"
              ? "text-green-400/50"
              : state === "error"
                ? "text-red-400/40"
                : "text-white/15 hover:text-white/30"
      }`}
    >
      <Zap size={size} strokeWidth={1.5} />
    </button>
  );
}
