"use client";

import { useState } from "react";

interface FortifyButtonProps {
  contentHash: string;
  size?: "sm" | "md" | "lg";
}

type FortifyMode = "preserve" | "fortify" | "fund";

export function FortifyButton({ contentHash, size = "md" }: FortifyButtonProps) {
  const [mode, setMode] = useState<FortifyMode>("fortify");
  const [open, setOpen] = useState(false);
  const [sats, setSats] = useState("21");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-8 py-3 text-lg",
  };

  const handleFortify = async () => {
    setLoading(true);
    try {
      // In production: generate NIP-POOL event, get Lightning invoice, etc.
      const res = await fetch("/api/fortify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentHash,
          sats: sats,
          proof: "pending", // TODO: real payment proof
          eventId: crypto.randomUUID().replace(/-/g, "").slice(0, 64).padEnd(64, "0"),
          funderPubkey: "anonymous", // TODO: NIP-07
        }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      }
    } catch {
      // TODO: error handling
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`rounded-lg bg-accent font-semibold text-background hover:bg-accent-dim transition-colors ${sizeClasses[size]} ${success ? "bg-success" : ""}`}
      >
        {success ? "Fortified" : "Fortify"}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      {/* Mode selector */}
      <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
        {(["preserve", "fortify", "fund"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
              mode === m ? "bg-accent text-background" : "text-muted hover:text-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Amount */}
      {mode !== "preserve" && (
        <div>
          <label className="block text-xs text-muted mb-1">Amount (sats)</label>
          <div className="flex gap-2">
            {["21", "100", "1000", "10000"].map((amt) => (
              <button
                key={amt}
                onClick={() => setSats(amt)}
                className={`rounded-md px-2.5 py-1 text-xs font-mono ${
                  sats === amt ? "bg-accent text-background" : "bg-surface-2 text-muted hover:text-foreground"
                }`}
              >
                {amt}
              </button>
            ))}
            <input
              type="number"
              value={sats}
              onChange={(e) => setSats(e.target.value)}
              className="w-20 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs font-mono text-foreground"
            />
          </div>
        </div>
      )}

      {/* Preserve tier selector */}
      {mode === "preserve" && (
        <div className="space-y-2">
          <label className="block text-xs text-muted">Preservation tier</label>
          {(["gold", "silver", "bronze"] as const).map((tier) => (
            <button
              key={tier}
              className="flex w-full items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-sm hover:border-accent transition-colors"
            >
              <span className="capitalize font-medium">{tier}</span>
              <span className="text-xs text-muted">
                {tier === "gold" && "10 replicas · 3 jurisdictions · 6mo"}
                {tier === "silver" && "5 replicas · 2 jurisdictions · 3mo"}
                {tier === "bronze" && "3 replicas · 1 jurisdiction · 1mo"}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(false)}
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={handleFortify}
          disabled={loading}
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-background hover:bg-accent-dim disabled:opacity-50"
        >
          {loading ? "..." : mode === "preserve" ? "Preserve" : `Fortify ${sats} sats`}
        </button>
      </div>
    </div>
  );
}
