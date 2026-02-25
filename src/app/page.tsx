"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  formatSats,
  topicLabel,
  type SortMode,
  type Topic,
  type TopicGroup,
  type Post,
} from "@/lib/mock-data";
import { type TextSize, TextSizeCtx } from "@/lib/text-size";
import { TopicStrip } from "@/components/topic-strip";
import { FeedCard } from "@/components/feed-card";
import { ThreadView } from "@/components/thread-view";
import { ComposeSheet } from "@/components/compose-sheet";
import { BottomNav } from "@/components/bottom-nav";
import { SearchView } from "@/components/search-view";
import { SortMenu } from "@/components/sort-menu";
import { Plus } from "lucide-react";

export default function Home() {
  const [tab, setTab] = useState<"feed" | "search">("feed");
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("topics");
  const [threadPostId, setThreadPostId] = useState<string | null>(null);
  const [textSize, setTextSize] = useState<TextSize>("sm");
  const [composing, setComposing] = useState<{
    replyToId: string | null;
    topicName: string | null;
  } | null>(null);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [groups, setGroups] = useState<TopicGroup[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const tipHeightRef = useRef(0);
  const sortRef = useRef(sortMode);
  const topicRef = useRef(topicFilter);
  const fetchVersionRef = useRef(0);
  const loadingMoreRef = useRef(false);

  sortRef.current = sortMode;
  topicRef.current = topicFilter;

  const activeTopic = topics.find((t) => t.hash === topicFilter);
  const inThread = tab === "feed" && threadPostId !== null;
  const sz = textSize === "lg" ? "text-[24px]" : "text-[14px]";

  // ── fetch feed on sort/topic/refresh change ──
  useEffect(() => {
    const version = ++fetchVersionRef.current;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ sort: sortMode });
    if (topicFilter) params.set("topic", topicFilter);

    fetch(`/api/feed?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (version !== fetchVersionRef.current) return;
        if (sortMode === "topics") {
          setGroups(data.groups ?? []);
          setPosts([]);
          setNextCursor(null);
          if (!topicFilter && data.groups) {
            setTopics(
              data.groups
                .filter((g: TopicGroup) => g.topic)
                .map((g: TopicGroup) => g.topic!),
            );
          }
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
  }, [sortMode, topicFilter, refreshKey]);

  // ── load more (cursor pagination) ──
  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMoreRef.current || sortMode === "topics") return;
    loadingMoreRef.current = true;
    const version = fetchVersionRef.current;

    const params = new URLSearchParams({
      sort: sortMode,
      cursor: nextCursor,
    });
    if (topicFilter) params.set("topic", topicFilter);

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
  }, [nextCursor, sortMode, topicFilter]);

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
            if (topicRef.current) params.set("topic", topicRef.current);
            fetch(`/api/feed?${params}`)
              .then((r) => r.json())
              .then((d) => {
                if (d.groups) {
                  setGroups(d.groups);
                  if (!topicRef.current) {
                    setTopics(
                      d.groups
                        .filter((g: TopicGroup) => g.topic)
                        .map((g: TopicGroup) => g.topic!),
                    );
                  }
                }
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

  const handleTopicClick = (hash: string) => {
    setTopicFilter(hash);
    setThreadPostId(null);
    setTab("feed");
  };

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
        {tab === "feed" && !inThread && (
          <>
            <TopicStrip
              topics={topics}
              active={topicFilter}
              onSelect={(hash) => setTopicFilter(hash)}
            />
            <SortMenu
              active={sortMode}
              onChange={setSortMode}
              textSize={textSize}
              onTextSizeChange={setTextSize}
            />
          </>
        )}

        <div className="relative flex-1 overflow-hidden">
          {tab === "feed" ? (
            inThread ? (
              <ThreadView
                postId={threadPostId!}
                onBack={() => setThreadPostId(null)}
                onReply={(id) =>
                  setComposing({ replyToId: id, topicName: null })
                }
              />
            ) : loading && groups.length === 0 && posts.length === 0 ? (
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
                  groups.length === 0 ? (
                    <div
                      className={`flex h-32 items-center justify-center ${sz} text-white/10`}
                    >
                      —
                    </div>
                  ) : (
                    groups.map((group) => (
                      <div key={group.topic?.hash ?? "_standalone"}>
                        {!topicFilter && (
                          <button
                            onClick={() =>
                              group.topic &&
                              handleTopicClick(group.topic.hash)
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
                    ))
                  )
                ) : posts.length === 0 ? (
                  <div
                    className={`flex h-32 items-center justify-center ${sz} text-white/10`}
                  >
                    —
                  </div>
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
              onExpand={(id) => {
                setTab("feed");
                setThreadPostId(id);
              }}
            />
          )}
        </div>

        {tab === "feed" && !inThread && !composing && (
          <button
            onClick={() =>
              setComposing({
                replyToId: null,
                topicName: activeTopic?.name ?? null,
              })
            }
            className={`absolute bottom-18 right-4 z-10 flex items-center gap-2 bg-white text-black px-4 py-2.5 ${sz} hover:bg-white/90 transition-colors`}
          >
            <Plus size={textSize === "lg" ? 20 : 14} strokeWidth={1.5} />
            {activeTopic ? topicLabel(activeTopic) : "post"}
          </button>
        )}

        {composing && (
          <ComposeSheet
            replyToId={composing.replyToId}
            topicName={composing.topicName}
            onClose={() => setComposing(null)}
            onSubmitted={refreshFeed}
          />
        )}

        <BottomNav
          tab={tab}
          onTabChange={(t) => {
            setTab(t);
            if (t === "feed") setThreadPostId(null);
          }}
        />
      </div>
    </TextSizeCtx.Provider>
  );
}
