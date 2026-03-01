"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { type ThreadItem, type EphemeralPost } from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import { ThreadCard } from "./feed-card";
import { EphemeralPostCard } from "./ephemeral-post-card";
import { Loader2 } from "lucide-react";

function Skeleton({ lines = 1 }: { lines?: number }) {
  return (
    <div className="px-4 py-3 space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded bg-white/[0.06]"
          style={{ width: `${55 + Math.random() * 35}%` }}
        />
      ))}
    </div>
  );
}

export function InlineThread({
  postId,
  onReply,
  initialEphemeralPosts,
}: {
  postId: string;
  onReply: (id: string) => void;
  initialEphemeralPosts?: EphemeralPost[];
}) {
  const sz = useTextSize();
  const [children, setChildren] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ephemeralPosts, setEphemeralPosts] = useState<EphemeralPost[]>(initialEphemeralPosts ?? []);
  const [ephemeralCount, setEphemeralCount] = useState(0);
  const [ephemeralExpanded, setEphemeralExpanded] = useState(true);
  const [ephemeralLoading, setEphemeralLoading] = useState(false);
  const ephemeralLoadingRef = useRef(false);

  useEffect(() => {
    if (!initialEphemeralPosts?.length) return;
    setEphemeralPosts((prev) => {
      const existingIds = new Set(prev.map((p) => p.nostrEventId));
      const incoming = initialEphemeralPosts.filter((p) => !existingIds.has(p.nostrEventId));
      if (incoming.length === 0) return prev;
      setEphemeralExpanded(true);
      setEphemeralCount((c) => c + incoming.length);
      return [...incoming, ...prev];
    });
  }, [initialEphemeralPosts]);

  const fetchEphemeral = useCallback(async () => {
    if (ephemeralLoadingRef.current) return;
    ephemeralLoadingRef.current = true;
    setEphemeralLoading(true);
    try {
      const res = await fetch(`/api/ephemeral?parentHash=${postId}&sort=top&limit=50`);
      const data = await res.json();
      setEphemeralPosts(data.posts ?? []);
      setEphemeralCount(data.posts?.length ?? 0);
    } catch {}
    ephemeralLoadingRef.current = false;
    setEphemeralLoading(false);
  }, [postId]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`/api/thread/${postId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => {
        const items: ThreadItem[] = data.thread ?? [];
        const focalIdx = items.findIndex((t) => t.id === postId);
        if (focalIdx >= 0) {
          setChildren(items.slice(focalIdx + 1));
          const focalItem = items[focalIdx] as ThreadItem & { ephemeralCount?: number; ephemeralReplies?: EphemeralPost[] };
          if (focalItem.ephemeralCount) setEphemeralCount(focalItem.ephemeralCount);
          if (focalItem.ephemeralReplies?.length && ephemeralPosts.length === 0) {
            setEphemeralPosts(focalItem.ephemeralReplies);
          }
          if ((focalItem.ephemeralCount ?? 0) > (focalItem.ephemeralReplies?.length ?? 0)) {
            fetchEphemeral();
          }
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleEphemeral = useCallback(() => {
    if (!ephemeralExpanded) {
      setEphemeralExpanded(true);
      fetchEphemeral();
    } else {
      setEphemeralExpanded(false);
    }
  }, [ephemeralExpanded, fetchEphemeral]);

  if (error) {
    return (
      <div className={`px-4 py-3 ${ts(sz)} text-white/10`}>failed to load thread</div>
    );
  }

  return (
    <div className="border-l border-white/[0.06] ml-4">
      {loading ? (
        <div className="divide-y divide-white/[0.04]">
          <Skeleton lines={2} />
          <Skeleton lines={1} />
          <Skeleton lines={2} />
        </div>
      ) : (
        <>
          {children.length > 0 && (
            <div className="divide-y divide-white/[0.04]">
              {children.map((item) => (
                <ThreadCard
                  key={item.id}
                  post={item}
                  isFocused={false}
                  onReply={onReply}
                />
              ))}
            </div>
          )}

          {children.length === 0 && ephemeralPosts.length === 0 && !ephemeralLoading && ephemeralCount === 0 && (
            <div className={`px-4 py-3 ${ts(sz)} text-white/10`}>no replies yet</div>
          )}
        </>
      )}

      {/* Ephemeral section — expanded by default */}
      {(ephemeralCount > 0 || ephemeralPosts.length > 0 || ephemeralLoading) && (
        <div className="border-t border-dashed border-white/[0.08]">
          <button
            onClick={toggleEphemeral}
            className={`w-full px-4 py-2 text-left ${ts(sz)} text-white/20 hover:text-white/40 transition-colors`}
          >
            {ephemeralExpanded
              ? `${Math.max(ephemeralCount, ephemeralPosts.length)} nostr`
              : `${Math.max(ephemeralCount, ephemeralPosts.length)} nostr ${Math.max(ephemeralCount, ephemeralPosts.length) === 1 ? "reply" : "replies"}`}
          </button>
          {ephemeralExpanded && (
            <div className="divide-y divide-white/[0.04]">
              {ephemeralLoading && ephemeralPosts.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-white/15" />
                </div>
              ) : (
                ephemeralPosts.map((ep) => (
                  <div key={ep.nostrEventId} className="pl-2">
                    <EphemeralPostCard post={ep} />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
