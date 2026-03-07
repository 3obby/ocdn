"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  type EphemeralPost,
  shortNostrPubkey,
  formatTime,
} from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import { BoostButton } from "./boost-button";
import { PostContent } from "./post-content";
import { equivalentZeros } from "@/lib/pow-config";
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
  isExpanded = false,
  onExpand,
  onMakePermanent,
  onInscribe,
  onViewTx,
  onReply,
  optimistic = false,
}: {
  post: EphemeralPost;
  isExpanded?: boolean;
  onExpand?: (id: string) => void;
  onMakePermanent?: (post: EphemeralPost) => void;
  onInscribe?: (post: EphemeralPost) => void;
  onViewTx?: (contentHash: string) => void;
  onReply?: (post: EphemeralPost) => void;
  optimistic?: boolean;
}) {
  const sz = useTextSize();
  const cardRef = useRef<HTMLDivElement>(null);
  const [liveDifficulty, setLiveDifficulty] = useState(0);
  const [serverEqZ, setServerEqZ] = useState(() => equivalentZeros(post.upvoteWeight));
  const countdown = useCountdown(post.expiresAt);
  const isUrgent = countdown.endsWith("m") || countdown === "expired";

  const liveContribution = liveDifficulty > 0 ? (1n << BigInt(liveDifficulty)) : 0n;
  const baseWeight = BigInt(post.upvoteWeight);
  const displayZeros = liveDifficulty > 0
    ? equivalentZeros(baseWeight + liveContribution)
    : serverEqZ;
  const isMining = liveDifficulty > 0;

  const handleMiningProgress = useCallback((d: number) => {
    setLiveDifficulty(d);
  }, []);

  const handleBoosted = useCallback((eqZ: number) => {
    setLiveDifficulty(0);
    setServerEqZ(eqZ);
  }, []);

  // ── Collapsed: single-line preview ──
  if (!isExpanded && !optimistic) {
    const plainText = post.content.replace(/\[[^\]]*\]\([^)]+\)/g, "").replace(/\n+/g, " ").trim();
    return (
      <div
        data-nostr-id={post.nostrEventId}
        onClick={() => onExpand?.(post.nostrEventId)}
        className="relative cursor-pointer hover:bg-white/[0.03] transition-all duration-200 py-2 px-4"
      >
        <div className="flex items-center min-w-0">
          <span className={`${ts(sz)} leading-snug text-white/70 truncate flex-1 min-w-0`}>
            {plainText}
          </span>
          <div className="shrink-0 flex items-center gap-1.5 pl-3 text-[10px] tabular-nums">
            {displayZeros > 0 && (
              <span className="text-white/30">{displayZeros}z</span>
            )}
            <span className={isUrgent ? "text-orange-400/50" : "text-white/20"}>
              {countdown}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Expanded: full content + metadata + actions ──
  return (
    <div
      ref={cardRef}
      data-nostr-id={post.nostrEventId}
      onClick={() => onExpand?.(post.nostrEventId)}
      className="relative border border-dashed border-white/[0.08] px-4 py-2.5 bg-white/[0.04] cursor-pointer"
    >
      <div className={`flex items-center gap-1.5 text-[10px] tabular-nums mb-1`}>
        {displayZeros > 0 && (
          <>
            <span className={`font-medium ${isMining ? "text-yellow-400/60 animate-pulse" : "text-white/40"}`}>
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

      <p className={`${ts(sz)} text-white/90 leading-snug whitespace-pre-wrap`}>
        <PostContent content={post.content} />
      </p>

      {!optimistic && (
        <div className="flex items-center gap-2.5 mt-1.5">
          {post.promotedToHash && onViewTx ? (
            <button
              onClick={(e) => { e.stopPropagation(); onViewTx(post.promotedToHash!); }}
              className="text-white/20 hover:text-white/40 transition-colors text-[11px] font-medium leading-none"
            >
              ₿tx
            </button>
          ) : onInscribe && (!post.parentNostrId || post.parentContentHash) && (
            <button
              onClick={(e) => { e.stopPropagation(); onInscribe(post); }}
              className="text-orange-400/30 hover:text-orange-400/60 transition-colors text-[11px] font-medium leading-none"
            >
              +₿
            </button>
          )}
          <span onClick={(e) => e.stopPropagation()}>
            <BoostButton
              target={{ nostrEventId: post.nostrEventId }}
              size={13}
              onBoosted={handleBoosted}
              onMiningProgress={handleMiningProgress}
              containerRef={cardRef}
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
