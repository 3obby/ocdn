"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface RefResolverProps {
  compact?: boolean;
}

const BLOSSOM_SERVER = process.env.NEXT_PUBLIC_BLOSSOM_SERVER || "";

export function RefResolver({ compact }: RefResolverProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  /** Resolve a hash/URL/eventID to /v/{hash} */
  const resolve = useCallback(
    async (value?: string) => {
      const raw = (value ?? input).trim();
      if (!raw) return;
      setLoading(true);
      setStatus(null);
      try {
        const res = await fetch(`/api/resolve/${encodeURIComponent(raw)}`);
        const data = await res.json();
        if (data.hash) {
          router.push(`/v/${data.hash}`);
        }
      } catch {
        setStatus("Failed to resolve");
        setLoading(false);
      }
    },
    [input, router]
  );

  /** Hash a file using Web Crypto API (SHA-256) */
  const hashFile = useCallback(async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }, []);

  /** Upload file to Blossom, register via /api/push, navigate to /v/{hash} */
  const pushFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setStatus(`Hashing ${file.name}...`);

      try {
        const hash = await hashFile(file);
        setInput(hash);

        // Check if already indexed
        const resolveRes = await fetch(`/api/resolve/${hash}`);
        const resolveData = await resolveRes.json();

        if (resolveData.status === "indexed" || (resolveData.pool && resolveData.pool.balance !== "0")) {
          // Already exists — just navigate
          router.push(`/v/${hash}`);
          return;
        }

        // Upload to Blossom
        if (BLOSSOM_SERVER) {
          setStatus(`Uploading to Blossom...`);
          try {
            const buffer = await file.arrayBuffer();
            const uploadRes = await fetch(`${BLOSSOM_SERVER}/upload`, {
              method: "PUT",
              headers: { "Content-Type": "application/octet-stream" },
              body: buffer,
            });
            if (!uploadRes.ok) {
              setStatus("Blossom upload failed — registering hash only");
            }
          } catch {
            setStatus("Blossom unreachable — registering hash only");
          }
        }

        // Register in index via /api/push
        setStatus("Registering in index...");
        const pushRes = await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hash,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          }),
        });

        if (pushRes.ok) {
          // Stash preview in sessionStorage so /v/{hash} can render instantly
          try {
            const buffer = await file.arrayBuffer();
            if (buffer.byteLength < 10 * 1024 * 1024) { // cap at 10MB
              const base64 = btoa(
                new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), "")
              );
              const dataUrl = `data:${file.type || "application/octet-stream"};base64,${base64}`;
              sessionStorage.setItem(`ocdn_preview_${hash}`, dataUrl);
            }
          } catch {
            // sessionStorage full or too large — skip preview, not critical
          }
          router.push(`/v/${hash}`);
        } else {
          setStatus("Failed to register content");
        }
      } catch {
        setStatus("Push failed");
      } finally {
        setLoading(false);
      }
    },
    [hashFile, router]
  );

  // --- Drag-and-drop handlers ---

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) pushFile(file);
    },
    [pushFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) pushFile(file);
    },
    [pushFile]
  );

  // --- Compact mode (header) ---
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

  // --- Full mode (homepage) ---
  return (
    <div
      className={`mx-auto max-w-xl space-y-3 ${dragging ? "ring-2 ring-accent rounded-lg p-2" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <label className="block text-sm text-muted">
        Paste URL, hash, event ID — or drop a file to push
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
          {loading ? "..." : "Resolve"}
        </button>
      </div>

      {/* File push zone */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-dashed border-border px-4 py-2 text-sm text-muted hover:border-accent hover:text-foreground transition-colors"
        >
          {status ?? "Drop a file or click to push"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />
        {dragging && (
          <span className="text-sm text-accent animate-pulse">
            Drop to push
          </span>
        )}
      </div>
    </div>
  );
}
