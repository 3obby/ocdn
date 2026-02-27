"use client";

import { useState, useEffect, useRef } from "react";
import { type Post } from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import { FeedCard } from "./feed-card";

function isPubkey(q: string): boolean {
  return /^[0-9a-f]{66}$/i.test(q.trim());
}

export function SearchView({
  query,
  onExpand,
}: {
  query: string;
  onExpand: (id: string) => void;
}) {
  const sz = useTextSize();
  const [results, setResults] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);

    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = isPubkey(q)
          ? `/api/author/${q}`
          : `/api/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setResults(data.posts ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div
            className={`flex h-32 items-center justify-center ${ts(sz)} text-white/10 animate-pulse`}
          >
            —
          </div>
        ) : results.length === 0 ? (
          <div
            className={`flex h-32 items-center justify-center ${ts(sz)} text-white/10`}
          >
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
