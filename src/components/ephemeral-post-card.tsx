"use client";

import { useState } from "react";
import {
  type EphemeralPost,
  formatEphemeralExpiry,
  formatPoWWeight,
  shortNostrPubkey,
  formatTime,
} from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import { BoostButton } from "./boost-button";

export function EphemeralPostCard({
  post,
  onMakePermanent,
  optimistic = false,
}: {
  post: EphemeralPost;
  onMakePermanent?: (post: EphemeralPost) => void;
  optimistic?: boolean;
}) {
  const sz = useTextSize();
  const expiry = formatEphemeralExpiry(post.expiresAt);
  const powLabel = formatPoWWeight(post.upvoteWeight);
  const [localWeight, setLocalWeight] = useState(post.upvoteWeight);

  const expiryColor = expiry.urgent ? "text-orange-400/60" : "text-white/20";

  return (
    <div
      className="relative border border-dashed border-white/[0.10] opacity-75 px-4 py-2.5 bg-black"
    >
      {/* Header row */}
      <div className={`flex items-center gap-1.5 ${ts(sz)} text-white/20 mb-1`}>
        <span className="font-mono text-[10px]">{shortNostrPubkey(post.nostrPubkey)}</span>
        <span>&middot;</span>
        <span className="text-[10px]">{formatTime(new Date(post.createdAt).getTime())}</span>
        {powLabel && (
          <>
            <span>&middot;</span>
            <span className="text-[10px] text-white/30">⚡{powLabel}</span>
          </>
        )}
        {/* Expiry chip */}
        <span className="ml-auto shrink-0">
          <span className={`text-[10px] tabular-nums ${expiryColor}`}>
            {expiry.label}
          </span>
        </span>
      </div>

      {/* Content */}
      <p className={`${ts(sz)} text-white/60 leading-snug whitespace-pre-wrap`}>
        {post.content}
      </p>

      {/* CTA strip */}
      {!optimistic && (
        <div className="flex items-center gap-3 mt-2 pt-1.5 border-t border-white/[0.06]">
          <BoostButton
            post={post}
            onBoosted={(newWeight) => setLocalWeight(newWeight)}
          />
          {onMakePermanent && (
            <button
              onClick={() => onMakePermanent(post)}
              className={`${ts(sz)} text-white/20 hover:text-white/50 transition-colors text-[11px]`}
            >
              make permanent
            </button>
          )}
          <span className={`ml-auto text-[10px] tabular-nums text-white/15`}>
            {localWeight > 0 ? `⚡${formatPoWWeight(localWeight)}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
