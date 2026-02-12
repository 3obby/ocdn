"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface RefResolverProps {
  compact?: boolean;
}

export function RefResolver({ compact }: RefResolverProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hashProgress, setHashProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const resolve = useCallback(
    async (value?: string) => {
      const raw = (value ?? input).trim();
      if (!raw) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/resolve/${encodeURIComponent(raw)}`
        );
        const data = await res.json();
        if (data.hash) {
          router.push(`/v/${data.hash}`);
        }
      } catch {
        // TODO: show error toast
      } finally {
        setLoading(false);
      }
    },
    [input, router]
  );

  /** Hash a file using Web Crypto API (SHA-256), then resolve */
  const hashAndResolve = useCallback(
    async (file: File) => {
      setLoading(true);
      setHashProgress(`Hashing ${file.name}...`);
      try {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        setInput(hashHex);
        setHashProgress(null);
        await resolve(hashHex);
      } catch {
        setHashProgress(null);
        setLoading(false);
      }
    },
    [resolve]
  );

  // --- Drag-and-drop handlers ---

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        hashAndResolve(file);
      }
    },
    [hashAndResolve]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        hashAndResolve(file);
      }
    },
    [hashAndResolve]
  );

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 ${dragging ? "ring-2 ring-accent rounded-lg" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && resolve()}
          placeholder="Paste URL, hash, or drop file..."
          className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          onClick={() => resolve()}
          disabled={loading}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-dim disabled:opacity-50"
        >
          {loading ? "..." : "Go"}
        </button>
      </div>
    );
  }

  return (
    <div
      className={`mx-auto max-w-xl space-y-3 ${dragging ? "ring-2 ring-accent rounded-lg p-2" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <label className="block text-sm text-muted">
        Paste URL, hash, event ID, or drop a file
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && resolve()}
          placeholder="sha256 hash, blossom URL, nostr event ID..."
          className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          onClick={() => resolve()}
          disabled={loading}
          className="rounded-lg bg-accent px-6 py-2.5 font-medium text-background hover:bg-accent-dim disabled:opacity-50"
        >
          {loading ? "Resolving..." : "Resolve"}
        </button>
      </div>

      {/* File drop zone + file input */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-dashed border-border px-4 py-2 text-sm text-muted hover:border-accent hover:text-foreground transition-colors"
        >
          {hashProgress ?? "Or choose a file to hash"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />
        {dragging && (
          <span className="text-sm text-accent animate-pulse">
            Drop to hash and resolve
          </span>
        )}
      </div>
    </div>
  );
}
