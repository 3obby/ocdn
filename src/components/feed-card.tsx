"use client";

import { type Post, formatSats, formatTime, shortPubkey } from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import { Pencil } from "lucide-react";

export function FeedCard({
  post,
  onExpand,
}: {
  post: Post;
  onExpand: (id: string) => void;
}) {
  const sz = useTextSize();

  return (
    <div
      onClick={() => onExpand(post.id)}
      className="flex cursor-pointer items-center border-b border-border transition-colors hover:bg-white/[0.03]"
    >
      {/* left gutter: sats value, dimmer orange */}
      <div className="w-[14%] shrink-0 py-3 pl-3 pr-3 text-right">
        <span className={`${ts(sz)} leading-tight text-burn/60 tabular-nums`}>
          {formatSats(post.burnTotal)}
        </span>
      </div>

      {/* right: content text, consistent truncation edge */}
      <div className="min-w-0 flex-1 py-3 pl-2 pr-4">
        <span className={`${ts(sz)} leading-tight text-white/90 block truncate`}>
          {post.text}
        </span>
      </div>
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
      {/* header */}
      <div className={`flex items-center gap-2 ${ts(sz)} leading-tight text-white/30 mb-1`}>
        <span className="text-burn/60 tabular-nums">{formatSats(post.burnTotal)}</span>
        <span>{shortPubkey(post.authorPubkey)}</span>
        <span>·</span>
        <span>{formatTime(post.timestamp)}</span>
      </div>

      {/* content */}
      <div
        className={`${ts(sz)} leading-snug ${
          isFocused ? "text-white" : "text-white/60 line-clamp-2"
        }`}
      >
        {post.text}
      </div>

      {/* reply button */}
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
