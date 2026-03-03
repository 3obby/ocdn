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
}: {
  target: BoostTarget;
  size?: number;
  onBoosted?: (newPowDifficulty: number) => void;
  onMiningProgress?: (difficulty: number) => void;
}) {
  const [state, setState] = useState<BoostState>("idle");
  const [currentDifficulty, setCurrentDifficulty] = useState(0);
  const handleRef = useRef<MiningHandle | null>(null);

  useEffect(() => {
    onMiningProgress?.(currentDifficulty);
  }, [currentDifficulty, onMiningProgress]);

  async function submitBoost(signed: ReturnType<typeof signEvent>) {
    setState("submitting");
    try {
      const res = await fetch("/api/ephemeral/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedEvent: signed }),
      });
      const data = await res.json();
      broadcastToRelays(signed).catch(() => {});
      const result = data.targetPowDifficulty ?? data.powDifficulty ?? currentDifficulty;
      setState("done");
      onBoosted?.(Number(result));
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  const toggle = useCallback(async () => {
    if (state === "idle" || state === "done" || state === "error") {
      setState("mining");
      setCurrentDifficulty(0);
      try {
        const { privkey, pubkey } = getOrCreateSessionKeypair();
        const template = buildBoostEvent({
          pubkey,
          targetNostrId: target.nostrEventId,
        });
        const { handle } = startMining(
          template,
          256,
          privkey,
          (p) => setCurrentDifficulty(p.currentDifficulty),
        );
        handleRef.current = handle;
      } catch {
        setState("error");
      }
    } else if (state === "mining") {
      const bestEvent = handleRef.current?.stop();
      handleRef.current = null;
      if (!bestEvent) {
        setState("idle");
        return;
      }
      try {
        const { privkey } = getOrCreateSessionKeypair();
        const signed = signEvent(bestEvent, privkey);
        await submitBoost(signed);
      } catch {
        setState("error");
      }
    }
  }, [state, target.nostrEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <button
      onClick={toggle}
      className={`transition-colors ${
        state === "mining"
          ? "text-yellow-400/70 animate-pulse"
          : state === "submitting"
            ? "text-yellow-400/40 animate-pulse"
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
