"use client";

import { useState, useCallback } from "react";

interface ShareButtonProps {
  contentHash: string;
  /** Optional context for share text */
  funderCount?: number;
  poolBalance?: string;
  size?: "sm" | "md";
}

export function ShareButton({ contentHash, funderCount, poolBalance, size = "sm" }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/v/${contentHash}`
    : `/v/${contentHash}`;

  const shareText = funderCount && funderCount > 0
    ? `${funderCount} people funded this content's survival.${poolBalance ? ` ${poolBalance} sats committed.` : ""} ${shareUrl}`
    : shareUrl;

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [shareUrl]);

  const btnClass = size === "sm"
    ? "px-2.5 py-1 text-xs"
    : "px-3 py-1.5 text-sm";

  if (!open) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`rounded-md border border-border text-muted hover:text-foreground hover:border-accent/50 transition-colors ${btnClass}`}
      >
        Share
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={copyLink}
        className={`rounded-md bg-surface-2 text-muted hover:text-foreground transition-colors ${btnClass}`}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`rounded-md bg-surface-2 text-muted hover:text-foreground transition-colors ${btnClass}`}
      >
        Twitter
      </a>
      <a
        href={`https://nostr.com/intent?text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`rounded-md bg-surface-2 text-muted hover:text-foreground transition-colors ${btnClass}`}
      >
        Nostr
      </a>
      <button
        onClick={() => setOpen(false)}
        className={`text-muted hover:text-foreground ${btnClass}`}
      >
        &times;
      </button>
    </div>
  );
}
