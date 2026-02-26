"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X } from "lucide-react";
import { formatSats } from "@/lib/mock-data";
import type { FeedFilter } from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";

type TopicEntry = {
  hash: string;
  name: string | null;
  totalBurned: number;
  postCount: number;
};

type ExternalEntry = {
  protocol: string;
  label: string;
  postCount: number;
  totalBurned: number;
};

const LIMIT = 30;

export function TopicSearchPill({
  feedFilter,
  onSelect,
}: {
  feedFilter: FeedFilter;
  onSelect: (filter: FeedFilter) => void;
}) {
  const sz = useTextSize();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [topics, setTopics] = useState<TopicEntry[]>([]);
  const [external, setExternal] = useState<ExternalEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const doFetch = useCallback(
    async (q: string, off: number, append: boolean) => {
      if (loadingRef.current && append) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(LIMIT) });
        if (q) params.set("q", q);
        if (off > 0) params.set("offset", String(off));
        const res = await fetch(`/api/topics?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        const incoming: TopicEntry[] = data.topics ?? [];
        if (append) {
          setTopics((prev) => [...prev, ...incoming]);
        } else {
          setTopics(incoming);
          setExternal(data.external ?? []);
        }
        setHasMore(data.hasMore ?? false);
        setLoadedCount(append ? off + incoming.length : incoming.length);
      } catch {}
      finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const delay = query ? 200 : 0;
    const t = setTimeout(() => doFetch(query, 0, false), delay);
    return () => clearTimeout(t);
  }, [open, query, doFetch]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
    }
  }, [open]);

  const handleListScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (
        el.scrollHeight - el.scrollTop - el.clientHeight < 100 &&
        hasMore &&
        !loading
      ) {
        doFetch(query, loadedCount, true);
      }
    },
    [hasMore, loading, query, loadedCount, doFetch],
  );

  const select = (filter: FeedFilter) => {
    onSelect(filter);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !query.trim()) {
      select({ type: "topicless" });
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const activeLabel = (() => {
    switch (feedFilter.type) {
      case "topic":
        return feedFilter.name ?? feedFilter.hash.slice(0, 8);
      case "topicless":
        return "untagged";
      case "protocol":
        return feedFilter.label;
      default:
        return null;
    }
  })();

  const isActive = feedFilter.type !== "all";
  // Circle button shows × (clear) when a filter is set and dropdown is closed
  const showClear = isActive && !open;
  const iconSize = sz === "lg" ? 16 : 13;

  return (
    <div ref={containerRef} className="relative border-b border-border">
      <div className="px-4 py-2">
        {/* Wide oval bar — height matches the circle button radius */}
        <div className="flex h-10 w-full items-center rounded-full bg-white/[0.06]">

          {/* Left: label when closed, input when open */}
          <div
            className="min-w-0 flex-1 cursor-text px-4"
            onClick={() => !open && setOpen(true)}
          >
            {open ? (
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="…"
                className={`w-full bg-transparent ${ts(sz)} text-white placeholder:text-white/20 outline-none`}
              />
            ) : (
              <span
                className={`${ts(sz)} leading-none block truncate ${
                  isActive ? "text-white/80" : "text-white/20"
                } ${feedFilter.type === "topic" && !feedFilter.name ? "font-mono" : ""}`}
              >
                {activeLabel ?? "…"}
              </span>
            )}
          </div>

          {/* Right: circle button flush with the oval's right curve */}
          <button
            onClick={() => {
              if (showClear) {
                onSelect({ type: "all" });
              } else {
                setOpen((o) => !o);
              }
            }}
            aria-label={showClear ? "Clear filter" : "Search topics"}
            className="h-10 w-10 shrink-0 rounded-full bg-white/[0.09] flex items-center justify-center transition-colors hover:bg-white/[0.15]"
          >
            {showClear ? (
              <X size={iconSize} strokeWidth={2} className="text-white/40" />
            ) : (
              <Search size={iconSize} strokeWidth={2} className="text-white/40" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 bg-black border-b border-border">
          <div
            className="max-h-[50vh] overflow-y-auto"
            onScroll={handleListScroll}
          >
            {topics.map((t) => (
              <button
                key={t.hash}
                onClick={() => select({ type: "topic", hash: t.hash, name: t.name })}
                className="flex w-full items-center border-b border-border transition-colors hover:bg-white/[0.03]"
              >
                <div className="w-[14%] shrink-0 py-3 pl-3 pr-3 text-right">
                  <span className={`${ts(sz)} leading-tight text-burn/60 tabular-nums`}>
                    {t.totalBurned > 0 ? formatSats(t.totalBurned) : ""}
                  </span>
                </div>
                <div className="min-w-0 flex-1 py-3 pl-2 pr-4">
                  <span
                    className={`${ts(sz)} leading-tight text-white/70 ${!t.name ? "font-mono" : ""}`}
                  >
                    {t.name ?? t.hash.slice(0, 8)}
                  </span>
                </div>
              </button>
            ))}

            {external.length > 0 && (
              <>
                {topics.length > 0 && (
                  <div className="border-t border-white/[0.04]" />
                )}
                {external.map((e) => (
                  <button
                    key={e.protocol}
                    onClick={() =>
                      select({ type: "protocol", protocol: e.protocol, label: e.label })
                    }
                    className="flex w-full items-center border-b border-border transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="w-[14%] shrink-0 py-3 pl-3 pr-3 text-right">
                      <span className={`${ts(sz)} leading-tight text-white/20 tabular-nums`}>
                        {e.postCount > 0 ? String(e.postCount) : ""}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 py-3 pl-2 pr-4">
                      <span className={`${ts(sz)} leading-tight text-white/30 font-mono`}>
                        {e.label}
                      </span>
                    </div>
                    <div className="shrink-0 pr-3">
                      <span className="text-[10px] text-burn/30 uppercase tracking-widest font-mono">
                        {e.protocol}
                      </span>
                    </div>
                  </button>
                ))}
              </>
            )}

            <button
              onClick={() => select({ type: "topicless" })}
              className="flex w-full items-center border-b border-border transition-colors hover:bg-white/[0.03]"
            >
              <div className="w-[14%] shrink-0 py-3 pl-3 pr-3 text-right">
                <span className={`${ts(sz)} leading-tight text-white/10`}>—</span>
              </div>
              <div className="min-w-0 flex-1 py-3 pl-2 pr-4">
                <span className={`${ts(sz)} leading-tight text-white/20`}>
                  untagged
                </span>
              </div>
            </button>

            {loading && (
              <div
                className={`flex h-10 items-center justify-center ${ts(sz)} text-white/10 animate-pulse`}
              >
                —
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
