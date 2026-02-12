"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RefResolverProps {
  compact?: boolean;
}

export function RefResolver({ compact }: RefResolverProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const resolve = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/resolve/${encodeURIComponent(input.trim())}`);
      const data = await res.json();
      if (data.hash) {
        router.push(`/v/${data.hash}`);
      }
    } catch {
      // TODO: show error
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && resolve()}
          placeholder="Paste URL, hash, or drop file..."
          className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          onClick={resolve}
          disabled={loading}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-dim disabled:opacity-50"
        >
          {loading ? "..." : "Go"}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-3">
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
          onClick={resolve}
          disabled={loading}
          className="rounded-lg bg-accent px-6 py-2.5 font-medium text-background hover:bg-accent-dim disabled:opacity-50"
        >
          {loading ? "Resolving..." : "Resolve"}
        </button>
      </div>
    </div>
  );
}
