"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  type EphemeralPost,
  shortNostrPubkey,
  formatTime,
} from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import { BoostButton } from "./boost-button";
import { Pencil } from "lucide-react";

function useCountdown(expiresAt: string) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));
  const targetRef = useRef(new Date(expiresAt).getTime());

  useEffect(() => {
    targetRef.current = new Date(expiresAt).getTime();
    setRemaining(Math.max(0, targetRef.current - Date.now()));
  }, [expiresAt]);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, targetRef.current - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (remaining <= 0) return "expired";
  const totalMins = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function EphemeralPostCard({
  post,
  onMakePermanent,
  onReply,
  optimistic = false,
}: {
  post: EphemeralPost;
  onMakePermanent?: (post: EphemeralPost) => void;
  onReply?: (post: EphemeralPost) => void;
  optimistic?: boolean;
}) {
  const sz = useTextSize();
  const [liveZeros, setLiveZeros] = useState(0);
  const displayZeros = Math.max(post.powDifficulty, liveZeros);
  const countdown = useCountdown(post.expiresAt);
  const isUrgent = countdown.endsWith("m") || countdown === "expired";

  const handleMiningProgress = useCallback((d: number) => {
    setLiveZeros(d);
  }, []);

  return (
    <div data-nostr-id={post.nostrEventId} className="relative border border-dashed border-white/[0.08] px-4 py-2.5 bg-black">
      {/* Header: zeros · countdown · author · time */}
      <div className={`flex items-center gap-1.5 text-[10px] tabular-nums mb-1`}>
        {displayZeros > 0 && (
          <>
            <span className={`font-medium ${liveZeros > 0 ? "text-yellow-400/60 animate-pulse" : "text-white/40"}`}>
              {displayZeros}z
            </span>
            <span className="text-white/10">&middot;</span>
          </>
        )}
        <span className={isUrgent ? "text-orange-400/60" : "text-white/25"}>
          {countdown}
        </span>
        <span className="ml-auto text-white/20">
          {shortNostrPubkey(post.nostrPubkey)}
        </span>
        <span className="text-white/10">&middot;</span>
        <span className="text-white/20">
          {formatTime(new Date(post.createdAt).getTime())}
        </span>
      </div>

      {/* Content */}
      <p className={`${ts(sz)} text-white/90 leading-snug whitespace-pre-wrap`}>
        {post.content}
      </p>

      {/* Icon CTAs */}
      {!optimistic && (
        <div className="flex items-center gap-2.5 mt-1.5">
          <span onClick={(e) => e.stopPropagation()}>
            <BoostButton
              target={{ nostrEventId: post.nostrEventId }}
              size={13}
              onBoosted={(d) => setLiveZeros(0)}
              onMiningProgress={handleMiningProgress}
            />
          </span>
          {onReply && (
            <button
              onClick={(e) => { e.stopPropagation(); onReply(post); }}
              className="text-white/15 hover:text-white/30 transition-colors"
            >
              <Pencil size={13} strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
