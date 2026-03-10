"use client";

import { useRef, useEffect } from "react";

export function FeedCardSkeleton({ variant = "default" }: { variant?: "default" | "short" } = {}) {
  const lineCount = variant === "short" ? 1 : 3;
  const widths = variant === "short" ? ["88%"] : ["92%", "76%", "54%"];
  return (
    <div className="relative flex items-center gap-2 py-2.5 pl-4 pr-3 animate-pulse">
      <div className="min-w-0 flex-1 space-y-2">
        {Array.from({ length: lineCount }).map((_, i) => (
          <div
            key={i}
            className="h-3.5 rounded bg-white/[0.06]"
            style={{ width: widths[i] ?? "70%" }}
          />
        ))}
      </div>
      <div className="shrink-0 flex items-center gap-2 pr-3">
        <div className="h-3 w-8 rounded bg-white/[0.06]" />
        <div className="h-3 w-3 rounded bg-white/[0.05]" />
      </div>
    </div>
  );
}
import {
  type Post,
  formatSats,
  formatTime,
  shortPubkey,
} from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import { Eye, Pencil, ChevronRight } from "lucide-react";

function ConfirmBadge({ confirmations, ephemeral, ephemeralStatus }: { confirmations: number; ephemeral?: boolean; ephemeralStatus?: string }) {
  if (ephemeral && ephemeralStatus !== "upgraded") {
    return (
      <span className="flex flex-col items-end leading-none gap-0.5">
        <span className="text-white text-[10px]">nostr</span>
        <span className="text-orange-400 text-[9px] font-semibold">+BTC</span>
      </span>
    );
  }
  if (confirmations >= 6) return null;
  if (confirmations === 0) {
    return (
      <span className="animate-pulse text-white/20 text-[10px]">0c</span>
    );
  }
  return (
    <span className="text-white/10 text-[10px]">{confirmations}c</span>
  );
}


export function FeedCard({
  post,
  onExpand,
  onVisible,
  onReply,
  expandPreview,
  isExpanded,
}: {
  post: Post;
  onExpand: (id: string) => void;
  onVisible?: (id: string) => void;
  onReply?: (id: string) => void;
  expandPreview?: boolean;
  isExpanded?: boolean;
}) {
  const sz = useTextSize();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onVisible || post.id.startsWith("_")) return;
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onVisible(post.id);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.id, onVisible]);

  const isEphemeral = post.ephemeral === true;
  const isPaid = isEphemeral && post.ephemeralStatus === "upgraded";
  const isUnpaid = isEphemeral && !isPaid;

  const contentClamp = isExpanded ? "" : expandPreview ? "line-clamp-3" : "truncate";

  return (
    <div
      ref={cardRef}
      onClick={() => !isUnpaid && onExpand(post.id)}
      className={`relative transition-all duration-200 ${
        isUnpaid
          ? "opacity-40 cursor-default"
          : "cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.06]"
      } ${isExpanded ? "bg-white/[0.04]" : ""}`}
    >
      {/* Expanded: metadata row */}
      {isExpanded && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-white/30" style={{ fontSize: "11px" }}>
          <span className="text-burn/60 tabular-nums">{formatSats(post.burnTotal)}</span>
          <span>{shortPubkey(post.authorPubkey)}</span>
          <span className="text-white/15">&middot;</span>
          <span>{formatTime(post.timestamp)}</span>
          {post.confirmations < 6 && (
            <>
              <span className="text-white/15">&middot;</span>
              <span className={post.confirmations === 0 ? "animate-pulse text-white/20" : "text-white/15"}>
                {post.confirmations}c
              </span>
            </>
          )}
          <span className="text-white/15">&middot;</span>
          <span className="flex items-center gap-0.5 text-white/15">
            <Eye size={10} strokeWidth={1.5} />
            <span className="text-[10px] tabular-nums">{post.viewCount || 0}</span>
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className={`min-w-0 flex-1 overflow-hidden ${isExpanded ? "px-4 pb-3 pt-1" : "py-2.5 pl-4"}`}>
          <span
            className={`${ts(sz)} leading-snug ${isUnpaid ? "text-white/40" : "text-white"} block ${contentClamp} break-all transition-colors duration-200 ${post.text.startsWith(">") ? "border-l-2 border-white/15 pl-2 text-white/90" : ""}`}
          >
            {post.text}
          </span>
        </div>

        {!isExpanded && (
          <div className="shrink-0 flex items-center gap-2 pr-3">
            {!isUnpaid && (
              <>
                {(post.ephemeralCount ?? 0) > 0 && (
                  <span className="text-[10px] tabular-nums text-white/20 hidden sm:inline">
                    {post.ephemeralCount} n
                  </span>
                )}
                <span className="flex items-center gap-1 text-white/40">
                  <Eye size={12} strokeWidth={2} className="shrink-0" />
                  <span className="text-[11px] tabular-nums min-w-[1.5em] text-right">{post.viewCount || 0}</span>
                </span>
                <ChevronRight size={16} strokeWidth={2} className="text-white/20 shrink-0" />
              </>
            )}
            <ConfirmBadge confirmations={post.confirmations} ephemeral={isEphemeral} ephemeralStatus={post.ephemeralStatus} />
          </div>
        )}
      </div>

      {/* Expanded: icon actions */}
      {isExpanded && onReply && (
        <div className="flex items-center gap-2.5 px-4 pb-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReply(post.id);
            }}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center -ml-2 text-white/15 hover:text-white/30 transition-colors active:scale-95"
          >
            <Pencil size={14} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}

export function ThreadCard({
  post,
  isFocused,
  onReply,
}: {
  post: Post;
  isFocused: boolean;
  onReply?: (id: string) => void;
}) {
  const sz = useTextSize();

  return (
    <div
      className={`relative border-b border-border border-l-2 px-4 transition-all ${
        isFocused ? "py-4 border-l-burn/30 bg-white/[0.02]" : "py-2.5 border-l-transparent"
      }`}
    >
      <div
        className={`flex items-center gap-2 ${ts(sz)} leading-tight text-white/30 mb-1`}
      >
        <span className="text-burn/60 tabular-nums">
          {formatSats(post.burnTotal)}
        </span>
        <span>{shortPubkey(post.authorPubkey)}</span>
        <span className="text-white/15">&middot;</span>
        <span>{formatTime(post.timestamp)}</span>
        {post.confirmations < 6 && (
          <>
            <span className="text-white/15">&middot;</span>
            <span
              className={
                post.confirmations === 0
                  ? "animate-pulse text-white/20"
                  : "text-white/15"
              }
            >
              {post.confirmations}c
            </span>
          </>
        )}
        <span className="text-white/15">&middot;</span>
        <span className="flex items-center gap-0.5 text-white/15">
          <Eye size={10} strokeWidth={1.5} />
          <span className="text-[10px] tabular-nums">{post.viewCount || 0}</span>
        </span>
      </div>

      <div
        className={`${ts(sz)} leading-snug ${
          isFocused ? "text-white" : "text-white/60 line-clamp-2"
        } ${post.text.startsWith(">") ? "border-l-2 border-white/15 pl-2 text-white/70" : ""}`}
      >
        {post.text}
      </div>

      {onReply && (
        <div className="flex items-center gap-2.5 mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReply(post.id);
            }}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center -ml-2 text-white/15 hover:text-white/30 transition-colors active:scale-95"
          >
            <Pencil size={13} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
