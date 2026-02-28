"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type RefCallback,
} from "react";
import { type ThreadItem, type EphemeralPost } from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import { ThreadCard } from "./feed-card";
import { EphemeralPostCard } from "./ephemeral-post-card";
import { ArrowLeft } from "lucide-react";

const INDENT_PX = 24;

export function ThreadView({
  postId,
  onBack,
  onReply,
  initialEphemeralPosts,
}: {
  postId: string;
  onBack: () => void;
  onReply: (id: string) => void;
  initialEphemeralPosts?: EphemeralPost[];
}) {
  const sz = useTextSize();
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ephemeralPosts, setEphemeralPosts] = useState<EphemeralPost[]>(initialEphemeralPosts ?? []);
  const [ephemeralCount, setEphemeralCount] = useState(0);
  const [ephemeralExpanded, setEphemeralExpanded] = useState(!!initialEphemeralPosts?.length);
  const [ephemeralLoading, setEphemeralLoading] = useState(false);

  // Sync optimistic replies injected from page.tsx into this thread
  useEffect(() => {
    if (!initialEphemeralPosts?.length) return;
    setEphemeralPosts((prev) => {
      const existingIds = new Set(prev.map((p) => p.nostrEventId));
      const incoming = initialEphemeralPosts.filter((p) => !existingIds.has(p.nostrEventId));
      if (incoming.length === 0) return prev;
      // Open the section automatically so the reply is visible immediately
      setEphemeralExpanded(true);
      setEphemeralCount((c) => c + incoming.length);
      return [...incoming, ...prev];
    });
  }, [initialEphemeralPosts]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const [centerDepth, setCenterDepth] = useState(0);
  const [focusedId, setFocusedId] = useState(postId);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setThread([]);

    fetch(`/api/thread/${postId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => {
        const items: ThreadItem[] = data.thread ?? [];
        setThread(items);
        const target = items.find((t) => t.id === postId);
        if (target) {
          setCenterDepth(target.depth);
          setFocusedId(postId);
          // Seed ephemeral replies from thread response
          const focalItem = data.thread?.find((t: ThreadItem & { ephemeralCount?: number; ephemeralReplies?: EphemeralPost[] }) => t.id === postId);
          if (focalItem?.ephemeralCount) setEphemeralCount(focalItem.ephemeralCount);
          if (focalItem?.ephemeralReplies?.length && ephemeralPosts.length === 0) {
            setEphemeralPosts(focalItem.ephemeralReplies);
          }
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [postId]);

  const setCardRef = useCallback(
    (id: string): RefCallback<HTMLDivElement> =>
      (el) => {
        if (el) cardEls.current.set(id, el);
        else cardEls.current.delete(id);
      },
    [],
  );

  useEffect(() => {
    if (thread.length === 0) return;
    requestAnimationFrame(() => {
      const el = cardEls.current.get(postId);
      if (el && scrollRef.current) {
        const container = scrollRef.current;
        const elTop = el.offsetTop;
        const elH = el.offsetHeight;
        container.scrollTop = elTop - container.clientHeight / 2 + elH / 2;
      }
    });
  }, [postId, thread]);

  const loadEphemeral = useCallback(async () => {
    if (ephemeralLoading) return;
    setEphemeralLoading(true);
    try {
      const res = await fetch(`/api/ephemeral?parentHash=${postId}&sort=top&limit=50`);
      const data = await res.json();
      setEphemeralPosts(data.posts ?? []);
      setEphemeralCount(data.posts?.length ?? 0);
    } catch {}
    setEphemeralLoading(false);
  }, [postId, ephemeralLoading]);

  const toggleEphemeral = useCallback(() => {
    if (!ephemeralExpanded) {
      setEphemeralExpanded(true);
      loadEphemeral();
    } else {
      setEphemeralExpanded(false);
    }
  }, [ephemeralExpanded, loadEphemeral]);

  const handleScroll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container) return;

      const viewportCenter = container.clientHeight / 2;
      let closest: ThreadItem | null = null;
      let closestDist = Infinity;

      for (const item of thread) {
        const el = cardEls.current.get(item.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const cardCenter = rect.top - containerRect.top + rect.height / 2;
        const dist = Math.abs(cardCenter - viewportCenter);
        if (dist < closestDist) {
          closestDist = dist;
          closest = item;
        }
      }

      if (closest) {
        setCenterDepth(closest.depth);
        setFocusedId(closest.id);
      }
    });
  }, [thread]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center border-b border-border px-4">
        <button
          onClick={onBack}
          className="text-white/30 hover:text-white/60 transition-colors"
        >
          <ArrowLeft size={24} strokeWidth={1.5} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        {loading ? (
          <div
            className={`flex h-32 items-center justify-center ${ts(sz)} text-white/10 animate-pulse`}
          >
            —
          </div>
        ) : error ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2">
            <span className={`${ts(sz)} text-white/10`}>error</span>
          </div>
        ) : (
          <>
            <div className="h-[40vh]" />

            {thread.map((item) => {
              const offset = (item.depth - centerDepth) * INDENT_PX;
              return (
                <div
                  key={item.id}
                  ref={setCardRef(item.id)}
                  className="will-change-transform"
                  style={{
                    transform: `translateX(${offset}px)`,
                    transition: "transform 150ms ease-out",
                  }}
                >
                  <ThreadCard
                    post={item}
                    isFocused={item.id === focusedId}
                    onReply={onReply}
                  />
                </div>
              );
            })}

            {/* Ephemeral replies section */}
            {(ephemeralCount > 0 || ephemeralPosts.length > 0) && (
              <div className="border-t border-dashed border-white/[0.08] mt-2">
                <button
                  onClick={toggleEphemeral}
                  className={`w-full px-4 py-2 text-left ${ts(sz)} text-white/20 hover:text-white/40 transition-colors`}
                >
                  {ephemeralExpanded ? "hide" : `${Math.max(ephemeralCount, ephemeralPosts.length)} ephemeral ${Math.max(ephemeralCount, ephemeralPosts.length) === 1 ? "reply" : "replies"}`}
                </button>

                {ephemeralExpanded && (
                  <div className="divide-y divide-white/[0.04]">
                    {ephemeralLoading && ephemeralPosts.length === 0 ? (
                      <div className={`px-4 py-3 ${ts(sz)} text-white/10 animate-pulse`}>—</div>
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

            <div className="h-[40vh]" />
          </>
        )}
      </div>
    </div>
  );
}
