"use client";

import { useState, useEffect } from "react";

interface ContentMetaInfo {
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  status?: string | null;
}

interface BlobEmbedProps {
  hash: string;
  blossomUrls?: string[];
  meta?: ContentMetaInfo;
}

type BlobState =
  | { status: "loading" }
  | { status: "preview"; dataUrl: string; contentType: string }
  | { status: "loaded"; url: string; contentType: string }
  | { status: "l402"; invoiceUrl?: string }
  | { status: "not_served" }
  | { status: "rejected" }
  | { status: "error"; message: string };

const DEFAULT_BLOSSOM_SERVERS = [
  "https://blossom.primal.net",
  "https://cdn.satellite.earth",
];

export function BlobEmbed({ hash, blossomUrls, meta }: BlobEmbedProps) {
  const [state, setState] = useState<BlobState>({ status: "loading" });

  const servers = blossomUrls ?? DEFAULT_BLOSSOM_SERVERS;

  useEffect(() => {
    let cancelled = false;

    // Rejected by operator — don't try to fetch
    if (meta?.status === "rejected") {
      setState({ status: "rejected" });
      return;
    }

    // Check sessionStorage for local preview first (instant render after upload)
    if (typeof window !== "undefined") {
      try {
        const preview = sessionStorage.getItem(`ocdn_preview_${hash}`);
        if (preview) {
          const ct = preview.match(/^data:([^;]+);/)?.[1] ?? "application/octet-stream";
          setState({ status: "preview", dataUrl: preview, contentType: ct });
          // Clear after use — Blossom should serve it next time
          sessionStorage.removeItem(`ocdn_preview_${hash}`);
          return;
        }
      } catch {
        // sessionStorage unavailable
      }
    }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  switch (state.status) {
    case "loading":
      return (
        <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-surface">
          <span className="text-muted animate-pulse">Loading content...</span>
        </div>
      );

    case "preview":
      return (
        <div className="space-y-2">
          <BlobRenderer url={state.dataUrl} contentType={state.contentType} />
          <StatusBadge status={meta?.status} />
        </div>
      );

    case "loaded":
      return (
        <div className="space-y-2">
          <BlobRenderer url={state.url} contentType={state.contentType} />
          {meta?.status && meta.status !== "live" && <StatusBadge status={meta.status} />}
        </div>
      );

    case "l402":
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface">
          <span className="text-warning font-medium">Payment required (L402)</span>
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-dim">
            Pay to view
          </button>
        </div>
      );

    case "rejected":
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-danger/30 bg-surface">
          <span className="text-danger font-medium">Content removed by operator</span>
          <p className="text-xs text-muted max-w-xs text-center">
            This content was reviewed and removed. The pool balance remains — Fortify
            to signal demand and attract other hosts.
          </p>
        </div>
      );

    case "not_served":
      // If we have metadata, show a type-aware placeholder instead of a blank wall
      if (meta?.fileType || meta?.fileName) {
        return (
          <div className="space-y-2">
            <MetadataPlaceholder meta={meta} />
            <StatusBadge status={meta?.status} />
          </div>
        );
      }
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

// --- Sub-components ---

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

  if (contentType.startsWith("video/")) {
    return (
      <video src={url} controls className="max-w-full rounded-lg">
        Your browser does not support video playback.
      </video>
    );
  }

  if (contentType.startsWith("audio/")) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-border bg-surface p-4">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }

  // Fallback: download link
  return (
    <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-surface">
      <a href={url} className="text-accent hover:underline" download>
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

/** Type-aware placeholder when blob exists in index but isn't served yet */
function MetadataPlaceholder({ meta }: { meta: ContentMetaInfo }) {
  const icon = getTypeIcon(meta.fileType);
  const typeLabel = getTypeLabel(meta.fileType);

  return (
    <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface">
      <span className="text-4xl">{icon}</span>
      <div className="text-center">
        {meta.fileName && (
          <p className="text-sm font-medium text-foreground truncate max-w-xs">
            {meta.fileName}
          </p>
        )}
        <p className="text-xs text-muted">
          {typeLabel}
          {meta.fileSize ? ` · ${formatBytes(meta.fileSize)}` : ""}
        </p>
      </div>
      <p className="text-xs text-muted max-w-xs text-center">
        Uploaded — waiting for Blossom host to serve.
      </p>
    </div>
  );
}

/** Moderation status badge */
function StatusBadge({ status }: { status?: string | null }) {
  if (!status || status === "live") return null;

  const styles: Record<string, string> = {
    pending: "bg-warning/15 text-warning border-warning/30",
    rejected: "bg-danger/15 text-danger border-danger/30",
  };

  const labels: Record<string, string> = {
    pending: "Pending review",
    rejected: "Removed by operator",
  };

  return (
    <div className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${styles[status] ?? "bg-surface-2 text-muted border-border"}`}>
      {labels[status] ?? status}
    </div>
  );
}

function getTypeIcon(fileType?: string | null): string {
  if (!fileType) return "📄";
  if (fileType.startsWith("image/")) return "🖼";
  if (fileType === "application/pdf") return "📑";
  if (fileType.startsWith("text/")) return "📝";
  if (fileType.startsWith("video/")) return "🎬";
  if (fileType.startsWith("audio/")) return "🎵";
  return "📄";
}

function getTypeLabel(fileType?: string | null): string {
  if (!fileType) return "File";
  if (fileType.startsWith("image/")) return "Image";
  if (fileType === "application/pdf") return "PDF";
  if (fileType.startsWith("text/")) return "Text";
  if (fileType.startsWith("video/")) return "Video";
  if (fileType.startsWith("audio/")) return "Audio";
  return fileType;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
