"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  formatSats,
  topicLabel,
  type SortMode,
  type TopicGroup,
  type Post,
  type FeedFilter,
  type EphemeralPost,
} from "@/lib/mock-data";
import { ChevronRight, ChevronDown, Loader2, Zap } from "lucide-react";
import { type TextSize, TextSizeCtx } from "@/lib/text-size";
import { TopBar } from "@/components/top-bar";
import { FeedCard } from "@/components/feed-card";
import { InlineThread } from "@/components/inline-thread";
import { ComposeSheet } from "@/components/compose-sheet";
import { SearchView } from "@/components/search-view";
import { EphemeralPostCard } from "@/components/ephemeral-post-card";
import { ThreadPreview } from "@/components/thread-preview";
import { ProfileIcon, ProfileSheet } from "@/components/profile-icon";
import { getStoredIdentity, getSessionPubkey } from "@/lib/nostr/client";
import { topicHash as computeTopicHash } from "@/lib/protocol/crypto";

type LeaderboardEntry = {
  type: "ephemeral";
  nostrEventId: string;
  text: string;
  authorPubkey: string;
  powDifficulty: number;
  equivalentZeros?: number;
  topic?: string | null;
  topicHash?: string | null;
  createdAt: string;
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "imprinting…";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function LeaderboardSection({
  sz,
  onNavigate,
}: {
  sz: string;
  onNavigate: (entry: LeaderboardEntry) => void;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [nextCycleMs, setNextCycleMs] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fundAddress, setFundAddress] = useState<string | null>(null);
  const [fundBalance, setFundBalance] = useState<number | null>(null);
  const [showAddress, setShowAddress] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard?limit=4")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setEntries(data.entries ?? []);
        setNextCycleMs(data.nextCycleMs ?? 0);
        setLoaded(true);
      })
      .catch(() => {});

    fetch("/api/leaderboard/fund")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setFundAddress(data.address ?? null);
        setFundBalance(data.balanceSats ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loaded) return;
    timerRef.current = setInterval(() => {
      setNextCycleMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loaded]);

  if (!loaded) return null;

  const hasEntries = entries.length > 0;

  return (
    <div className="bg-[#111111] mb-2">
      <div className="flex items-center">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="py-2.5 pl-4 text-left shrink-0 flex items-center gap-1.5"
        >
          <Zap size={14} className="text-yellow-400/80" />
          <span className={`${sz} leading-tight text-yellow-400/80`}>#1 -&gt; BTC</span>
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="shrink-0 p-1 text-white/20 hover:text-white/40 transition-colors"
        >
          {collapsed
            ? <ChevronRight size={14} strokeWidth={1.5} />
            : <ChevronDown size={14} strokeWidth={1.5} />}
        </button>
        <div className="min-w-0 flex-1" />
        <div className="shrink-0 pr-3 flex items-center gap-2">
          {fundBalance !== null && (
            <span className="text-[10px] text-white/20 tabular-nums">
              {fundBalance > 0 ? `${(fundBalance / 100_000_000).toFixed(8)} BTC` : "unfunded"}
            </span>
          )}
          <span className="text-[10px] text-yellow-400/50 tabular-nums font-mono">
            {formatCountdown(nextCycleMs)}
          </span>
        </div>
      </div>
      {!collapsed && (
        <div className="pb-2">
          {hasEntries ? (
            <div className="pl-4">
              {entries.map((entry, i) => {
                const id = entry.nostrEventId;
                const isFirst = i === 0;
                const topicName = entry.topic ?? "/";
                return (
                  <div
                    key={id}
                    onClick={() => onNavigate(entry)}
                    className="flex items-center gap-1.5 py-1.5 cursor-pointer hover:bg-white/[0.03] pr-3"
                  >
                    <span className={`text-[10px] tabular-nums w-4 text-right shrink-0 ${isFirst ? "text-yellow-400" : "text-white/25"}`}>
                      {i + 1}
                    </span>
                    {topicName && (
                      <span className={`text-[11px] shrink-0 max-w-[30%] truncate ${isFirst ? "text-yellow-400/70" : "text-white/30"}`}>
                        {topicName}
                      </span>
                    )}
                    <span className={`text-[10px] shrink-0 ${isFirst ? "text-yellow-400/40" : "text-white/15"}`}>
                      &larr;
                    </span>
                    <span className={`${sz} truncate flex-1 min-w-0 ${isFirst ? "text-yellow-200" : "text-white/60"}`}>
                      {entry.text}
                    </span>
                    <span className={`text-[10px] tabular-nums shrink-0 font-mono ${isFirst ? "text-yellow-400" : "text-white/25"}`}>
                      {entry.equivalentZeros ?? entry.powDifficulty}z
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-2">
              <span className={`${sz} text-white/20`}>no PoW activity yet — boost any post to compete</span>
            </div>
          )}
          {/* Fund info */}
          {fundAddress && (
            <div className="px-4 pt-2 mt-1 border-t border-white/[0.06]">
              <button
                onClick={() => setShowAddress(!showAddress)}
                className="text-[10px] text-white/20 hover:text-white/40 transition-colors"
              >
                {showAddress ? "hide address" : "donate to fund"}
              </button>
              {showAddress && (
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="text-[10px] text-yellow-400/60 font-mono break-all select-all leading-tight">
                    {fundAddress}
                  </code>
                  <button
                    onClick={() => navigator.clipboard?.writeText(fundAddress)}
                    className="text-[9px] text-white/20 hover:text-white/40 shrink-0 transition-colors"
                  >
                    copy
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const HEX_64_RE = /^[0-9a-f]{64}$/i;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizedTopicHash(topic: string): string {
  return toHex(computeTopicHash(topic.toLowerCase().trim().normalize("NFC")));
}

/** Build the URL path for the current navigation state */
function buildPath(filter: FeedFilter, postId?: string | null): string {
  let base = "";
  if (filter.type === "topic" && filter.name) {
    base = `/${encodeURIComponent(filter.name)}`;
  } else if (filter.type === "protocol") {
    base = `/${encodeURIComponent(filter.label ?? filter.protocol)}`;
  } else if (filter.type === "topicless") {
    base = "/untagged";
  }
  if (postId) {
    return `${base}/${postId}`;
  }
  return base || "/";
}

/** Parse URL path into initial navigation state */
function parsePath(pathname: string): {
  topicName: string | null;
  topicHash: string | null;
  postId: string | null;
  protocol: string | null;
} {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (segments.length === 0) return { topicName: null, topicHash: null, postId: null, protocol: null };

  const first = segments[0];
  const second = segments[1] ?? null;

  if (segments.length === 1 && HEX_64_RE.test(first)) {
    return { topicName: null, topicHash: null, postId: first, protocol: null };
  }

  if (first.toLowerCase() === "untagged") {
    return { topicName: null, topicHash: null, postId: second, protocol: null };
  }
  if (first.toLowerCase() === "eternitywall") {
    return { topicName: null, topicHash: null, postId: second, protocol: "ew" };
  }

  const hash = normalizedTopicHash(first);
  return { topicName: first, topicHash: hash, postId: second, protocol: null };
}

const HELLO_WORLD: Post = {
  id: "_hello",
  contentHash: "_hello",
  protocol: "ocdn",
  authorPubkey: "0000000000000000000000000000000000000000000000000000000000000000ff",
  text: "hello world",
  topicHash: null,
  topicName: null,
  parentId: null,
  burnTotal: 0,
  viewCount: 0,
  powDifficulty: 0,
  timestamp: Date.now(),
  blockHeight: 0,
  confirmations: 0,
};

function TopicsFeed({
  groups,
  posts,
  collapsedTopics,
  toggleTopic,
  feedFilter,
  setFeedFilter,
  setSearchQuery,
  expandPost,
  onPostVisible,
  excludedTopicHashes,
  includeTopicless,
  untaggedHasMore,
  ewHasMore,
  goToSection,
  expandPreview,
  sz,
  ephemeralPosts,
  expandedPostId,
  onReply,
  onReplyEphemeral,
  onInscribeEphemeral,
  myEphemeralPosts: myEph,
  extraEwPosts,
  loadMoreEw,
  loadingMoreEw,
}: {
  groups: TopicGroup[];
  posts: Post[];
  collapsedTopics: Set<string>;
  toggleTopic: (key: string) => void;
  feedFilter: FeedFilter;
  setFeedFilter: (f: FeedFilter) => void;
  setSearchQuery: (q: string) => void;
  expandPost: (id: string) => void;
  onPostVisible: (id: string) => void;
  excludedTopicHashes: string[];
  includeTopicless: boolean;
  untaggedHasMore: boolean;
  ewHasMore: boolean;
  goToSection: (sectionKey: string, topic?: { hash: string; name: string | null; totalBurned: number } | null) => void;
  expandPreview?: boolean;
  sz: string;
  ephemeralPosts?: EphemeralPost[];
  expandedPostId?: string | null;
  onReply?: (id: string) => void;
  onReplyEphemeral?: (post: EphemeralPost) => void;
  onInscribeEphemeral?: (post: EphemeralPost) => void;
  myEphemeralPosts?: EphemeralPost[];
  extraEwPosts?: Post[];
  loadMoreEw?: () => void;
  loadingMoreEw?: boolean;
}) {
  const untaggedPosts = posts.filter((p) => p._section === "untagged");
  const ewPosts = posts.filter((p) => p._section === "ew");

  // ── Build ephemeral tree and group roots by topic ──
  const myEphNoBtc = (myEph ?? []).filter((e) => !e.parentContentHash);
  const myEphIds = new Set(myEphNoBtc.map((m) => m.nostrEventId));
  const serverEph = (ephemeralPosts ?? []).filter((ep) => !myEphIds.has(ep.nostrEventId));
  const allEph = [...myEphNoBtc, ...serverEph];

  const ephById = new Map(allEph.map((ep) => [ep.nostrEventId, ep]));
  const ephChildrenOf = new Map<string, EphemeralPost[]>();
  const ephRoots: EphemeralPost[] = [];
  for (const ep of allEph) {
    if (ep.parentNostrId && ephById.has(ep.parentNostrId)) {
      const arr = ephChildrenOf.get(ep.parentNostrId) ?? [];
      arr.push(ep);
      ephChildrenOf.set(ep.parentNostrId, arr);
    } else if (!ep.parentNostrId) {
      ephRoots.push(ep);
    }
  }

  const ephByTopic = new Map<string | null, EphemeralPost[]>();
  for (const ep of ephRoots) {
    const key = ep.topicHash ?? null;
    const arr = ephByTopic.get(key) ?? [];
    arr.push(ep);
    ephByTopic.set(key, arr);
  }

  function renderEphBranch(epPosts: EphemeralPost[]): React.ReactNode {
    return epPosts.map((ep) => {
      const kids = ephChildrenOf.get(ep.nostrEventId) ?? [];
      return (
        <div key={ep.nostrEventId}>
          <EphemeralPostCard
            post={ep}
            optimistic={myEphIds.has(ep.nostrEventId)}
            onReply={onReplyEphemeral}
            onInscribe={onInscribeEphemeral}
            onViewTx={expandPost}
          />
          {kids.length > 0 && (
            <div className="ml-3 border-l border-dashed border-white/[0.08]">
              {renderEphBranch(kids)}
            </div>
          )}
        </div>
      );
    });
  }

  const hasContent = groups.length > 0 || untaggedPosts.length > 0 || ewPosts.length > 0 || allEph.length > 0;

  if (!hasContent) {
    return (excludedTopicHashes.length > 0 || !includeTopicless) ? (
      <div className={`flex h-32 items-center justify-center ${sz} text-white/10`}>—</div>
    ) : (
      <FeedCard post={HELLO_WORLD} onExpand={() => {}} />
    );
  }

  const renderSection = (
    sectionKey: string,
    label: string,
    sectionPosts: Post[],
    isTopic: boolean,
    topic?: { hash: string; name: string | null; totalBurned: number } | null,
    sectionEph?: EphemeralPost[],
  ) => {
    const isCollapsed = collapsedTopics.has(sectionKey);
    const totalBurned = topic?.totalBurned ?? 0;

    return (
      <div key={sectionKey} className="bg-[#111111] mb-2">
        {feedFilter.type === "all" && (
          <div className="flex items-center">
            <button
              onClick={() => goToSection(sectionKey, topic)}
              className="py-2.5 pl-4 text-left shrink-0"
            >
              {sectionKey === "_ew" ? (
                <span className={`${sz} leading-tight inline-flex items-center`}>
                  <span className="bg-white rounded-full px-2 py-0.5 text-blue-600 font-[ui-sans-serif,system-ui,sans-serif]">
                    EternityWall
                  </span>
                </span>
              ) : (
                <span className={`${sz} leading-tight ${isTopic ? "text-burn" : "text-white/25"} ${topic?.name ? "" : isTopic ? "font-mono" : ""}`}>
                  {label}
                </span>
              )}
            </button>
            <button
              onClick={() => toggleTopic(sectionKey)}
              className="shrink-0 p-1 text-white/20 hover:text-white/40 transition-colors"
            >
              {isCollapsed
                ? <ChevronRight size={14} strokeWidth={1.5} />
                : <ChevronDown size={14} strokeWidth={1.5} />
              }
            </button>
            <div className="min-w-0 flex-1" />
            {totalBurned > 0 && (
              <div className="shrink-0 pr-3">
                <span className="text-[10px] text-white/15 tabular-nums">
                  {formatSats(totalBurned)}
                </span>
              </div>
            )}
          </div>
        )}
        {!isCollapsed && (
          <div className="pl-4">
            {sectionPosts.flatMap((p) => [
              <FeedCard key={p.id} post={p} onExpand={expandPost} onVisible={onPostVisible} onReply={onReply} expandPreview={expandPreview} isExpanded={expandedPostId === p.id} />,
              ...(expandedPostId === p.id ? [
                <InlineThread
                  key={`thread-${p.id}`}
                  postId={p.id}
                  onReply={onReply ?? (() => {})}
                  onReplyEphemeral={onReplyEphemeral}
                  onInscribeEphemeral={onInscribeEphemeral}
                  onViewTx={expandPost}
                  initialEphemeralPosts={myEph?.filter((e) => e.parentContentHash === p.id)}
                />
              ] : []),
            ])}
            {sectionEph && sectionEph.length > 0 && renderEphBranch(sectionEph)}
          </div>
        )}
      </div>
    );
  };

  const rootEph = ephByTopic.get(null) ?? [];

  return (
    <>
      {groups.map((group) => {
        const topicKey = group.topic?.hash ?? null;
        const eph = topicKey ? (ephByTopic.get(topicKey) ?? []) : [];
        return renderSection(
          group.topic?.hash ?? "_standalone",
          group.topic ? "/" + topicLabel(group.topic) : "/",
          group.posts,
          true,
          group.topic,
          eph,
        );
      })}
      {(untaggedPosts.length > 0 || rootEph.length > 0) && renderSection("_root", "/", untaggedPosts, true, null, rootEph)}
      {untaggedHasMore && !collapsedTopics.has("_root") && (
        <button
          onClick={() => goToSection("_root")}
          className={`w-full py-2 ${sz} text-white/15 hover:text-white/30 transition-colors bg-[#111111] -mt-2 mb-2`}
        >
          more
        </button>
      )}
      {feedFilter.type === "all" && (
        <LeaderboardSection
          sz={sz}
          onNavigate={(entry) => {
            if (entry.topicHash && entry.topic) {
              goToSection(entry.topicHash, { hash: entry.topicHash, name: entry.topic, totalBurned: 0 });
            }
          }}
        />
      )}
      {ewPosts.length > 0 && renderSection("_ew", "eternitywall", [...ewPosts, ...(extraEwPosts ?? [])], false)}
      {!collapsedTopics.has("_ew") && (ewHasMore || (extraEwPosts ?? []).length > 0) && loadMoreEw && (
        <div className="bg-[#111111] -mt-2 mb-2 flex justify-center py-4">
          {loadingMoreEw ? (
            <Loader2 className="h-5 w-5 animate-spin text-white/20" />
          ) : (
            <button
              onClick={loadMoreEw}
              className={`${sz} text-white/15 hover:text-white/30 transition-colors`}
            >
              more
            </button>
          )}
        </div>
      )}
    </>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>({ type: "all" });
  const [includeTopicless, setIncludeTopicless] = useState(true);
  const [excludedTopicHashes, setExcludedTopicHashes] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("topics");
  const [sortDirections, setSortDirections] = useState<Record<string, "asc" | "desc">>({ new: "desc", top: "desc" });
  const sortDirection = sortMode === "topics" ? "desc" : (sortDirections[sortMode] ?? "desc");
  const [threadPostId, setThreadPostId] = useState<string | null>(null);
  const [threadTopicName, setThreadTopicName] = useState<string | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [textSize, setTextSize] = useState<TextSize>("sm");
  const [composing, setComposing] = useState<{
    replyToId: string | null;
    replyToNostrId?: string | null;
    topicName: string | null;
    initialText?: string | null;
  } | null>(null);

  // Session-local ephemeral posts (optimistic, cleared on reload)
  const [myEphemeralPosts, setMyEphemeralPosts] = useState<EphemeralPost[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [hasStoredIdentity, setHasStoredIdentity] = useState(false);

  // Check localStorage/sessionStorage for identity on mount (client-only)
  useEffect(() => {
    setHasStoredIdentity(!!getStoredIdentity() || !!getSessionPubkey());
  }, []);

  const hasProfileActivity = myEphemeralPosts.length > 0 || hasStoredIdentity;

  const [groups, setGroups] = useState<TopicGroup[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [collapsedTopics, setCollapsedTopics] = useState<Set<string>>(new Set());
  const [untaggedHasMore, setUntaggedHasMore] = useState(false);
  const [ewHasMore, setEwHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [homeEphemeral, setHomeEphemeral] = useState<EphemeralPost[]>([]);
  const [extraEwPosts, setExtraEwPosts] = useState<Post[]>([]);
  const [ewCursor, setEwCursor] = useState<string | null>(null);
  const [loadingMoreEw, setLoadingMoreEw] = useState(false);

  const tipHeightRef = useRef(0);
  const sortRef = useRef(sortMode);
  const sortDirRef = useRef(sortDirection);
  const filterRef = useRef<FeedFilter>(feedFilter);
  const includeTopiclessRef = useRef(includeTopicless);
  const excludedTopicHashesRef = useRef(excludedTopicHashes);
  const fetchVersionRef = useRef(0);
  const loadingMoreRef = useRef(false);

  sortRef.current = sortMode;
  sortDirRef.current = sortDirection;
  filterRef.current = feedFilter;
  includeTopiclessRef.current = includeTopicless;
  excludedTopicHashesRef.current = excludedTopicHashes;

  const feedFilterKey =
    feedFilter.type === "all" ? `all:${includeTopicless}:${excludedTopicHashes.join(",")}:${sortMode}:${sortDirection}` :
    feedFilter.type === "topic" ? `t:${feedFilter.hash}:${sortMode}:${sortDirection}` :
    feedFilter.type === "topicless" ? `topicless:${sortMode}:${sortDirection}` :
    `p:${feedFilter.protocol}:${sortMode}:${sortDirection}`;

  const showFeed = searchQuery.trim().length === 0 || feedFilter.type !== "all";
  const sz = textSize === "lg" ? "text-[26px]" : "text-[16px]";

  // ── fetch feed on sort/filter/refresh change ──
  useEffect(() => {
    const version = ++fetchVersionRef.current;
    setLoading(true);
    setError(null);
    setPosts([]);
    setGroups([]);
    setNextCursor(null);
    setExtraEwPosts([]);
    setEwCursor(null);

    const f = filterRef.current;
    const hasFilter = f.type !== "all";
    const effectiveSort = hasFilter ? "new" : sortMode;
    const params = new URLSearchParams({ sort: effectiveSort });
    if (f.type === "topic") params.set("topic", f.hash);
    else if (f.type === "topicless") params.set("topicless", "true");
    else if (f.type === "protocol") params.set("protocol", f.protocol);
    else if (!includeTopicless) params.set("excludeTopicless", "true");
    if (hasFilter) params.set("limit", "50");
    params.set("order", sortDirection);

    const feedPromise = fetch(`/api/feed?${params}`).then((r) => {
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    });

    if (effectiveSort === "topics" && f.type === "all") {
      fetch("/api/ephemeral?root=true&sort=new&limit=20")
        .then((r) => r.ok ? r.json() : { posts: [] })
        .then((data) => {
          if (version !== fetchVersionRef.current) return;
          setHomeEphemeral(data.posts ?? []);
        })
        .catch(() => {});
    } else if (f.type === "topic") {
      fetch(`/api/ephemeral?topicHash=${f.hash}&sort=new&limit=20`)
        .then((r) => r.ok ? r.json() : { posts: [] })
        .then((data) => {
          if (version !== fetchVersionRef.current) return;
          setHomeEphemeral(data.posts ?? []);
        })
        .catch(() => {});
    } else {
      setHomeEphemeral([]);
    }

    feedPromise
      .then((data) => {
        if (version !== fetchVersionRef.current) return;

        if (effectiveSort === "topics") {
          setGroups(data.groups ?? []);
          const untaggedPosts: Post[] = (data.untagged ?? []).map((p: Post) => ({ ...p, _section: "untagged" }));
          const ewPosts: Post[] = (data.ewPosts ?? []).map((p: Post) => ({ ...p, _section: "ew" }));
          setPosts([...untaggedPosts, ...ewPosts]);
          setUntaggedHasMore(data.untaggedHasMore ?? false);
          setEwHasMore(data.ewHasMore ?? false);
          if (ewPosts.length > 0) {
            setEwCursor(ewPosts[ewPosts.length - 1].contentHash);
          }
          setNextCursor(null);
        } else {
          setPosts(data.posts ?? []);
          setGroups([]);
          setNextCursor(data.nextCursor ?? null);
        }
        if (data.posts?.length) {
          const h = Math.max(
            ...data.posts.map((p: Post) => p.blockHeight + p.confirmations),
          );
          if (h > tipHeightRef.current) tipHeightRef.current = h;
        }
      })
      .catch((e) => {
        if (version !== fetchVersionRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (version !== fetchVersionRef.current) return;
        setLoading(false);
      });
  }, [sortMode, sortDirection, feedFilterKey, includeTopicless, excludedTopicHashes, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── load more (cursor pagination) ──
  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMoreRef.current || (sortMode === "topics" && feedFilter.type === "all")) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const version = fetchVersionRef.current;

    const effectiveSort = feedFilter.type !== "all" ? "new" : sortMode;
    const params = new URLSearchParams({
      sort: effectiveSort,
      cursor: nextCursor,
    });
    const f = filterRef.current;
    if (f.type === "topic") params.set("topic", f.hash);
    else if (f.type === "topicless") params.set("topicless", "true");
    else if (f.type === "protocol") params.set("protocol", f.protocol);
    else {
      if (!includeTopicless) params.set("excludeTopicless", "true");
      if (excludedTopicHashes.length > 0) params.set("excludeTopics", excludedTopicHashes.join(","));
    }
    if (feedFilter.type !== "all") params.set("limit", "50");
    params.set("order", sortDirection);

    fetch(`/api/feed?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (version !== fetchVersionRef.current) return;
        setPosts((prev) => {
          const prevIds = new Set(prev.map((p) => p.id));
          const newPosts = (data.posts ?? []).filter((p: Post) => !prevIds.has(p.id));
          return [...prev, ...newPosts];
        });
        setNextCursor(data.nextCursor ?? null);
      })
      .catch(() => {})
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [nextCursor, sortMode, sortDirection, feedFilter.type, includeTopicless, excludedTopicHashes]);

  // ── load more EW posts (infinite scroll) ──
  const loadMoreEw = useCallback(() => {
    if (!ewCursor || !ewHasMore || loadingMoreEw) return;
    setLoadingMoreEw(true);
    const version = fetchVersionRef.current;

    fetch(`/api/feed?section=ew&cursor=${encodeURIComponent(ewCursor)}&limit=20`)
      .then((r) => r.json())
      .then((data) => {
        if (version !== fetchVersionRef.current) return;
        const newPosts: Post[] = (data.posts ?? []).map((p: Post) => ({ ...p, _section: "ew" }));
        setExtraEwPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...prev, ...newPosts.filter((p) => !ids.has(p.id))];
        });
        setEwHasMore(data.hasMore ?? false);
        if (newPosts.length > 0) {
          setEwCursor(newPosts[newPosts.length - 1].contentHash);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMoreEw(false));
  }, [ewCursor, ewHasMore, loadingMoreEw]);

  // ── SSE real-time updates ──
  useEffect(() => {
    let es: EventSource | null = null;
    let retryMs = 1000;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      const since = tipHeightRef.current;
      const url = since ? `/api/events?since=${since}` : "/api/events";
      es = new EventSource(url);

      es.addEventListener("posts", (e) => {
        try {
          const data = JSON.parse(e.data);
          const newPosts: Post[] = data.posts ?? [];
          if (data.tipHeight) tipHeightRef.current = data.tipHeight;
          if (newPosts.length === 0) return;

          if (sortRef.current === "topics") {
            const params = new URLSearchParams({ sort: "topics" });
            const f = filterRef.current;
            if (f.type === "topic") params.set("topic", f.hash);
            else if (f.type === "topicless") params.set("topicless", "true");
            else if (f.type === "protocol") params.set("protocol", f.protocol);
            else {
              if (!includeTopiclessRef.current) params.set("excludeTopicless", "true");
              const excl = excludedTopicHashesRef.current;
              if (excl.length > 0) params.set("excludeTopics", excl.join(","));
            }
            fetch(`/api/feed?${params}`)
              .then((r) => r.json())
              .then((d) => {
                if (d.groups) setGroups(d.groups);
              })
              .catch(() => {});
          } else {
            if (sortDirRef.current === "asc") {
              setPosts((prev) => [...prev, ...newPosts]);
            } else {
              setPosts((prev) => [...newPosts, ...prev]);
            }
          }
        } catch {}
      });

      es.addEventListener("burns", (e) => {
        try {
          const data = JSON.parse(e.data);
          const burns: { targetHash: string; amount: number }[] =
            data.burns ?? [];
          const addMap = new Map<string, number>();
          for (const b of burns) {
            addMap.set(
              b.targetHash,
              (addMap.get(b.targetHash) ?? 0) + b.amount,
            );
          }
          setPosts((prev) =>
            prev.map((p) =>
              addMap.has(p.contentHash)
                ? { ...p, burnTotal: p.burnTotal + addMap.get(p.contentHash)! }
                : p,
            ),
          );
          setGroups((prev) =>
            prev.map((g) => ({
              ...g,
              posts: g.posts.map((p) =>
                addMap.has(p.contentHash)
                  ? {
                      ...p,
                      burnTotal: p.burnTotal + addMap.get(p.contentHash)!,
                    }
                  : p,
              ),
            })),
          );
        } catch {}
      });

      es.addEventListener("tip", (e) => {
        try {
          const { height } = JSON.parse(e.data);
          tipHeightRef.current = height;
          setPosts((prev) =>
            prev.map((p) => ({
              ...p,
              confirmations: Math.max(0, height - p.blockHeight + 1),
            })),
          );
          setGroups((prev) =>
            prev.map((g) => ({
              ...g,
              posts: g.posts.map((p) => ({
                ...p,
                confirmations: Math.max(0, height - p.blockHeight + 1),
              })),
            })),
          );
        } catch {}
      });

      es.onopen = () => {
        retryMs = 1000;
      };
      es.onerror = () => {
        es?.close();
        if (!cancelled) setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 30_000);
      };
    }

    connect();
    return () => {
      cancelled = true;
      es?.close();
    };
  }, []);

  // ── handlers ──

  const handleFeedScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
      if (!nearBottom) return;

      if (sortMode === "topics" && feedFilter.type === "all") {
        if (ewHasMore) loadMoreEw();
        return;
      }
      if (nextCursor) loadMore();
    },
    [sortMode, feedFilter.type, nextCursor, loadMore, ewHasMore, loadMoreEw],
  );

  const refreshFeed = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Called by ComposeSheet on successful Nostr post
  const handleSubmitted = useCallback((ephPost?: EphemeralPost) => {
    if (ephPost) {
      let post = ephPost;
      if (post.parentNostrId) {
        const allEph = [...myEphemeralPosts, ...homeEphemeral];
        const target = allEph.find((p) => p.nostrEventId === post.parentNostrId);
        if (target) {
          if (!post.parentContentHash && target.parentContentHash) {
            post = { ...post, parentContentHash: target.parentContentHash };
          }
          const btcParent = post.parentContentHash ?? target.parentContentHash;
          if (btcParent) {
            setExpandedPostId(btcParent);
            setThreadPostId(btcParent);
          }
        }
      }

      setMyEphemeralPosts((prev) => [post, ...prev]);

      const sectionKey = post.topicHash ?? "_root";
      setCollapsedTopics((prev) => {
        const next = new Set(prev);
        next.delete(sectionKey);
        return next;
      });
    } else {
      refreshFeed();
    }
    setComposing(null);
  }, [refreshFeed, myEphemeralPosts, homeEphemeral]);

  const resetHome = useCallback(() => {
    setFeedFilter({ type: "all" });
    setSearchQuery("");
    setExcludedTopicHashes([]);
    setIncludeTopicless(true);
    setSortMode("topics");
    setSortDirections({ new: "desc", top: "desc" });
    setCollapsedTopics(new Set());
    window.history.pushState({}, "", "/");
  }, []);

  const handleSortChange = useCallback((mode: SortMode) => {
    if (sortRef.current === mode) {
      if (mode === "new" || mode === "top") {
        setSortDirections((prev) => ({ ...prev, [mode]: prev[mode] === "asc" ? "desc" : "asc" }));
      }
    } else {
      setSortMode(mode);
    }
  }, []);

  const goToSection = useCallback((sectionKey: string, topic?: { hash: string; name: string | null; totalBurned: number } | null) => {
    let newFilter: FeedFilter;
    if (sectionKey === "_root") {
      newFilter = { type: "topicless" };
      setFeedFilter(newFilter);
      setSearchQuery("/");
    } else if (sectionKey === "_ew") {
      newFilter = { type: "protocol", protocol: "ew", label: "EternityWall" };
      setFeedFilter(newFilter);
      setSearchQuery("EternityWall");
    } else if (topic) {
      newFilter = { type: "topic", hash: topic.hash, name: topic.name };
      setFeedFilter(newFilter);
      setSearchQuery(topic.name ?? topic.hash.slice(0, 8));
    } else {
      return;
    }
    window.history.pushState({}, "", buildPath(newFilter));
  }, [setFeedFilter, setSearchQuery]);

  const openThread = useCallback((id: string, topicName?: string | null) => {
    if (!id.startsWith("_") && !id.startsWith("eph_")) {
      fetch("/api/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentHash: id }),
      }).catch(() => {});
    }
    setThreadTopicName(topicName ?? null);
    setExpandedPostId(id);
    setThreadPostId(id);
    const url = buildPath(filterRef.current, id);
    window.history.pushState({ thread: id }, "", url);
  }, []);

  const closeThread = useCallback(() => {
    setThreadPostId(null);
    setExpandedPostId(null);
    setThreadTopicName(null);
    window.history.replaceState({}, "", buildPath(filterRef.current));
  }, []);

  // Restore navigation state from URL on mount
  useEffect(() => {
    const applyPath = (pathname: string) => {
      const parsed = parsePath(pathname);
      if (parsed.protocol) {
        const label = parsed.protocol === "ew" ? "EternityWall" : parsed.protocol;
        setFeedFilter({ type: "protocol", protocol: parsed.protocol, label });
        setSearchQuery(label);
      } else if (parsed.topicName && parsed.topicHash) {
        setFeedFilter({ type: "topic", hash: parsed.topicHash, name: parsed.topicName });
        setSearchQuery(parsed.topicName);
      } else if (pathname.split("/").filter(Boolean)[0]?.toLowerCase() === "untagged") {
        setFeedFilter({ type: "topicless" });
        setSearchQuery("untagged");
      } else if (!parsed.postId) {
        setFeedFilter({ type: "all" });
        setSearchQuery("");
      }
      if (parsed.postId) {
        setExpandedPostId(parsed.postId);
        setThreadPostId(parsed.postId);
      }
    };

    // Handle legacy #post= URLs
    const hash = window.location.hash;
    if (hash.startsWith("#post=")) {
      const id = hash.slice(6);
      if (id) {
        setExpandedPostId(id);
        setThreadPostId(id);
        window.history.replaceState({ thread: id }, "", buildPath(filterRef.current, id));
      }
    } else {
      applyPath(window.location.pathname);
    }

    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.thread) {
        setExpandedPostId(e.state.thread);
        setThreadPostId(e.state.thread);
      } else {
        setThreadPostId(null);
        setExpandedPostId(null);
        setThreadTopicName(null);
        applyPath(window.location.pathname);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Swipe-right to go back (mobile)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch.clientX < 40) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    } else {
      touchStartRef.current = null;
    }
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !expandedPostId) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);
    touchStartRef.current = null;
    if (dx > 80 && dy < 100) {
      if (window.history.state?.thread) window.history.back();
      else closeThread();
    }
  }, [expandedPostId, closeThread]);

  const resolveTopicForReply = useCallback((postId: string): string | null => {
    if (feedFilter.type === "topic" && feedFilter.name) return feedFilter.name;
    const allPosts = [...posts, ...groups.flatMap((g) => g.posts)];
    const match = allPosts.find((p) => p.id === postId);
    return match?.topicName ?? null;
  }, [posts, groups, feedFilter]);

  const expandPost = useCallback((id: string) => {
    if (expandedPostId === id) {
      if (window.history.state?.thread) window.history.back();
      else closeThread();
      return;
    }
    const allPosts = [...posts, ...groups.flatMap((g) => g.posts)];
    const match = allPosts.find((p) => p.id === id);
    openThread(id, match?.topicName);
  }, [posts, groups, openThread, expandedPostId, closeThread]);

  const viewedRef = useRef(new Set<string>());
  const viewBatchRef = useRef<string[]>([]);
  const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushViews = useCallback(() => {
    const batch = viewBatchRef.current;
    viewBatchRef.current = [];
    viewTimerRef.current = null;
    if (batch.length === 0) return;
    fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentHashes: batch }),
    }).catch(() => {});
  }, []);

  const onPostVisible = useCallback((id: string) => {
    if (id.startsWith("_") || id.startsWith("eph_")) return;
    if (viewedRef.current.has(id)) return;
    viewedRef.current.add(id);
    viewBatchRef.current.push(id);
    if (!viewTimerRef.current) {
      viewTimerRef.current = setTimeout(flushViews, 2000);
    }
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, viewCount: (p.viewCount ?? 0) + 1 } : p));
    setGroups((prev) => prev.map((g) => ({
      ...g,
      posts: g.posts.map((p) => p.id === id ? { ...p, viewCount: (p.viewCount ?? 0) + 1 } : p),
    })));
  }, [flushViews]);

  const toggleTopic = useCallback((key: string) => {
    setCollapsedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <TextSizeCtx.Provider value={textSize}>
      <div className="flex h-dvh flex-col bg-black text-white md:max-w-md md:mx-auto md:border-x md:border-border">
        <TopBar
            feedFilter={feedFilter}
            onFeedFilterChange={(f: FeedFilter) => {
              setFeedFilter(f);
              if (f.type === "all") {
                window.history.pushState({}, "", "/");
              } else {
                window.history.pushState({}, "", buildPath(f));
              }
            }}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            sortMode={sortMode}
            sortDirections={sortDirections}
            onSortChange={handleSortChange}
            textSize={textSize}
            onTextSizeChange={setTextSize}
            onCompose={() =>
              setComposing({
                replyToId: null,
                topicName: feedFilter.type === "topic" ? feedFilter.name : null,
              })
            }
            onOpenProfile={() => setShowProfile(true)}
            hasProfileActivity={hasProfileActivity}
            includeTopicless={includeTopicless}
            onIncludeTopiclessChange={setIncludeTopicless}
            excludedTopicHashes={excludedTopicHashes}
            onExcludedTopicHashesChange={setExcludedTopicHashes}
            onReset={resetHome}
            expandedPostId={expandedPostId}
            expandedTopicName={threadTopicName}
            onBack={() => {
              if (window.history.state?.thread) window.history.back();
              else closeThread();
            }}
          />

        <div
          className="relative flex-1 overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {showFeed ? (
            loading && groups.length === 0 && posts.length === 0 ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white/30" />
              </div>
            ) : error ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2">
                <span className={`${sz} text-white/10`}>error</span>
                <button
                  onClick={refreshFeed}
                  className={`${sz} text-white/20 hover:text-white/40 transition-colors`}
                >
                  retry
                </button>
              </div>
            ) : (
              <div
                data-feed-scroll
                className="h-full overflow-y-auto"
                onScroll={handleFeedScroll}
              >
                {sortMode === "topics" && feedFilter.type === "all"
                  ? <TopicsFeed
                      groups={groups}
                      posts={posts}
                      collapsedTopics={collapsedTopics}
                      toggleTopic={toggleTopic}
                      feedFilter={feedFilter}
                      setFeedFilter={setFeedFilter}
                      setSearchQuery={setSearchQuery}
                      expandPost={expandPost}
                      onPostVisible={onPostVisible}
                      excludedTopicHashes={excludedTopicHashes}
                      includeTopicless={includeTopicless}
                      untaggedHasMore={untaggedHasMore}
                      ewHasMore={ewHasMore}
                      goToSection={goToSection}
                      expandPreview={false}
                      sz={sz}
                      ephemeralPosts={homeEphemeral}
                      expandedPostId={expandedPostId}
                      onReply={(id) => setComposing({ replyToId: id, topicName: resolveTopicForReply(id) })}
                      onReplyEphemeral={(ep) => setComposing({ replyToId: null, replyToNostrId: ep.nostrEventId, topicName: ep.topic })}
                      onInscribeEphemeral={(ep) => setComposing({ replyToId: null, topicName: ep.topic, initialText: ep.content })}
                      myEphemeralPosts={myEphemeralPosts}
                      extraEwPosts={extraEwPosts}
                      loadMoreEw={loadMoreEw}
                      loadingMoreEw={loadingMoreEw}
                    />
                  : (
                    <>
                      {posts.length === 0 && homeEphemeral.length === 0 ? (
                        (excludedTopicHashes.length > 0 || !includeTopicless) && feedFilter.type === "all" ? (
                          <div className={`flex h-32 items-center justify-center ${sz} text-white/10`}>—</div>
                        ) : feedFilter.type === "all" ? (
                          <FeedCard post={HELLO_WORLD} onExpand={() => {}} />
                        ) : (
                          <div className={`flex h-32 items-center justify-center ${sz} text-white/10`}>—</div>
                        )
                      ) : (
                        <>
                          {posts.length > 0 && (
                            <div className="bg-[#111111]">
                              {(() => {
                                const seen = new Set<string>();
                                const isTopicView = feedFilter.type === "topic";
                                const deduped = posts.filter((p) => {
                                  if (seen.has(p.id)) return false;
                                  seen.add(p.id);
                                  return true;
                                });
                                const lastId = isTopicView && deduped.length > 0 ? deduped[deduped.length - 1].id : null;
                                return deduped.flatMap((p) => {
                                  const isExpanded = expandedPostId === p.id;
                                  const isLast = p.id === lastId;
                                  const showFullThread = isExpanded || isLast;
                                  return [
                                    <FeedCard
                                      key={p.id}
                                      post={p}
                                      onExpand={expandPost}
                                      onVisible={onPostVisible}
                                      onReply={(id) => setComposing({ replyToId: id, topicName: resolveTopicForReply(id) })}
                                      expandPreview
                                      isExpanded={isExpanded}
                                    />,
                                    ...(showFullThread ? [
                                      <InlineThread
                                        key={`thread-${p.id}`}
                                        postId={p.id}
                                        onReply={(id) => setComposing({ replyToId: id, topicName: resolveTopicForReply(id) })}
                                        onReplyEphemeral={(ep) => setComposing({ replyToId: null, replyToNostrId: ep.nostrEventId, topicName: ep.topic })}
                                        onInscribeEphemeral={(ep) => setComposing({ replyToId: null, topicName: ep.topic, initialText: ep.content })}
                                        onViewTx={(hash) => expandPost(hash)}
                                        initialEphemeralPosts={myEphemeralPosts.filter((e) => e.parentContentHash === p.id)}
                                      />
                                    ] : isTopicView ? [
                                      <ThreadPreview
                                        key={`preview-${p.id}`}
                                        postId={p.id}
                                        onExpand={expandPost}
                                      />
                                    ] : []),
                                  ];
                                });
                              })()}
                            </div>
                          )}
                          {nextCursor && (
                            <div className="flex justify-center py-6">
                              {loadingMore ? (
                                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                              ) : (
                                <button
                                  onClick={loadMore}
                                  className={`${sz} text-white/15 hover:text-white/30 transition-colors`}
                                >
                                  more
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                      {/* Nostr section for topic views */}
                      {feedFilter.type === "topic" && (() => {
                        const myTopicEph = myEphemeralPosts.filter((e) =>
                          !e.parentContentHash && e.topicHash === feedFilter.hash
                        );
                        const myTopicIds = new Set(myTopicEph.map((m) => m.nostrEventId));
                        const serverTopicEph = homeEphemeral.filter((ep) => !myTopicIds.has(ep.nostrEventId));
                        const allTopicEph = [...myTopicEph, ...serverTopicEph];
                        if (allTopicEph.length === 0) return null;

                        const byId = new Map(allTopicEph.map((ep) => [ep.nostrEventId, ep]));
                        const childrenOf = new Map<string, EphemeralPost[]>();
                        const roots: EphemeralPost[] = [];
                        for (const ep of allTopicEph) {
                          if (ep.parentNostrId && byId.has(ep.parentNostrId)) {
                            const arr = childrenOf.get(ep.parentNostrId) ?? [];
                            arr.push(ep);
                            childrenOf.set(ep.parentNostrId, arr);
                          } else if (!ep.parentNostrId) {
                            roots.push(ep);
                          }
                        }

                        function renderTopicBranch(posts: EphemeralPost[], depth: number): React.ReactNode {
                          return posts.map((ep) => {
                            const kids = childrenOf.get(ep.nostrEventId) ?? [];
                            return (
                              <div key={ep.nostrEventId}>
                                <EphemeralPostCard
                                  post={ep}
                                  optimistic={myTopicIds.has(ep.nostrEventId)}
                                  onReply={(p) => setComposing({ replyToId: null, replyToNostrId: p.nostrEventId, topicName: p.topic })}
                                  onInscribe={(p) => setComposing({ replyToId: null, topicName: p.topic, initialText: p.content })}
                                  onViewTx={(hash) => expandPost(hash)}
                                />
                                {kids.length > 0 && (
                                  <div className="ml-3 border-l border-dashed border-white/[0.08]">
                                    {renderTopicBranch(kids, depth + 1)}
                                  </div>
                                )}
                              </div>
                            );
                          });
                        }

                        return (
                          <div className="bg-[#111111] mb-2">
                            <div className="pl-4">
                              {renderTopicBranch(roots, 0)}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
              </div>
            )
          ) : (
            <SearchView
              query={searchQuery}
              onExpand={(id) => {
                openThread(id);
              }}
            />
          )}
        </div>

        {composing && (
          <ComposeSheet
            replyToId={composing.replyToId}
            replyToNostrId={composing.replyToNostrId ?? null}
            topicName={composing.topicName}
            initialText={composing.initialText}
            onClose={() => setComposing(null)}
            onSubmitted={handleSubmitted}
          />
        )}

        {showProfile && (
          <ProfileSheet
            onClose={() => setShowProfile(false)}
            onExpand={(id) => { setShowProfile(false); openThread(id); }}
            onReplyEphemeral={(ep) => setComposing({ replyToId: null, replyToNostrId: ep.nostrEventId, topicName: ep.topic })}
            onCompose={() => setComposing({ replyToId: null, topicName: feedFilter.type === "topic" ? feedFilter.name : null })}
            textSize={textSize}
            onTextSizeChange={setTextSize}
            myEphemeralPosts={myEphemeralPosts}
          />
        )}
      </div>
    </TextSizeCtx.Provider>
  );
}
