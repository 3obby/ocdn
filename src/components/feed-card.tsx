"use client";

import {
  type Post,
  formatSats,
  formatTime,
  shortPubkey,
} from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import { Pencil } from "lucide-react";

function ConfirmBadge({ confirmations, ephemeral }: { confirmations: number; ephemeral?: boolean }) {
  if (ephemeral) {
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

function ProtocolBadge({ protocol }: { protocol: string }) {
  if (protocol === "ocdn") return null;
  return (
    <span className="text-[10px] text-white/20 uppercase tracking-wider">
      {protocol}
    </span>
  );
}

export function FeedCard({
  post,
  onExpand,
}: {
  post: Post;
  onExpand: (id: string) => void;
}) {
  const sz = useTextSize();

  const isEphemeral = post.ephemeral === true;

  return (
    <div
      onClick={() => !isEphemeral && onExpand(post.id)}
      className={`flex items-center border-b border-border transition-colors ${
        isEphemeral
          ? "opacity-40 cursor-default"
          : "cursor-pointer hover:bg-white/[0.03]"
      }`}
    >
      <div className="w-[14%] shrink-0 py-3 pl-3 pr-3 text-right">
        <span
          className={`${ts(sz)} leading-tight ${isEphemeral ? "text-white/10" : "text-burn/60"} tabular-nums`}
        >
          {isEphemeral ? "\u2014" : formatSats(post.burnTotal)}
        </span>
      </div>

      <div className="min-w-0 flex-1 py-3 pl-2 pr-4">
        <span
          className={`${ts(sz)} leading-tight ${isEphemeral ? "text-white/40" : "text-white/90"} block truncate`}
        >
          {post.text}
        </span>
      </div>

      <div className="shrink-0 flex items-center gap-1.5 pr-3">
        {!isEphemeral && <ProtocolBadge protocol={post.protocol} />}
        <ConfirmBadge confirmations={post.confirmations} ephemeral={isEphemeral} />
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
        {post.protocol !== "ocdn" && (
          <>
            <span>&middot;</span>
            <span className="text-white/20 uppercase text-[10px]">
              {post.protocol}
            </span>
          </>
        )}
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
