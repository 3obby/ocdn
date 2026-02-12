"use client";

import { useState, useEffect } from "react";

interface BlobEmbedProps {
  hash: string;
  blossomUrls?: string[];
}

type BlobState =
  | { status: "loading" }
  | { status: "loaded"; url: string; contentType: string }
  | { status: "l402"; invoiceUrl?: string }
  | { status: "not_served" }
  | { status: "error"; message: string };

const DEFAULT_BLOSSOM_SERVERS = [
  "https://blossom.primal.net",
  "https://cdn.satellite.earth",
];

export function BlobEmbed({ hash, blossomUrls }: BlobEmbedProps) {
  const [state, setState] = useState<BlobState>({ status: "loading" });

  const servers = blossomUrls ?? DEFAULT_BLOSSOM_SERVERS;

  useEffect(() => {
    let cancelled = false;

    async function tryFetch() {
      for (const server of servers) {
        try {
          const res = await fetch(`${server}/${hash}`, { method: "HEAD" });
          if (res.ok) {
            const contentType = res.headers.get("content-type") ?? "application/octet-stream";
            if (!cancelled) {
              setState({ status: "loaded", url: `${server}/${hash}`, contentType });
            }
            return;
          }
          if (res.status === 402) {
            if (!cancelled) setState({ status: "l402" });
            return;
          }
        } catch {
          continue;
        }
      }
      if (!cancelled) setState({ status: "not_served" });
    }

    tryFetch();
    return () => { cancelled = true; };
  }, [hash, servers]);

  switch (state.status) {
    case "loading":
      return (
        <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-surface">
          <span className="text-muted animate-pulse">Loading content...</span>
        </div>
      );

    case "loaded":
      return <BlobRenderer url={state.url} contentType={state.contentType} />;

    case "l402":
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface">
          <span className="text-warning font-medium">Payment required (L402)</span>
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-dim">
            Pay to view
          </button>
        </div>
      );

    case "not_served":
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface">
          <span className="text-muted">Not served by any host</span>
          <p className="text-xs text-muted max-w-xs text-center">
            This content exists in the index but no Blossom server is currently serving it.
            Fortify to attract hosts.
          </p>
        </div>
      );

    case "error":
      return (
        <div className="flex h-64 items-center justify-center rounded-lg border border-danger/30 bg-surface">
          <span className="text-danger">{state.message}</span>
        </div>
      );
  }
}

function BlobRenderer({ url, contentType }: { url: string; contentType: string }) {
  if (contentType.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="Content" className="max-w-full rounded-lg" />;
  }

  if (contentType === "application/pdf") {
    return (
      <iframe
        src={url}
        className="h-[600px] w-full rounded-lg border border-border"
        title="PDF content"
      />
    );
  }

  if (contentType.startsWith("text/")) {
    return <TextEmbed url={url} />;
  }

  // Fallback: download link
  return (
    <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-surface">
      <a
        href={url}
        className="text-accent hover:underline"
        download
      >
        Download ({contentType})
      </a>
    </div>
  );
}

function TextEmbed({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText("Failed to load text content."));
  }, [url]);

  return (
    <pre className="max-h-[600px] overflow-auto rounded-lg border border-border bg-surface p-4 text-sm font-mono whitespace-pre-wrap">
      {text ?? "Loading..."}
    </pre>
  );
}
