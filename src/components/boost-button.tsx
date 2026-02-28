"use client";

import { useState, useRef, useCallback } from "react";
import type { EphemeralPost } from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import {
  getOrCreateSessionKeypair,
  buildBoostEvent,
  signEvent,
  broadcastToRelays,
} from "@/lib/nostr/client";
import { startMining } from "@/lib/nostr/pow";
import type { MiningHandle } from "@/lib/nostr/pow";

type BoostState = "idle" | "mining" | "submitting" | "done" | "error";

export function BoostButton({
  post,
  onBoosted,
}: {
  post: EphemeralPost;
  onBoosted?: (newWeight: number) => void;
}) {
  const sz = useTextSize();
  const [state, setState] = useState<BoostState>("idle");
  const [currentDifficulty, setCurrentDifficulty] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const handleRef = useRef<MiningHandle | null>(null);

  const startBoost = useCallback(async () => {
    if (state !== "idle") return;
    setState("mining");
    setCurrentDifficulty(0);
    setErrorMsg(null);

    try {
      const { privkey, pubkey } = getOrCreateSessionKeypair();
      const template = buildBoostEvent({
        pubkey,
        targetNostrId: post.nostrEventId,
      });

      const TARGET_DIFFICULTY = 20;
      const { promise, handle } = startMining(
        template,
        TARGET_DIFFICULTY,
        privkey,
        (p) => setCurrentDifficulty(p.currentDifficulty),
      );
      handleRef.current = handle;

      // Auto-submit when done
      const signed = await promise;
      handleRef.current = null;
      await submitBoost(signed);
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "failed");
    }
  }, [state, post.nostrEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopAndSubmit = useCallback(async () => {
    if (state !== "mining" || !handleRef.current) return;
    const bestEvent = handleRef.current.stop();
    handleRef.current = null;
    if (!bestEvent) {
      setState("idle");
      return;
    }
    try {
      const { privkey } = getOrCreateSessionKeypair();
      const signed = signEvent(bestEvent, privkey);
      await submitBoost(signed);
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "failed");
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitBoost(signed: ReturnType<typeof signEvent>) {
    setState("submitting");
    try {
      // Server-side persist
      const res = await fetch("/api/ephemeral/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedEvent: signed }),
      });
      const data = await res.json();
      // Client-side relay broadcast (fire-and-forget)
      broadcastToRelays(signed).catch(() => {});
      setState("done");
      if (data.upvoteWeight && onBoosted) {
        onBoosted(Number(BigInt(data.upvoteWeight)));
      }
    } catch {
      setState("error");
      setErrorMsg("submit failed");
    }
  }

  const btnClass = `${ts(sz)} text-[11px] transition-colors`;

  if (state === "idle") {
    return (
      <button onClick={startBoost} className={`${btnClass} text-white/25 hover:text-white/50`}>
        +⚡
      </button>
    );
  }

  if (state === "mining") {
    return (
      <div className="flex items-center gap-2">
        <span className={`${btnClass} text-white/40 animate-pulse`}>
          ⚡ {currentDifficulty > 0 ? `x${currentDifficulty}↑` : "…"}
        </span>
        <button onClick={stopAndSubmit} className={`${btnClass} text-white/20 hover:text-white/40`}>
          stop
        </button>
      </div>
    );
  }

  if (state === "submitting") {
    return (
      <span className={`${btnClass} text-white/20 animate-pulse`}>⚡ posting…</span>
    );
  }

  if (state === "done") {
    return (
      <span className={`${btnClass} text-white/40`}>⚡ boosted</span>
    );
  }

  return (
    <button
      onClick={() => { setState("idle"); setErrorMsg(null); }}
      className={`${btnClass} text-red-400/40 hover:text-red-400/60`}
    >
      {errorMsg ?? "error"} — retry
    </button>
  );
}
