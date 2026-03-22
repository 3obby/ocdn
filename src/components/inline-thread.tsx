"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { type ThreadItem, type EphemeralPost, formatTime, shortNostrPubkey } from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import { ThreadCard } from "./feed-card";
import { ExpandableContentBlock } from "./expandable-content-block";
import { ChevronDown, Loader2 } from "lucide-react";

const CHILDREN_INITIAL_LIMIT = 7;

function EphemeralTree({ posts, onReply, onInscribe, onViewTx }: {
  posts: EphemeralPost[];
  onReply?: (post: EphemeralPost) => void;
  onInscribe?: (post: EphemeralPost) => void;
  onViewTx?: (contentHash: string) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showMoreChildren, setShowMoreChildren] = useState<Set<string>>(new Set());

  const childrenOf = new Map<string, EphemeralPost[]>();
  const postsById = new Map(posts.map((p) => [p.nostrEventId, p]));
  const roots: EphemeralPost[] = [];
  for (const ep of posts) {
    if (ep.parentNostrId && posts.some((p) => p.nostrEventId === ep.parentNostrId)) {
      const arr = childrenOf.get(ep.parentNostrId) ?? [];
      arr.push(ep);
      childrenOf.set(ep.parentNostrId, arr);
    } else {
      roots.push(ep);
    }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        const queue = childrenOf.get(id) ?? [];
        for (let i = 0; i < queue.length; i++) {
          const c = queue[i];
          next.delete(c.nostrEventId);
          const grandkids = childrenOf.get(c.nostrEventId);
          if (grandkids) for (const g of grandkids) queue.push(g);
        }
      } else {
        next.add(id);
        let cur = postsById.get(id);
        while (cur?.parentNostrId && postsById.has(cur.parentNostrId)) {
          next.add(cur.parentNostrId);
          cur = postsById.get(cur.parentNostrId);
        }
      }
      return next;
    });
  }

  function toggleShowMoreChildren(parentId: string) {
    setShowMoreChildren((prev) => { const n = new Set(prev); if (n.has(parentId)) n.delete(parentId); else n.add(parentId); return n; });
  }

  function countDesc(id: string): number {
    let count = 0;
    const kids = childrenOf.get(id) ?? [];
    for (const k of kids) { count += 1 + countDesc(k.nostrEventId); }
    return count;
  }

  function toggleAll(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        const toRemove = [id];
        const queue = childrenOf.get(id) ?? [];
        for (let i = 0; i < queue.length; i++) {
          toRemove.push(queue[i].nostrEventId);
          const gk = childrenOf.get(queue[i].nostrEventId);
          if (gk) queue.push(...gk);
        }
        toRemove.forEach((eid) => next.delete(eid));
      } else {
        const toAdd = [id];
        const queue = childrenOf.get(id) ?? [];
        for (let i = 0; i < queue.length; i++) {
          toAdd.push(queue[i].nostrEventId);
          const gk = childrenOf.get(queue[i].nostrEventId);
          if (gk) queue.push(...gk);
        }
        let cur = postsById.get(id);
        while (cur?.parentNostrId && postsById.has(cur.parentNostrId)) {
          toAdd.push(cur.parentNostrId);
          cur = postsById.get(cur.parentNostrId);
        }
        toAdd.forEach((eid) => next.add(eid));
        setShowMoreChildren((prev2) => {
          const n = new Set(prev2);
          toAdd.forEach((eid) => n.add(eid));
          return n;
        });
      }
      return next;
    });
  }

  function renderBranch(items: EphemeralPost[], depth: number): React.ReactNode {
    return items.map((ep) => {
      const kids = childrenOf.get(ep.nostrEventId) ?? [];
      const isExp = expandedIds.has(ep.nostrEventId);
      const toggle = () => toggleExpand(ep.nostrEventId);
      const showAllKids = showMoreChildren.has(ep.nostrEventId);
      const visibleKids = showAllKids || kids.length <= CHILDREN_INITIAL_LIMIT ? kids : kids.slice(0, CHILDREN_INITIAL_LIMIT);
      const hiddenCount = kids.length - visibleKids.length;
      const descCount = countDesc(ep.nostrEventId);
      return (
        <ExpandableContentBlock
          key={ep.nostrEventId}
          content={ep.content}
          level={depth}
          isBitcoinInscribed={ep.anchoredToBtc}
          author={shortNostrPubkey(ep.nostrPubkey)}
          datePosted={formatTime(new Date(ep.createdAt).getTime())}
          viewCount={ep.boostCount > 0 ? ep.boostCount : undefined}
          nostrEventId={ep.nostrEventId}
          childCount={descCount}
          onExpandAllChildren={() => toggleAll(ep.nostrEventId)}
          onReply={onReply ? () => onReply(ep) : undefined}
          onClick={toggle}
          hasChildren={kids.length > 0}
          isChildrenExpanded={isExp}
          onToggleChildren={toggle}
          childrenSlot={kids.length > 0 && isExp ? (
            <div className="pl-2 mt-1">
              {renderBranch(visibleKids, depth + 1)}
              {hiddenCount > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleShowMoreChildren(ep.nostrEventId); }}
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded border border-white/10 bg-white/[0.02] px-3 py-2 my-2 text-[11px] text-white/40 hover:text-white/60 hover:bg-white/[0.04] hover:border-white/15 transition-colors active:scale-[0.98]"
                >
                  <ChevronDown size={12} strokeWidth={2} />
                  View {hiddenCount} more
                </button>
              )}
            </div>
          ) : undefined}
        />
      );
    });
  }

  return <>{renderBranch(roots, 0)}</>;
}

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
  onReplyEphemeral,
  onInscribeEphemeral,
  onViewTx,
  initialEphemeralPosts,
}: {
  postId: string;
  onReply: (id: string) => void;
  onReplyEphemeral?: (post: EphemeralPost) => void;
  onInscribeEphemeral?: (post: EphemeralPost) => void;
  onViewTx?: (contentHash: string) => void;
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
  const [retryKey, setRetryKey] = useState(0);
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
  }, [postId, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className={`flex flex-col items-center gap-2 px-4 py-4 ${ts(sz)} text-white/30`}>
        <span>Couldn&apos;t load thread</span>
        <button onClick={() => { setError(null); setRetryKey((k) => k + 1); }} className="text-[11px] text-white/50 hover:text-white/70">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="border-l-2 border-white/20 ml-4">
      {loading ? (
        <div className="divide-y divide-white/[0.04]">
          <Skeleton lines={2} />
          <Skeleton lines={1} />
          <Skeleton lines={2} />
        </div>
      ) : (
        <>
          {children.length > 0 && (
            <div className="divide-y divide-white/[0.04] space-y-0.5">
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
            <div className={`px-4 py-3 ${ts(sz)} text-white/25`}>Be the first to reply</div>
          )}
        </>
      )}

      {/* Ephemeral section — expanded by default */}
      {(ephemeralCount > 0 || ephemeralPosts.length > 0 || ephemeralLoading) && (
        <div className="border-t border-dashed border-white/25">
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
                <EphemeralTree posts={ephemeralPosts} onReply={onReplyEphemeral} onInscribe={onInscribeEphemeral} onViewTx={onViewTx} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
