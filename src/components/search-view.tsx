"use client";

import { useState } from "react";
import { type Post, POSTS, shortPubkey } from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import { FeedCard } from "./feed-card";

const DEFAULT_PUBKEY =
  "02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1";

export function SearchView({
  onExpand,
}: {
  onExpand: (id: string) => void;
}) {
  const sz = useTextSize();
  const [query, setQuery] = useState("");

  const results: Post[] = query.trim()
    ? POSTS.filter(
        (p) =>
          p.text.toLowerCase().includes(query.toLowerCase()) ||
          p.authorPubkey.includes(query) ||
          (p.topicName && p.topicName.includes(query.toLowerCase())),
      )
    : POSTS.filter((p) => p.authorPubkey === DEFAULT_PUBKEY);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={shortPubkey(DEFAULT_PUBKEY)}
          className={`w-full bg-transparent ${ts(sz)} text-white placeholder:text-white/15 outline-none`}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 ? (
          <div className={`flex h-32 items-center justify-center ${ts(sz)} text-white/10`}>
            —
          </div>
        ) : (
          results.map((p) => (
            <FeedCard key={p.id} post={p} onExpand={onExpand} />
          ))
        )}
      </div>
    </div>
  );
}
