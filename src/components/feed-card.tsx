"use client";

import { useRef, useEffect } from "react";
import {
  type Post,
  formatSats,
  formatTime,
  shortPubkey,
} from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import { Pencil, Eye } from "lucide-react";

function ConfirmBadge({ confirmations, ephemeral, ephemeralStatus }: { confirmations: number; ephemeral?: boolean; ephemeralStatus?: string }) {
  if (ephemeral && ephemeralStatus !== "upgraded") {
    return (
      <span className="animate-pulse text-white/15 text-[10px]">ephemeral</span>
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
  expandPreview,
}: {
  post: Post;
  onExpand: (id: string) => void;
  onVisible?: (id: string) => void;
  expandPreview?: boolean;
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

  const contentClamp = expandPreview ? "line-clamp-3" : "truncate";

  return (
    <div
      ref={cardRef}
      onClick={() => !isUnpaid && onExpand(post.id)}
      className={`relative flex items-center transition-colors ${
        isUnpaid
          ? "opacity-40 cursor-default"
          : "cursor-pointer hover:bg-white/[0.03]"
      }`}
    >
      <div className="min-w-0 flex-1 py-2.5 pl-4 pr-2">
        <span
          className={`${ts(sz)} leading-tight ${isUnpaid ? "text-white/40" : "text-white/90"} block ${contentClamp}`}
        >
          {post.text}
        </span>
      </div>

      <div className="shrink-0 flex items-center gap-2 pr-3">
        <ConfirmBadge confirmations={post.confirmations} ephemeral={isEphemeral} ephemeralStatus={post.ephemeralStatus} />
      </div>

      {!isUnpaid && (
        <div className="absolute right-0 inset-y-0 flex items-center justify-end pr-3 pl-8 bg-gradient-to-r from-transparent to-[#0d0d0d] pointer-events-none">
          <div className="flex items-center gap-1.5">
            <Eye size={12} strokeWidth={2} className="text-purple-300 shrink-0" />
            <span className="text-[11px] tabular-nums text-purple-200">{post.viewCount || 0}</span>
          </div>
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
      className={`relative border-b border-border px-4 transition-all ${
        isFocused ? "py-4" : "py-2"
      }`}
    >
      <div
        className={`flex items-center gap-2 ${ts(sz)} leading-tight text-white/30 mb-1`}
      >
        <span className="text-burn/60 tabular-nums">
          {formatSats(post.burnTotal)}
        </span>
        <span>{shortPubkey(post.authorPubkey)}</span>
        <span>&middot;</span>
        <span>{formatTime(post.timestamp)}</span>
        {post.confirmations < 6 && (
          <>
            <span>&middot;</span>
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
        <span>&middot;</span>
        <span className="flex items-center gap-0.5 text-white/15">
          <Eye size={10} strokeWidth={1.5} />
          <span className="text-[10px] tabular-nums">{post.viewCount || 0}</span>
        </span>
      </div>

      <div
        className={`${ts(sz)} leading-snug ${
          isFocused ? "text-white" : "text-white/60 line-clamp-2"
        }`}
      >
        {post.text}
      </div>

      {onReply && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReply(post.id);
          }}
          className="absolute bottom-2 right-3 p-1 text-white/15 hover:text-white/40 transition-colors"
        >
          <Pencil size={16} />
        </button>
      )}
    </div>
  );
}
