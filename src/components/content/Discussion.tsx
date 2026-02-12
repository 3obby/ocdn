"use client";

import { useState, useCallback } from "react";
import { useSSE, type SSEMessage } from "@/hooks/useSSE";
import { useIdentity } from "@/hooks/useIdentity";

interface DiscussionProps {
  contentHash: string;
  initialComments?: Comment[];
}

interface Comment {
  id: string;
  pubkey: string;
  content: string;
  createdAt: number;
  satsBoost: number;
}

export function Discussion({
  contentHash,
  initialComments = [],
}: DiscussionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const { identity, sign, login } = useIdentity();

  // Subscribe to SSE for live comments
  useSSE(
    useCallback(
      (msg: SSEMessage) => {
        if (msg.type === "event" && msg.event) {
          const ev = msg.event;
          // Check if this is a comment on our content (kind 1 with ref tag)
          if (ev.kind === 1) {
            const tags: string[][] = ev.tags ?? [];
            const refTag = tags.find(
              (t: string[]) => t[0] === "r" && t[1] === contentHash
            );
            if (refTag) {
              const comment: Comment = {
                id: ev.id,
                pubkey: ev.pubkey,
                content: ev.content,
                createdAt: ev.createdAt ?? ev.created_at,
                satsBoost: 0,
              };
              setComments((prev) => {
                if (prev.some((c) => c.id === comment.id)) return prev;
                return [comment, ...prev];
              });
            }
          }
        }
      },
      [contentHash]
    ),
    { hash: contentHash }
  );

  const handlePost = async () => {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      if (!identity.pubkey) await login();

      const unsigned = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["r", contentHash]],
        content: draft.trim(),
      };

      const result = await sign(unsigned);
      if (!result) return;

      // Optimistic add
      const optimistic: Comment = {
        id: result.event.id,
        pubkey: result.event.pubkey,
        content: result.event.content,
        createdAt: result.event.created_at,
        satsBoost: 0,
      };
      setComments((prev) => [optimistic, ...prev]);
      setDraft("");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
        Discussion
      </h3>

      {/* Compose */}
      <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add to the discussion... (Nostr event referencing this content)"
          rows={3}
          className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">
            {identity.pubkey
              ? `Posting as ${identity.pubkey.slice(0, 8)}...`
              : "Connect to post"}
          </span>
          <button
            onClick={handlePost}
            disabled={posting || !draft.trim()}
            className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-background hover:bg-accent-dim disabled:opacity-50"
          >
            {posting ? "..." : "Post"}
          </button>
        </div>
      </div>

      {/* Comments */}
      {comments.length === 0 ? (
        <p className="text-sm text-muted">
          No discussion yet. Comments are Nostr events referencing this content.
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-border bg-surface p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-accent">
                  {c.pubkey.slice(0, 12)}...
                </span>
                <span className="text-xs text-muted">
                  {new Date(c.createdAt * 1000).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">
                {renderContent(c.content)}
              </p>
              {c.satsBoost > 0 && (
                <span className="mt-1 inline-block rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
                  +{c.satsBoost} sats
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Render content with [ref:bytes32] as citation links */
function renderContent(content: string): string {
  // Replace [ref:hex64] patterns with clickable links
  return content.replace(
    /\[ref:([0-9a-f]{64})\]/gi,
    (_, hash) => `[${hash.slice(0, 8)}...](/v/${hash})`
  );
}
