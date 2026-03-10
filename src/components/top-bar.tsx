"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Plus, Pencil, Check, ArrowLeft, ArrowUpDown, LayoutList, Clock, Flame, ArrowUp, ArrowDown } from "lucide-react";
import { formatSats } from "@/lib/mock-data";
import type { FeedFilter, SortMode } from "@/lib/mock-data";
import type { TextSize } from "@/lib/text-size";
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

const AVATAR_BGS = [
  "bg-burn/30",
  "bg-amber-500/30",
  "bg-orange-500/30",
  "bg-yellow-600/30",
  "bg-rose-500/25",
] as const;

function topicAvatarProps(name: string | null, hash: string): { bg: string; initials: string } {
  const str = (name ?? hash).slice(0, 8);
  const idx = str.split("").reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0) % AVATAR_BGS.length;
  const initials = name
    ? name.slice(0, 2).toUpperCase()
    : hash.slice(0, 2).toUpperCase();
  return { bg: AVATAR_BGS[Math.abs(idx)], initials };
}

function formatTopicStats(postCount: number, totalBurned: number): string {
  const parts: string[] = [];
  if (postCount > 0) parts.push(`${postCount.toLocaleString()} posts`);
  if (totalBurned > 0) parts.push(`${formatSats(totalBurned)} sats`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

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
  includeTopicless,
  onIncludeTopiclessChange,
  excludedTopicHashes,
  onExcludedTopicHashesChange,
  onReset,
  expandedPostId,
  expandedTopicName,
  onBack,
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
  includeTopicless: boolean;
  onIncludeTopiclessChange: (v: boolean) => void;
  excludedTopicHashes: string[];
  onExcludedTopicHashesChange: (hashes: string[]) => void;
  onReset?: () => void;
  expandedPostId?: string | null;
  expandedTopicName?: string | null;
  onBack?: () => void;
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
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

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
    if (!sortDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!sortDropdownRef.current?.contains(e.target as Node)) {
        setSortDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sortDropdownOpen]);

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

  const SORT_ICONS: Record<SortMode, React.ReactNode> = {
    topics: <LayoutList size={20} strokeWidth={2} />,
    new: <Clock size={20} strokeWidth={2} />,
    top: <Flame size={20} strokeWidth={2} />,
  };
  const SORT_ARIA: Record<SortMode, string> = {
    topics: sortDirections.topics === "asc" ? "Topics (lowest burn first)" : "Topics (highest burn first)",
    new: sortDirections.new === "asc" ? "Oldest first" : "Newest first",
    top: sortDirections.top === "asc" ? "Lowest burn first" : "Highest burn first",
  };

  return (
    <div ref={containerRef} className="relative shrink-0 border-b border-border bg-elevated pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 px-4 py-2.5">
        {/* Home / Back button */}
        {expandedPostId && onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-white/[0.09] text-white/70 hover:bg-white/[0.15] hover:text-white transition-colors active:scale-95"
          >
            <ArrowLeft size={iconSize} strokeWidth={2} />
          </button>
        )}

        {/* Text size toggle */}
        <button
          onClick={() => onTextSizeChange(textSize === "sm" ? "lg" : "sm")}
          aria-label="Text size"
          className="flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-white/40 hover:text-white/70 transition-colors active:scale-95"
        >
          <span className={`${textSize === "sm" ? "text-white" : ""} text-[11px] leading-none`}>a</span>
          <span className={`${textSize === "lg" ? "text-white" : ""} text-[18px] leading-none`}>A</span>
        </button>

        {/* Search bar — between aA and Sort */}
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
              placeholder={expandedPostId && expandedTopicName ? expandedTopicName : "topics or pubkey"}
              className={`w-full bg-transparent ${ts(sz)} text-white placeholder:text-white/20 outline-none`}
            />
          </div>
          <div className="h-10 w-10 shrink-0 flex items-center justify-center text-white/40">
            <Search size={iconSize} strokeWidth={2} />
          </div>
        </div>

        {/* Sort icon (with dropdown) + Compose button */}
          <div ref={sortDropdownRef} className="relative">
            <button
              onClick={() => setSortDropdownOpen((o) => !o)}
              aria-label="Sort"
              aria-expanded={sortDropdownOpen}
              title={SORT_ARIA[sortMode]}
              className={`flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 ${
                sortDropdownOpen ? "bg-white/[0.15] text-white" : "bg-white/[0.09] text-white/70 hover:bg-white/[0.15] hover:text-white"
              }`}
            >
              <ArrowUpDown size={iconSize} strokeWidth={2} />
            </button>
            {sortDropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 flex gap-1 rounded-lg border border-border bg-elevated p-1.5 shadow-lg">
                {(["topics", "new", "top"] as SortMode[]).map((m) => {
                  const dir = sortDirections[m] ?? "desc";
                  const isSelected = sortMode === m;
                  return (
                  <button
                    key={m}
                    onClick={() => {
                      onSortChange(m);
                      if (!isSelected) setSortDropdownOpen(false);
                    }}
                    aria-label={SORT_ARIA[m]}
                    title={SORT_ARIA[m]}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors active:scale-95 ${
                      isSelected ? "bg-white/[0.12] text-white" : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-0.5">
                      {SORT_ICONS[m]}
                      {isSelected && (dir === "desc" ? <ArrowDown size={9} strokeWidth={2.5} /> : <ArrowUp size={9} strokeWidth={2.5} />)}
                    </span>
                  </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            onClick={onCompose}
            aria-label="Compose"
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-white/[0.09] text-white/70 hover:bg-white/[0.15] hover:text-white transition-colors active:scale-95"
          >
            <Plus size={iconSize} strokeWidth={2} className="mr-0.5" />
            <Pencil size={iconSize - 2} strokeWidth={2} />
          </button>
      </div>

      {/* Topic list dropdown when search bar focused */}
      {showTopicList && (
        <div
          ref={listRef}
          className="max-h-[40vh] overflow-y-auto border-t border-border"
          onScroll={handleListScroll}
        >
          {/* Untagged always at top with filter checkbox */}
          <button
            onClick={() => selectTopic({ type: "topicless" })}
            className="flex w-full items-center gap-3 border-b border-border py-3 pl-4 pr-4 transition-colors hover:bg-white/[0.03]"
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
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/30 text-sm font-medium">
              —
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className={`${ts(sz)} font-medium leading-tight text-white/80`}>untagged</div>
              <div className="text-[11px] leading-tight text-white/30">posts without topic</div>
            </div>
          </button>
          {topics
            .filter((t) => !deselected.has(t.hash))
            .map((t) => {
              const { bg, initials } = topicAvatarProps(t.name, t.hash);
              return (
                <button
                  key={t.hash}
                  onClick={() => selectTopic({ type: "topic", hash: t.hash, name: t.name })}
                  className="flex w-full items-center gap-3 border-b border-border py-3 pl-4 pr-4 transition-colors hover:bg-white/[0.03]"
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
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${bg} text-white/90 text-sm font-medium`}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className={`${ts(sz)} font-medium leading-tight text-white ${!t.name ? "font-mono" : ""}`}>
                      {t.name ? `/${t.name}` : t.hash.slice(0, 8)}
                    </div>
                    <div className="text-[11px] leading-tight text-white/40 tabular-nums">
                      {formatTopicStats(t.postCount, t.totalBurned)}
                    </div>
                  </div>
                </button>
              );
            })}
          {external
            .filter((e) => !deselected.has(`ext:${e.protocol}`))
            .map((e) => {
              const { bg, initials } = topicAvatarProps(e.label, e.protocol);
              return (
                <button
                  key={e.protocol}
                  onClick={() =>
                    selectTopic({ type: "protocol", protocol: e.protocol, label: e.label })
                  }
                  className="flex w-full items-center gap-3 border-b border-border py-3 pl-4 pr-4 transition-colors hover:bg-white/[0.03]"
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
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${bg} text-white/90 text-sm font-medium`}>
                    {e.protocol === "ew" ? "EW" : initials}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className={`${ts(sz)} font-medium leading-tight ${e.protocol === "ew" ? "" : "text-white/80"}`}>
                      {e.protocol === "ew" ? (
                        <span className="bg-white rounded-full px-2 py-0.5 text-blue-600 font-[ui-sans-serif,system-ui,sans-serif]">
                          EternityWall
                        </span>
                      ) : (
                        e.label
                      )}
                    </div>
                    <div className="text-[11px] leading-tight text-white/40 tabular-nums">
                      {formatTopicStats(e.postCount, e.totalBurned)}
                    </div>
                  </div>
                </button>
              );
            })}
          {deselected.size > 0 && (
            <button
              onClick={() => {
                setDeselected(new Set());
                onExcludedTopicHashesChange([]);
              }}
              className={`w-full min-h-[44px] py-3 flex items-center justify-center ${ts(sz)} text-white/30 hover:text-white/50 transition-colors`}
            >
              show {deselected.size} deselected
            </button>
          )}
          {loading && (
            <div className={`flex h-10 items-center justify-center ${ts(sz)} text-white/30 animate-pulse`}>
              Loading topics…
            </div>
          )}
        </div>
      )}

    </div>
  );
}
