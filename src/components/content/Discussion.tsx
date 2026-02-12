"use client";

interface DiscussionProps {
  contentHash: string;
}

interface Comment {
  id: string;
  pubkey: string;
  content: string;
  createdAt: number;
  satsBoost: number;
}

export function Discussion({ contentHash: _contentHash }: DiscussionProps) {
  // TODO: Subscribe to Nostr events with ref=contentHash
  const comments: Comment[] = [];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
        Discussion
      </h3>

      {comments.length === 0 ? (
        <p className="text-sm text-muted">
          No discussion yet. Comments are Nostr events referencing this content.
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-accent">
                  {c.pubkey.slice(0, 12)}...
                </span>
                <span className="text-xs text-muted">
                  {new Date(c.createdAt * 1000).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm">{c.content}</p>
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
