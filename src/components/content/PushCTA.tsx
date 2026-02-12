"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface PushCTAProps {
  contentHash: string;
}

const BLOSSOM_SERVER = process.env.NEXT_PUBLIC_BLOSSOM_SERVER || "";

/**
 * Shown on /v/{hash} when content is not indexed.
 * Prompts the user to upload a file matching this hash.
 */
export function PushCTA({ contentHash }: PushCTAProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const pushFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setStatus(`Hashing ${file.name}...`);

      try {
        // Hash the file
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

        // Verify it matches the expected hash
        if (hash !== contentHash) {
          setStatus(`Hash mismatch — file hashes to ${hash.slice(0, 12)}..., expected ${contentHash.slice(0, 12)}...`);
          setLoading(false);
          return;
        }

        // Upload to Blossom
        if (BLOSSOM_SERVER) {
          setStatus("Uploading to Blossom...");
          try {
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

        // Register in index
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
          router.refresh();
        } else {
          setStatus("Failed to register");
        }
      } catch {
        setStatus("Push failed");
      } finally {
        setLoading(false);
      }
    },
    [contentHash, router]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) pushFile(file);
    },
    [pushFile]
  );

  return (
    <div className="space-y-3">
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="rounded-lg bg-accent px-8 py-3 text-lg font-semibold text-background hover:bg-accent-dim disabled:opacity-50 transition-colors"
      >
        {loading ? status ?? "Pushing..." : "Push content for this hash"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
      />
      {status && !loading && (
        <p className="text-sm text-muted">{status}</p>
      )}
      <p className="text-xs text-muted">
        Upload a file whose SHA-256 matches this hash. It will be stored on Blossom and added to the index.
      </p>
    </div>
  );
}
