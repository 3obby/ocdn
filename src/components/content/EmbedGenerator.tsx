"use client";

import { useState, useCallback } from "react";

interface EmbedGeneratorProps {
  contentHash: string;
}

export function EmbedGenerator({ contentHash }: EmbedGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  const embedCode = `<script src="${appUrl}/widget/embed.js" defer></script>\n<ocdn-widget hash="${contentHash}"></ocdn-widget>`;

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [embedCode]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted hover:text-foreground transition-colors"
      >
        Embed this
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">Embed code</span>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-muted hover:text-foreground"
        >
          &times;
        </button>
      </div>
      <pre className="rounded-md bg-surface-2 p-2 text-[11px] font-mono text-muted select-all overflow-x-auto">
        {embedCode}
      </pre>
      <button
        onClick={copyCode}
        className="rounded-md bg-surface-2 px-3 py-1 text-xs text-muted hover:text-foreground transition-colors"
      >
        {copied ? "Copied" : "Copy snippet"}
      </button>
    </div>
  );
}
