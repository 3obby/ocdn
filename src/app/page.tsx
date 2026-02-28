"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  formatSats,
  topicLabel,
  type SortMode,
  type TopicGroup,
  type Post,
  type FeedFilter,
} from "@/lib/mock-data";
import { ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { type TextSize, TextSizeCtx } from "@/lib/text-size";
import { TopBar } from "@/components/top-bar";
import { FeedCard } from "@/components/feed-card";
import { ThreadView } from "@/components/thread-view";
import { ComposeSheet } from "@/components/compose-sheet";
import { SearchView } from "@/components/search-view";

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
  excludedTopicHashes,
  includeTopicless,
  untaggedHasMore,
  ewHasMore,
  goToSection,
  expandPreview,
  sz,
}: {
  groups: TopicGroup[];
  posts: Post[];
  collapsedTopics: Set<string>;
  toggleTopic: (key: string) => void;
  feedFilter: FeedFilter;
  setFeedFilter: (f: FeedFilter) => void;
  setSearchQuery: (q: string) => void;
  expandPost: (id: string) => void;
  excludedTopicHashes: string[];
  includeTopicless: boolean;
  untaggedHasMore: boolean;
  ewHasMore: boolean;
  goToSection: (sectionKey: string, topic?: { hash: string; name: string | null; totalBurned: number } | null) => void;
  expandPreview?: boolean;
  sz: string;
}) {
  const ephPosts = posts.filter((p) => p.ephemeral);
  const untaggedPosts = posts.filter((p) => p._section === "untagged");
  const ewPosts = posts.filter((p) => p._section === "ew");
  const hasContent = groups.length > 0 || ephPosts.length > 0 || untaggedPosts.length > 0 || ewPosts.length > 0;

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
  ) => {
    const isCollapsed = collapsedTopics.has(sectionKey);
    const totalBurned = topic?.totalBurned ?? 0;

    return (
      <div key={sectionKey}>
        {feedFilter.type === "all" && (
          <div className="flex items-center border-b border-border">
            <button
              onClick={() => toggleTopic(sectionKey)}
              className="shrink-0 flex items-center justify-center w-10 h-10 text-white/20 hover:text-white/40 transition-colors"
            >
              {isCollapsed
                ? <ChevronRight size={14} strokeWidth={1.5} />
                : <ChevronDown size={14} strokeWidth={1.5} />
              }
            </button>
            <button
              onClick={() => goToSection(sectionKey, topic)}
              className="min-w-0 flex-1 py-3 text-left hover:bg-white/[0.03] transition-colors"
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
            {totalBurned > 0 && (
              <div className="shrink-0 pr-3">
                <span className="text-[10px] text-white/15 tabular-nums">
                  {formatSats(totalBurned)}
                </span>
              </div>
            )}
          </div>
        )}
        {!isCollapsed && sectionPosts.map((p) => (
          <FeedCard key={p.id} post={p} onExpand={expandPost} expandPreview={expandPreview} />
        ))}
      </div>
    );
  };

  return (
    <>
      {ephPosts.map((p) => (
        <FeedCard key={p.id} post={p} onExpand={() => {}} expandPreview={expandPreview} />
      ))}
      {groups.map((group) =>
        renderSection(
          group.topic?.hash ?? "_standalone",
          group.topic ? topicLabel(group.topic) : "untagged",
          group.posts,
          true,
          group.topic,
        ),
      )}
      {untaggedPosts.length > 0 && (
        <>
          {renderSection("_untagged", "untagged", untaggedPosts, false)}
          {untaggedHasMore && !collapsedTopics.has("_untagged") && (
            <button
              onClick={() => goToSection("_untagged")}
              className={`w-full py-2.5 ${sz} text-white/15 hover:text-white/30 transition-colors border-b border-border`}
            >
              more
            </button>
          )}
        </>
      )}
      {ewPosts.length > 0 && (
        <>
          {renderSection("_ew", "eternitywall", ewPosts, false)}
          {ewHasMore && !collapsedTopics.has("_ew") && (
            <button
              onClick={() => goToSection("_ew")}
              className={`w-full py-2.5 ${sz} text-white/15 hover:text-white/30 transition-colors border-b border-border`}
            >
              more
            </button>
          )}
        </>
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
  const [textSize, setTextSize] = useState<TextSize>("sm");
  const [composing, setComposing] = useState<{
    replyToId: string | null;
    topicName: string | null;
  } | null>(null);

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

  const inThread = threadPostId !== null;
  const showFeed = searchQuery.trim().length === 0 || feedFilter.type !== "all";
  const sz = textSize === "lg" ? "text-[24px]" : "text-[14px]";

  // ── fetch feed on sort/filter/refresh change ──
  useEffect(() => {
    const version = ++fetchVersionRef.current;
    setLoading(true);
    setError(null);
    setPosts([]);
    setGroups([]);
    setNextCursor(null);

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

    const ephPromise = fetch("/api/ephemeral")
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .catch(() => ({ posts: [] }));

    Promise.all([feedPromise, ephPromise])
      .then(([data, ephData]) => {
        if (version !== fetchVersionRef.current) return;

        const ephPosts: Post[] = (ephData.posts ?? []).map(
          (e: { id: string; content: string; topic: string | null; parentHash: string | null; status: string; expiresAt: string; createdAt: string }) => ({
            id: `eph_${e.id}`,
            contentHash: `eph_${e.id}`,
            protocol: "ocdn",
            authorPubkey: "0000000000000000000000000000000000000000000000000000000000000000",
            text: e.content,
            topicHash: null,
            topicName: e.topic,
            parentId: e.parentHash,
            burnTotal: 0,
            viewCount: 0,
            timestamp: new Date(e.createdAt).getTime(),
            blockHeight: 0,
            confirmations: 0,
            ephemeral: true,
            ephemeralStatus: e.status as "cached" | "paying" | "upgraded",
            expiresAt: e.expiresAt,
          }),
        );

        if (effectiveSort === "topics") {
          setGroups(data.groups ?? []);
          const untaggedPosts: Post[] = (data.untagged ?? []).map((p: Post) => ({ ...p, _section: "untagged" }));
          const ewPosts: Post[] = (data.ewPosts ?? []).map((p: Post) => ({ ...p, _section: "ew" }));
          setPosts([...ephPosts, ...untaggedPosts, ...ewPosts]);
          setUntaggedHasMore(data.untaggedHasMore ?? false);
          setEwHasMore(data.ewHasMore ?? false);
          setNextCursor(null);
        } else {
          setPosts([...ephPosts, ...(data.posts ?? [])]);
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
      if ((sortMode === "topics" && feedFilter.type === "all") || !nextCursor) return;
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
        loadMore();
      }
    },
    [sortMode, feedFilter.type, nextCursor, loadMore],
  );

  const refreshFeed = useCallback(() => setRefreshKey((k) => k + 1), []);

  const resetHome = useCallback(() => {
    setFeedFilter({ type: "all" });
    setSearchQuery("");
    setExcludedTopicHashes([]);
    setIncludeTopicless(true);
    setSortMode("topics");
    setSortDirections({ new: "desc", top: "desc" });
    setCollapsedTopics(new Set());
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
    if (sectionKey === "_untagged") {
      setFeedFilter({ type: "topicless" });
      setSearchQuery("untagged");
    } else if (sectionKey === "_ew") {
      setFeedFilter({ type: "protocol", protocol: "ew", label: "EternityWall" });
      setSearchQuery("EternityWall");
    } else if (topic) {
      setFeedFilter({ type: "topic", hash: topic.hash, name: topic.name });
      setSearchQuery(topic.name ?? topic.hash.slice(0, 8));
    }
  }, [setFeedFilter, setSearchQuery]);

  const expandPost = useCallback((id: string) => {
    if (!id.startsWith("_") && !id.startsWith("eph_")) {
      fetch("/api/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentHash: id }),
      }).catch(() => {});
    }
    setThreadPostId(id);
  }, []);

  const trackView = useCallback((contentHash: string) => {
    if (contentHash.startsWith("_") || contentHash.startsWith("eph_")) return;
    fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentHash }),
    }).catch(() => {});
  }, []);

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
      <div className="flex h-dvh flex-col bg-black text-white">
        <TopBar
            feedFilter={feedFilter}
            onFeedFilterChange={setFeedFilter}
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
            includeTopicless={includeTopicless}
            onIncludeTopiclessChange={setIncludeTopicless}
            excludedTopicHashes={excludedTopicHashes}
            onExcludedTopicHashesChange={setExcludedTopicHashes}
            onReset={resetHome}
          />

        <div className="relative flex-1 overflow-hidden">
          {inThread ? (
            <ThreadView
              postId={threadPostId!}
              onBack={() => setThreadPostId(null)}
              onReply={(id) =>
                setComposing({ replyToId: id, topicName: null })
              }
            />
          ) : showFeed ? (
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
                      excludedTopicHashes={excludedTopicHashes}
                      includeTopicless={includeTopicless}
                      untaggedHasMore={untaggedHasMore}
                      ewHasMore={ewHasMore}
                      goToSection={goToSection}
                      expandPreview={false}
                      sz={sz}
                    />
                  : posts.length === 0 ? (
                    (excludedTopicHashes.length > 0 || !includeTopicless) && feedFilter.type === "all" ? (
                      <div className={`flex h-32 items-center justify-center ${sz} text-white/10`}>—</div>
                    ) : feedFilter.type === "all" ? (
                      <FeedCard post={HELLO_WORLD} onExpand={() => {}} />
                    ) : (
                      <div className={`flex h-32 items-center justify-center ${sz} text-white/10`}>—</div>
                    )
                  ) : (
                    <>
                      {(() => {
                        const seen = new Set<string>();
                        return posts
                          .filter((p) => {
                            if (seen.has(p.id)) return false;
                            seen.add(p.id);
                            return true;
                          })
                          .map((p) => (
                            <FeedCard
                              key={p.id}
                              post={p}
                              onExpand={expandPost}
                              expandPreview
                            />
                          ));
                      })()}
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
              </div>
            )
          ) : (
            <SearchView
              query={searchQuery}
              onExpand={(id) => {
                setThreadPostId(id);
              }}
            />
          )}
        </div>

        {composing && (
          <ComposeSheet
            replyToId={composing.replyToId}
            topicName={composing.topicName}
            onClose={() => setComposing(null)}
            onSubmitted={refreshFeed}
          />
        )}
      </div>
    </TextSizeCtx.Provider>
  );
}
