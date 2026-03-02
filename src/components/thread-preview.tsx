"use client";

import { useState, useEffect, useRef } from "react";
import { type ThreadItem, type Post, formatSats, formatTime, shortPubkey } from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import { Eye } from "lucide-react";

function ReplyCard({ post }: { post: Post }) {
  const sz = useTextSize();
  return (
    <div className="py-1.5">
      <div className={`flex items-center gap-1.5 ${ts(sz)} text-white/25 mb-0.5`}>
        <span className="text-burn/50 tabular-nums text-[10px]">{formatSats(post.burnTotal)}</span>
        <span className="text-[10px]">{shortPubkey(post.authorPubkey)}</span>
        <span className="text-[10px]">&middot;</span>
        <span className="text-[10px]">{formatTime(post.timestamp)}</span>
        <span className="flex items-center gap-0.5 text-white/15 ml-auto">
          <Eye size={9} strokeWidth={1.5} />
          <span className="text-[9px] tabular-nums">{post.viewCount || 0}</span>
        </span>
      </div>
      <div className={`${ts(sz)} leading-snug text-white/55 line-clamp-2`}>
        {post.text}
      </div>
    </div>
  );
}

export function ThreadPreview({
  postId,
  onExpand,
}: {
  postId: string;
  onExpand: (id: string) => void;
}) {
  const sz = useTextSize();
  const [childMap, setChildMap] = useState<Map<string, ThreadItem[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);

    fetch(`/api/thread/${postId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.thread) return;
        const items: ThreadItem[] = data.thread;
        const focalIdx = items.findIndex((t) => t.id === postId);
        if (focalIdx < 0) return;

        const descendants = items.slice(focalIdx + 1);
        const map = new Map<string, ThreadItem[]>();
        for (const item of descendants) {
          const parent = item.parentId ?? postId;
          const arr = map.get(parent) ?? [];
          arr.push(item);
          map.set(parent, arr);
        }
        setChildMap(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading || !childMap) return null;

  const directChildren = childMap.get(postId) ?? [];
  if (directChildren.length === 0) return null;

  const maxChildren = 3;
  const maxGrandchildren = 2;
  const shownChildren = directChildren.slice(0, maxChildren);
  const hiddenChildCount = directChildren.length - shownChildren.length;

  return (
    <div ref={containerRef} className="border-l border-white/[0.06] ml-4">
      {shownChildren.map((child) => {
        const grandchildren = childMap.get(child.id) ?? [];
        const shownGrandchildren = grandchildren.slice(0, maxGrandchildren);
        const hiddenGrandchildCount = grandchildren.length - shownGrandchildren.length;

        return (
          <div key={child.id} className="pl-3">
            <ReplyCard post={child} />
            {shownGrandchildren.length > 0 && (
              <div className="border-l border-white/[0.06] ml-3">
                {shownGrandchildren.map((gc) => (
                  <div key={gc.id} className="pl-3">
                    <ReplyCard post={gc} />
                  </div>
                ))}
                {hiddenGrandchildCount > 0 && (
                  <button
                    onClick={() => onExpand(child.id)}
                    className={`pl-3 py-1 ${ts(sz)} text-white/15 hover:text-white/30 transition-colors text-[11px]`}
                  >
                    +{hiddenGrandchildCount} more
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      {hiddenChildCount > 0 && (
        <button
          onClick={() => onExpand(postId)}
          className={`pl-3 py-1.5 ${ts(sz)} text-white/15 hover:text-white/30 transition-colors text-[11px]`}
        >
          +{hiddenChildCount} more {hiddenChildCount === 1 ? "reply" : "replies"}
        </button>
      )}
    </div>
  );
}
