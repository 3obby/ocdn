"use client";

import { useState } from "react";
import {
  TOPICS,
  getGroupedFeed,
  getFlatFeed,
  formatSats,
  topicLabel,
  type SortMode,
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

  const activeTopic = TOPICS.find((t) => t.hash === topicFilter);
  const inThread = tab === "feed" && threadPostId !== null;
  const sz = textSize === "lg" ? "text-[24px]" : "text-[14px]";

  const handleTopicClick = (hash: string) => {
    setTopicFilter(hash);
    setThreadPostId(null);
    setTab("feed");
  };

  return (
    <TextSizeCtx.Provider value={textSize}>
      <div className="flex h-dvh flex-col bg-black text-white">
        {/* topic strip + sort (feed mode, not in thread) */}
        {tab === "feed" && !inThread && (
          <>
            <TopicStrip
              topics={TOPICS}
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

        {/* main content area */}
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
            ) : (
              <div className="h-full overflow-y-auto">
                {sortMode === "topics" ? (
                  getGroupedFeed(topicFilter).map((group) => (
                    <div key={group.topic?.hash ?? "_standalone"}>
                      {!topicFilter && (
                        <button
                          onClick={() =>
                            group.topic && handleTopicClick(group.topic.hash)
                          }
                          className="flex w-full items-center border-b border-border transition-colors hover:bg-white/[0.03]"
                        >
                          {group.topic ? (
                            <>
                              <div className="w-[14%] shrink-0 py-3 pl-3 pr-3 text-right">
                                <span className={`${sz} leading-tight text-burn/60 tabular-nums`}>
                                  {formatSats(group.topic.totalBurned)}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 py-3 pl-2 pr-4">
                                <span className={`${sz} leading-tight text-burn ${group.topic.name ? "" : "font-mono"}`}>
                                  {topicLabel(group.topic)}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="w-full py-3 pl-3">
                              <span className={`${sz} leading-tight text-white/20`}>
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
                ) : (
                  getFlatFeed(sortMode, topicFilter).map((p) => (
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

        {/* floating post button */}
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

        {/* compose sheet */}
        {composing && (
          <ComposeSheet
            replyToId={composing.replyToId}
            topicName={composing.topicName}
            onClose={() => setComposing(null)}
          />
        )}

        {/* bottom nav */}
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
