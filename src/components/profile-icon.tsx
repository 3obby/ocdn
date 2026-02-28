"use client";

import { useState, useEffect } from "react";
import { getStoredIdentity, getSessionPubkey, type SessionIdentity } from "@/lib/nostr/client";
import { useTextSize, ts } from "@/lib/text-size";
import type { Post } from "@/lib/mock-data";
import { formatSats, formatTime, shortPubkey } from "@/lib/mock-data";
import { ArrowLeft, User } from "lucide-react";
import { EphemeralPostCard } from "@/components/ephemeral-post-card";
import type { EphemeralPost } from "@/lib/mock-data";

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
  myEphemeralPosts = [],
}: {
  onClose: () => void;
  onExpand?: (id: string) => void;
  myEphemeralPosts?: EphemeralPost[];
}) {
  const sz = useTextSize();
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);
  const [durablePosts, setDurablePosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = getStoredIdentity();
    setIdentity(id);
    if (!id) return;

    setLoading(true);
    fetch(`/api/author/${id.bitcoinPubkey}`)
      .then((r) => r.json())
      .then((data) => setDurablePosts(data.posts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasAnything = myEphemeralPosts.length > 0 || durablePosts.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center border-b border-border px-4 gap-3">
        <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
          <ArrowLeft size={24} strokeWidth={1.5} />
        </button>
        <span className={`${ts(sz)} text-white/40`}>my posts</span>
        {identity && (
          <span className="ml-auto font-mono text-[11px] text-white/20">
            {shortPubkey(identity.bitcoinPubkey)}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className={`flex h-32 items-center justify-center ${ts(sz)} text-white/10 animate-pulse`}>—</div>
        ) : !hasAnything ? (
          <div className={`flex flex-col h-40 items-center justify-center gap-2 ${ts(sz)} text-white/10`}>
            <span>—</span>
            <span className="text-[11px] text-white/10">post something to see it here</span>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {/* Session ephemeral posts first */}
            {myEphemeralPosts.map((ep) => (
              <div key={ep.nostrEventId} className="px-2 py-1">
                <EphemeralPostCard post={ep} optimistic />
              </div>
            ))}

            {/* Durable Bitcoin posts */}
            {durablePosts.map((p) => (
              <button
                key={p.id}
                onClick={() => onExpand?.(p.id)}
                className="w-full text-left px-4 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className={`flex items-center gap-2 text-white/20 mb-0.5`}>
                  <span className="text-burn/60 tabular-nums text-[11px]">{formatSats(p.burnTotal)}</span>
                  <span className="text-[11px]">{formatTime(p.timestamp)}</span>
                  {p.topicName && (
                    <span className="text-[11px] text-white/30">{p.topicName}</span>
                  )}
                </div>
                <p className={`${ts(sz)} text-white/70 line-clamp-2 leading-snug`}>{p.text}</p>
              </button>
            ))}

            {!identity && myEphemeralPosts.length > 0 && (
              <div className={`px-4 py-6 text-center text-[11px] text-white/15`}>
                post permanently with bitcoin to build a lasting identity
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
