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
  timestamp: Date.now(),
  blockHeight: 0,
  confirmations: 0,
};

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>({ type: "all" });
  const [includeTopicless, setIncludeTopicless] = useState(true);
  const [excludedTopicHashes, setExcludedTopicHashes] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("topics");
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

  const tipHeightRef = useRef(0);
  const sortRef = useRef(sortMode);
  const filterRef = useRef<FeedFilter>(feedFilter);
  const includeTopiclessRef = useRef(includeTopicless);
  const excludedTopicHashesRef = useRef(excludedTopicHashes);
  const fetchVersionRef = useRef(0);
  const loadingMoreRef = useRef(false);

  sortRef.current = sortMode;
  filterRef.current = feedFilter;
  includeTopiclessRef.current = includeTopicless;
  excludedTopicHashesRef.current = excludedTopicHashes;

  const feedFilterKey =
    feedFilter.type === "all" ? `all:${includeTopicless}:${excludedTopicHashes.join(",")}` :
    feedFilter.type === "topic" ? `t:${feedFilter.hash}` :
    feedFilter.type === "topicless" ? "topicless" :
    `p:${feedFilter.protocol}`;

  const inThread = threadPostId !== null;
  const showFeed = searchQuery.trim().length === 0;
  const sz = textSize === "lg" ? "text-[24px]" : "text-[14px]";

  // ── fetch feed on sort/filter/refresh change ──
  useEffect(() => {
    const version = ++fetchVersionRef.current;
    setLoading(true);
    setError(null);

    const f = filterRef.current;
    const params = new URLSearchParams({ sort: sortMode });
    if (f.type === "topic") params.set("topic", f.hash);
    else if (f.type === "topicless") params.set("topicless", "true");
    else if (f.type === "protocol") params.set("protocol", f.protocol);
    else if (!includeTopicless) params.set("excludeTopicless", "true");

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
          (e: { id: string; content: string; topic: string | null; parentHash: string | null; expiresAt: string; createdAt: string }) => ({
            id: `eph_${e.id}`,
            contentHash: `eph_${e.id}`,
            protocol: "ocdn",
            authorPubkey: "0000000000000000000000000000000000000000000000000000000000000000",
            text: e.content,
            topicHash: null,
            topicName: e.topic,
            parentId: e.parentHash,
            burnTotal: 0,
            timestamp: new Date(e.createdAt).getTime(),
            blockHeight: 0,
            confirmations: 0,
            ephemeral: true,
            expiresAt: e.expiresAt,
          }),
        );

        if (sortMode === "topics") {
          setGroups(data.groups ?? []);
          setPosts(ephPosts);
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
  }, [sortMode, feedFilterKey, includeTopicless, excludedTopicHashes, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── load more (cursor pagination) ──
  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMoreRef.current || sortMode === "topics") return;
    loadingMoreRef.current = true;
    const version = fetchVersionRef.current;

    const params = new URLSearchParams({
      sort: sortMode,
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

    fetch(`/api/feed?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (version !== fetchVersionRef.current) return;
        setPosts((prev) => [...prev, ...(data.posts ?? [])]);
        setNextCursor(data.nextCursor ?? null);
      })
      .catch(() => {})
      .finally(() => {
        loadingMoreRef.current = false;
      });
  }, [nextCursor, sortMode, includeTopicless, excludedTopicHashes]);

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
            setPosts((prev) => [...newPosts, ...prev]);
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
      if (sortMode === "topics" || !nextCursor) return;
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
        loadMore();
      }
    },
    [sortMode, nextCursor, loadMore],
  );

  const refreshFeed = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <TextSizeCtx.Provider value={textSize}>
      <div className="flex h-dvh flex-col bg-black text-white">
        {!inThread && (
          <TopBar
            feedFilter={feedFilter}
            onFeedFilterChange={setFeedFilter}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            sortMode={sortMode}
            onSortChange={setSortMode}
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
          />
        )}

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
              <div
                className={`flex h-32 items-center justify-center ${sz} text-white/10 animate-pulse`}
              >
                —
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
                {sortMode === "topics" ? (
                  groups.length === 0 && posts.length === 0 ? (
                    (excludedTopicHashes.length > 0 || !includeTopicless) ? (
                      <div className={`flex h-32 items-center justify-center ${sz} text-white/10`}>—</div>
                    ) : (
                      <FeedCard
                        post={HELLO_WORLD}
                        onExpand={() => {}}
                      />
                    )
                  ) : (
                    <>
                    {posts.filter((p) => p.ephemeral).map((p) => (
                      <FeedCard key={p.id} post={p} onExpand={() => {}} />
                    ))}
                    {groups.map((group) => (
                      <div key={group.topic?.hash ?? "_standalone"}>
                        {feedFilter.type === "all" && (
                          <button
                            onClick={() =>
                              group.topic &&
                              setFeedFilter({ type: "topic", hash: group.topic.hash, name: group.topic.name })
                            }
                            className="flex w-full items-center border-b border-border transition-colors hover:bg-white/[0.03]"
                          >
                            {group.topic ? (
                              <>
                                <div className="w-[14%] shrink-0 py-3 pl-3 pr-3 text-right">
                                  <span
                                    className={`${sz} leading-tight text-burn/60 tabular-nums`}
                                  >
                                    {formatSats(group.topic.totalBurned)}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1 py-3 pl-2 pr-4">
                                  <span
                                    className={`${sz} leading-tight text-burn ${group.topic.name ? "" : "font-mono"}`}
                                  >
                                    {topicLabel(group.topic)}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="w-full py-3 pl-3">
                                <span
                                  className={`${sz} leading-tight text-white/20`}
                                >
                                  —
                                </span>
                              </div>
                            )}
                          </button>
                        )}
                        {group.posts.map((p) => (
                          <FeedCard
                            key={p.id}
                            post={p}
                            onExpand={(id) => setThreadPostId(id)}
                          />
                        ))}
                      </div>
                    ))}
                    </>
                  )
                ) : posts.length === 0 ? (
                  (excludedTopicHashes.length > 0 || !includeTopicless) ? (
                    <div className={`flex h-32 items-center justify-center ${sz} text-white/10`}>—</div>
                  ) : (
                    <FeedCard
                      post={HELLO_WORLD}
                      onExpand={() => {}}
                    />
                  )
                ) : (
                  posts.map((p) => (
                    <FeedCard
                      key={p.id}
                      post={p}
                      onExpand={(id) => setThreadPostId(id)}
                    />
                  ))
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
