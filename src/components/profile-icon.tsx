"use client";

import { useState, useEffect, useCallback } from "react";
import { getStoredIdentity, getSessionPubkey, type SessionIdentity } from "@/lib/nostr/client";
import { useTextSize, ts } from "@/lib/text-size";
import type { TextSize } from "@/lib/text-size";
import type { Post, EphemeralPost, SortMode } from "@/lib/mock-data";
import { formatSats, formatTime, shortPubkey, shortNostrPubkey } from "@/lib/mock-data";
import { ArrowLeft, ArrowUp, ArrowDown, User, Home, Clock, Sigma, Plus, Pencil } from "lucide-react";
import { EphemeralPostCard } from "@/components/ephemeral-post-card";

type ParentContext = {
  btc: Record<string, { text: string; authorPubkey: string; topicName: string | null }>;
  ephemeral: Record<string, EphemeralPost>;
};

export function ProfileIcon({ onOpenProfile, identity }: { onOpenProfile?: () => void; identity: SessionIdentity | null }) {
  if (identity) {
    const monogram = identity.bitcoinPubkey.slice(0, 4).toUpperCase();
    return (
      <button
        onClick={onOpenProfile}
        aria-label="Profile"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.12] text-white/70 hover:bg-white/[0.20] hover:text-white transition-colors font-mono text-[10px]"
        title={`Bitcoin pubkey: ${shortPubkey(identity.bitcoinPubkey)}`}
      >
        {monogram}
      </button>
    );
  }

  return (
    <button
      onClick={onOpenProfile}
      aria-label="Profile"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/30 hover:bg-white/[0.12] hover:text-white/60 transition-colors"
      title="my posts"
    >
      <User size={13} strokeWidth={1.5} />
    </button>
  );
}

export function ProfileSheet({
  onClose,
  onExpand,
  onReplyEphemeral,
  onCompose,
  textSize,
  onTextSizeChange,
  myEphemeralPosts = [],
}: {
  onClose: () => void;
  onExpand?: (id: string) => void;
  onReplyEphemeral?: (post: EphemeralPost) => void;
  onCompose?: () => void;
  textSize: TextSize;
  onTextSizeChange: (s: TextSize) => void;
  myEphemeralPosts?: EphemeralPost[];
}) {
  const sz = useTextSize();
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);
  const [durablePosts, setDurablePosts] = useState<Post[]>([]);
  const [ephPosts, setEphPosts] = useState<EphemeralPost[]>([]);
  const [parents, setParents] = useState<ParentContext>({ btc: {}, ephemeral: {} });
  const [expiredCount, setExpiredCount] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("new");
  const [sortDirections, setSortDirections] = useState<Record<string, "asc" | "desc">>({ new: "desc", top: "desc" });
  const [loading, setLoading] = useState(false);

  const sessionPubkey = typeof window !== "undefined" ? getSessionPubkey() : null;
  const sortDirection = sortDirections[sortMode] ?? "desc";
  const apiSort = sortMode === "topics" ? "new" : sortMode;

  const handleSortChange = useCallback((mode: SortMode) => {
    if (mode === "topics") mode = "new";
    if (sortMode === mode) {
      setSortDirections((prev) => ({ ...prev, [mode]: prev[mode] === "asc" ? "desc" : "asc" }));
    } else {
      setSortMode(mode);
    }
  }, [sortMode]);

  useEffect(() => {
    const id = getStoredIdentity();
    setIdentity(id);
    if (!id) return;

    fetch(`/api/author/${id.bitcoinPubkey}`)
      .then((r) => r.json())
      .then((data) => setDurablePosts(data.posts ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!sessionPubkey) return;
    setLoading(true);
    fetch(`/api/ephemeral?pubkey=${sessionPubkey}&sort=${apiSort}&order=${sortDirection}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        setEphPosts(data.posts ?? []);
        setParents(data.parents ?? { btc: {}, ephemeral: {} });
        setExpiredCount(data.expiredCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionPubkey, apiSort, sortDirection]);

  const serverIds = new Set(ephPosts.map((p) => p.nostrEventId));
  const optimistic = myEphemeralPosts.filter((p) => !serverIds.has(p.nostrEventId));
  const allEph = [...optimistic, ...ephPosts];

  const hasAnything = allEph.length > 0 || durablePosts.length > 0;

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
    <div className="fixed inset-0 z-50 flex flex-col bg-black md:max-w-md md:mx-auto md:border-x md:border-border">
      {/* TopBar replica — row 1: back + search area */}
      <div className="shrink-0 border-b border-border bg-elevated">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            onClick={onClose}
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.09] text-white/70 hover:bg-white/[0.15] hover:text-white transition-colors"
          >
            <ArrowLeft size={iconSize} strokeWidth={2} />
          </button>
          <div className="flex min-w-0 flex-1 items-center rounded-full bg-white/[0.06] h-10 px-3">
            <span className={`${ts(sz)} text-white/20 truncate`}>my posts</span>
            <div className="flex-1" />
            {expiredCount > 0 && (
              <span className="text-[10px] text-white/15 tabular-nums shrink-0">
                {expiredCount} expired
              </span>
            )}
          </div>
        </div>

        {/* TopBar replica — row 2: text size | sort pill | compose */}
        <div className="flex items-center pl-5 pr-3 py-2 border-t border-border/50">
          <div className="flex flex-1 items-center gap-2">
            <button
              onClick={() => onTextSizeChange(textSize === "sm" ? "lg" : "sm")}
              className="flex items-baseline gap-0 text-white/40 hover:text-white/70 transition-colors"
            >
              <span className={`${textSize === "sm" ? "text-white" : ""} text-[11px] leading-none`}>a</span>
              <span className={`${textSize === "lg" ? "text-white" : ""} text-[18px] leading-none`}>A</span>
            </button>
            {sessionPubkey && (
              <span className="font-mono text-[10px] text-white/10 truncate max-w-[60px]">
                {sessionPubkey.slice(0, 8)}…
              </span>
            )}
          </div>

          <div className="flex items-center rounded-full bg-white/[0.06] p-0.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => handleSortChange(m.key)}
                aria-label={m.key}
                className={`flex items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${
                  sortMode === m.key || (m.key === "topics" && sortMode === "new")
                    ? m.key === "topics"
                      ? "text-white/25 hover:text-white/50"
                      : "bg-white/[0.12] text-white"
                    : "text-white/25 hover:text-white/50"
                }`}
              >
                {m.icon}
              </button>
            ))}
          </div>

          <div className="flex flex-1 items-center justify-end">
            {onCompose && (
              <button
                onClick={onCompose}
                aria-label="Compose"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.09] text-white/70 hover:bg-white/[0.15] hover:text-white transition-colors"
              >
                <Plus size={iconSize} strokeWidth={2} className="mr-0.5" />
                <Pencil size={iconSize - 2} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && allEph.length === 0 && durablePosts.length === 0 ? (
          <div className={`flex h-32 items-center justify-center ${ts(sz)} text-white/10 animate-pulse`}>—</div>
        ) : !hasAnything ? (
          <div className={`flex flex-col h-40 items-center justify-center gap-2 ${ts(sz)} text-white/10`}>
            <span>—</span>
            <span className="text-[11px] text-white/10">post something to see it here</span>
          </div>
        ) : (
          <div>
            {allEph.map((ep) => {
              const isOptimistic = !serverIds.has(ep.nostrEventId);
              const btcParent = ep.parentContentHash ? parents.btc[ep.parentContentHash] : null;
              const ephParent = ep.parentNostrId ? parents.ephemeral[ep.parentNostrId] : null;
              const parentText = btcParent?.text ?? ephParent?.content ?? null;
              const parentAuthor = btcParent
                ? shortPubkey(btcParent.authorPubkey)
                : ephParent
                  ? shortNostrPubkey(ephParent.nostrPubkey)
                  : null;

              return (
                <div key={ep.nostrEventId} className="border-b border-white/[0.04]">
                  {parentText && (
                    <div
                      className={`mx-4 mt-2 mb-0 border-l border-dashed border-white/[0.08] pl-2.5 ${btcParent ? "cursor-pointer hover:bg-white/[0.02]" : ""}`}
                      onClick={btcParent && ep.parentContentHash ? () => { onExpand?.(ep.parentContentHash!); onClose(); } : undefined}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-white/15 mb-0.5">
                        {btcParent?.topicName && <span className="text-burn/40">{btcParent.topicName}</span>}
                        {parentAuthor && <span>{parentAuthor}</span>}
                      </div>
                      <p className="text-[13px] text-white/25 line-clamp-2 leading-snug">
                        {parentText}
                      </p>
                    </div>
                  )}
                  <EphemeralPostCard
                    post={ep}
                    optimistic={isOptimistic}
                    onReply={onReplyEphemeral}
                  />
                </div>
              );
            })}

            {durablePosts.length > 0 && (
              <div className={`${allEph.length > 0 ? "mt-2 border-t border-white/[0.06]" : ""}`}>
                {durablePosts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onExpand?.(p.id); onClose(); }}
                    className="w-full text-left px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-white/[0.04]"
                  >
                    <div className="flex items-center gap-2 text-white/20 mb-0.5">
                      <span className="text-burn/60 tabular-nums text-[11px]">{formatSats(p.burnTotal)}</span>
                      <span className="text-[11px]">{formatTime(p.timestamp)}</span>
                      {p.topicName && (
                        <span className="text-[11px] text-white/30">{p.topicName}</span>
                      )}
                    </div>
                    <p className={`${ts(sz)} text-white/70 line-clamp-2 leading-snug`}>{p.text}</p>
                  </button>
                ))}
              </div>
            )}

            {!identity && allEph.length > 0 && durablePosts.length === 0 && (
              <div className="px-4 py-6 text-center text-[11px] text-white/15">
                post permanently with bitcoin to build a lasting identity
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
