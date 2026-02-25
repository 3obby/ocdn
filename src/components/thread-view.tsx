"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type RefCallback,
} from "react";
import { type ThreadItem } from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import { ThreadCard } from "./feed-card";
import { ArrowLeft } from "lucide-react";

const INDENT_PX = 24;

export function ThreadView({
  postId,
  onBack,
  onReply,
}: {
  postId: string;
  onBack: () => void;
  onReply: (id: string) => void;
}) {
  const sz = useTextSize();
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

            <div className="h-[40vh]" />
          </>
        )}
      </div>
    </div>
  );
}
