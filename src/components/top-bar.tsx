"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Plus, Pencil, Check, Home, Clock, Sigma, ArrowUp, ArrowDown } from "lucide-react";
import { formatSats } from "@/lib/mock-data";
import type { FeedFilter, SortMode } from "@/lib/mock-data";
import type { TextSize } from "@/lib/text-size";
import { useTextSize, ts } from "@/lib/text-size";
import { ProfileIcon } from "@/components/profile-icon";

function ProfileIconSlot({ onOpenProfile }: { onOpenProfile: () => void }) {
  return <ProfileIcon onOpenProfile={onOpenProfile} />;
}

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

function isPubkey(q: string): boolean {
  return /^[0-9a-f]{66}$/i.test(q.trim());
}

export function TopBar({
  feedFilter,
  onFeedFilterChange,
  searchQuery,
  onSearchQueryChange,
  sortMode,
  sortDirections,
  onSortChange,
  textSize,
  onTextSizeChange,
  onCompose,
  onOpenProfile,
  includeTopicless,
  onIncludeTopiclessChange,
  excludedTopicHashes,
  onExcludedTopicHashesChange,
  onReset,
}: {
  feedFilter: FeedFilter;
  onFeedFilterChange: (f: FeedFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  sortMode: SortMode;
  sortDirections: Record<string, "asc" | "desc">;
  onSortChange: (m: SortMode) => void;
  textSize: TextSize;
  onTextSizeChange: (s: TextSize) => void;
  onCompose: () => void;
  onOpenProfile?: () => void;
  includeTopicless: boolean;
  onIncludeTopiclessChange: (v: boolean) => void;
  excludedTopicHashes: string[];
  onExcludedTopicHashesChange: (hashes: string[]) => void;
  onReset?: () => void;
}) {
  const sz = useTextSize();
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<TopicEntry[]>([]);
  const [external, setExternal] = useState<ExternalEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const loadingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const hasFilter = feedFilter.type !== "all";
  const hasQuery = searchQuery.trim().length > 0;
  const showClear = hasQuery || hasFilter;
  const isPubkeyQuery = isPubkey(searchQuery.trim());
  const showTopicList = open && !isPubkeyQuery;

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
    if (!showTopicList) return;
    const delay = searchQuery.trim() ? 200 : 0;
    const t = setTimeout(() => doFetch(searchQuery.trim(), 0, false), delay);
    return () => clearTimeout(t);
  }, [showTopicList, searchQuery, doFetch]);

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
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (showTopicList) {
      setDeselected((prev) => {
        const ext = Array.from(prev).filter((id) => id.startsWith("ext:"));
        return new Set([...excludedTopicHashes, ...ext]);
      });
    }
  }, [showTopicList, excludedTopicHashes]);

  const handleListScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (
        el.scrollHeight - el.scrollTop - el.clientHeight < 100 &&
        hasMore &&
        !loading
      ) {
        doFetch(searchQuery.trim(), loadedCount, true);
      }
    },
    [hasMore, loading, searchQuery, loadedCount, doFetch],
  );

  const selectTopic = (filter: FeedFilter) => {
    onFeedFilterChange(filter);
    if (filter.type === "topic") {
      onSearchQueryChange(filter.name ?? filter.hash.slice(0, 8));
    } else if (filter.type === "protocol") {
      onSearchQueryChange(filter.label);
    } else if (filter.type === "topicless") {
      onSearchQueryChange("untagged");
    } else {
      onSearchQueryChange("");
    }
    setOpen(false);
    setDeselected(new Set());
    onExcludedTopicHashesChange([]);
  };

  const toggleDeselect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(deselected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDeselected(next);
    onExcludedTopicHashesChange(Array.from(next).filter((h) => !h.startsWith("ext:")));
  };

  const handleClear = () => {
    if (onReset) {
      onReset();
    } else {
      onSearchQueryChange("");
      onFeedFilterChange({ type: "all" });
      onExcludedTopicHashesChange([]);
    }
    setOpen(false);
    setDeselected(new Set());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const q = searchQuery.trim();
      if (!q) {
        selectTopic({ type: "topicless" });
        return;
      }
      if (isPubkey(q)) {
        setOpen(false);
        return;
      }
      setOpen(false);
    }
    if (e.key === "Escape") setOpen(false);
  };

  const iconSize = sz === "lg" ? 16 : 13;

  const sortIconSize = sz === "lg" ? 18 : 14;
  const NewArrow = sortDirections.new === "asc" ? ArrowDown : ArrowUp;
  const TopArrow = sortDirections.top === "asc" ? ArrowDown : ArrowUp;
  const MODES: { key: SortMode; icon: React.ReactNode }[] = [
    { key: "topics", icon: <Home size={sortIconSize} strokeWidth={2} /> },
    { key: "new", icon: <span className="inline-flex items-center gap-0.5"><Clock size={sortIconSize} strokeWidth={2} /><NewArrow size={sortIconSize} strokeWidth={2} /></span> },
    { key: "top", icon: <span className="inline-flex items-center gap-0.5"><Sigma size={sortIconSize} strokeWidth={2} /><TopArrow size={sortIconSize} strokeWidth={2} /></span> },
  ];

  return (
    <div ref={containerRef} className="relative shrink-0 border-b border-border bg-elevated">
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Home button */}
        <button
          onClick={handleClear}
          aria-label="Home"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.09] text-white/70 hover:bg-white/[0.15] hover:text-white transition-colors"
        >
          <Home size={iconSize} strokeWidth={2} />
        </button>

        {/* Search row: [×] [input] [🔍] */}
        <div className="flex min-w-0 flex-1 items-center rounded-full bg-white/[0.06]">
          {showClear && (
            <button
              onClick={handleClear}
              aria-label="Clear"
              className="h-10 w-10 shrink-0 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            >
              <X size={iconSize} strokeWidth={2} />
            </button>
          )}
          <div
            className="min-w-0 flex-1 cursor-text px-3"
            onClick={() => !open && setOpen(true)}
          >
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setOpen(true)}
              placeholder="topics or pubkey"
              className={`w-full bg-transparent ${ts(sz)} text-white placeholder:text-white/20 outline-none`}
            />
          </div>
          <div className="h-10 w-10 shrink-0 flex items-center justify-center text-white/40">
            <Search size={iconSize} strokeWidth={2} />
          </div>
        </div>

        {/* Compose +✎ */}
        <button
          onClick={onCompose}
          aria-label="Compose"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.09] text-white/70 hover:bg-white/[0.15] hover:text-white transition-colors"
        >
          <Plus size={iconSize} strokeWidth={2} className="mr-0.5" />
          <Pencil size={iconSize - 2} strokeWidth={2} />
        </button>

        <ProfileIconSlot onOpenProfile={onOpenProfile ?? (() => {})} />
      </div>

      {/* Sort row */}
      <div className="flex items-center px-3 py-2 border-t border-border/50">
        {/* Text size toggle */}
        <button
          onClick={() => onTextSizeChange(textSize === "sm" ? "lg" : "sm")}
          className="flex items-baseline gap-0 text-white/40 hover:text-white/70 transition-colors mr-auto"
        >
          <span className={`${textSize === "sm" ? "text-white" : ""} text-[11px] leading-none`}>a</span>
          <span className={`${textSize === "lg" ? "text-white" : ""} text-[18px] leading-none`}>A</span>
        </button>

        {/* Sort mode pill group */}
        <div className="flex items-center rounded-full bg-white/[0.06] p-0.5">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => onSortChange(m.key)}
              aria-label={m.key}
              className={`flex items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${
                sortMode === m.key
                  ? "bg-white/[0.12] text-white"
                  : "text-white/25 hover:text-white/50"
              }`}
            >
              {m.icon}
            </button>
          ))}
        </div>

        {/* Spacer to keep pill centered */}
        <div className="mr-auto" />
      </div>

      {/* Inline topic list when search bar focused */}
      {showTopicList && (
        <div
          ref={listRef}
          className="max-h-[40vh] overflow-y-auto border-t border-border"
          onScroll={handleListScroll}
        >
          {/* Untagged always at top with filter checkbox */}
          <button
            onClick={() => selectTopic({ type: "topicless" })}
            className="flex w-full items-center border-b border-border transition-colors hover:bg-white/[0.03]"
          >
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onIncludeTopiclessChange(!includeTopicless); }}
              onKeyDown={(e) => e.key === "Enter" && onIncludeTopiclessChange(!includeTopicless)}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center text-white/40 hover:text-white/70"
            >
              <div
                className={`flex h-4 w-4 items-center justify-center rounded border ${
                  includeTopicless ? "border-white/50 bg-white/20" : "border-white/30 bg-transparent"
                }`}
              >
                {includeTopicless && <Check size={10} strokeWidth={2.5} className="text-white" />}
              </div>
            </div>
            <div className="w-[12%] shrink-0 py-2.5 pr-2 text-right">
              <span className={`${ts(sz)} leading-tight text-white/10`}>—</span>
            </div>
            <div className="min-w-0 flex-1 py-2.5 pl-0 pr-4 text-left">
              <span className={`${ts(sz)} leading-tight text-white/20`}>untagged</span>
            </div>
          </button>
          {topics
            .filter((t) => !deselected.has(t.hash))
            .map((t) => (
              <button
                key={t.hash}
                onClick={() => selectTopic({ type: "topic", hash: t.hash, name: t.name })}
                className="flex w-full items-center border-b border-border transition-colors hover:bg-white/[0.03]"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); toggleDeselect(t.hash, e); }}
                  onKeyDown={(e) => e.key === "Enter" && toggleDeselect(t.hash, e as unknown as React.MouseEvent)}
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center text-white/40 hover:text-white/70"
                >
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      deselected.has(t.hash) ? "border-white/30 bg-transparent" : "border-white/50 bg-white/20"
                    }`}
                  >
                    {!deselected.has(t.hash) && <Check size={10} strokeWidth={2.5} className="text-white" />}
                  </div>
                </div>
                <div className="w-[12%] shrink-0 py-2.5 pr-2 text-right">
                  <span className={`${ts(sz)} leading-tight text-burn/60 tabular-nums`}>
                    {t.postCount > 0 ? String(t.postCount) : ""}
                  </span>
                </div>
                <div className="min-w-0 flex-1 py-2.5 pl-0 pr-4 text-left">
                  <span className={`${ts(sz)} leading-tight text-white/80 ${!t.name ? "font-mono" : ""}`}>
                    {t.name ?? t.hash.slice(0, 8)}
                  </span>
                </div>
              </button>
            ))}
          {external
            .filter((e) => !deselected.has(`ext:${e.protocol}`))
            .map((e) => (
              <button
                key={e.protocol}
                onClick={() =>
                  selectTopic({ type: "protocol", protocol: e.protocol, label: e.label })
                }
                className="flex w-full items-center border-b border-border transition-colors hover:bg-white/[0.03]"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(ev) => { ev.stopPropagation(); toggleDeselect(`ext:${e.protocol}`, ev); }}
                  onKeyDown={(ev) => ev.key === "Enter" && toggleDeselect(`ext:${e.protocol}`, ev as unknown as React.MouseEvent)}
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center text-white/40 hover:text-white/70"
                >
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      deselected.has(`ext:${e.protocol}`) ? "border-white/30 bg-transparent" : "border-white/50 bg-white/20"
                    }`}
                  >
                    {!deselected.has(`ext:${e.protocol}`) && <Check size={10} strokeWidth={2.5} className="text-white" />}
                  </div>
                </div>
                <div className="w-[12%] shrink-0 py-2.5 pr-2 text-right">
                  <span className={`${ts(sz)} leading-tight text-white/20 tabular-nums`}>
                    {e.postCount > 0 ? String(e.postCount) : ""}
                  </span>
                </div>
                <div className="min-w-0 flex-1 py-2.5 pl-0 pr-4 text-left">
                  {e.protocol === "ew" ? (
                    <span className={`${ts(sz)} leading-tight inline-flex items-center`}>
                      <span className="bg-white rounded-full px-2 py-0.5 text-blue-600 font-[ui-sans-serif,system-ui,sans-serif]">
                        EternityWall
                      </span>
                    </span>
                  ) : (
                    <span className={`${ts(sz)} leading-tight text-white/30 font-mono`}>{e.label}</span>
                  )}
                </div>
              </button>
            ))}
          {deselected.size > 0 && (
            <button
              onClick={() => {
                setDeselected(new Set());
                onExcludedTopicHashesChange([]);
              }}
              className={`w-full py-2 ${ts(sz)} text-white/30 hover:text-white/50 transition-colors`}
            >
              show {deselected.size} deselected
            </button>
          )}
          {loading && (
            <div className={`flex h-10 items-center justify-center ${ts(sz)} text-white/10 animate-pulse`}>
              —
            </div>
          )}
        </div>
      )}

    </div>
  );
}
