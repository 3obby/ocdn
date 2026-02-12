"use client";

import { useState, useCallback } from "react";
import { useIdentity } from "@/hooks/useIdentity";
import { NIP_POOL_KIND } from "@/lib/constants";
import { buildPoolTags } from "@/lib/nostr/pool";

interface FortifyButtonProps {
  contentHash: string;
  size?: "sm" | "md" | "lg";
  /** Called after successful fortify — parent can refresh data */
  onSuccess?: (balance: string, funderCount: number) => void;
}

const PRESETS = ["21", "100", "1000", "10000"] as const;

export function FortifyButton({ contentHash, size = "md", onSuccess }: FortifyButtonProps) {
  const { identity, sign, login, showClaim, claim } = useIdentity();
  const [open, setOpen] = useState(false);
  const [sats, setSats] = useState("21");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-8 py-3 text-lg",
  };

  const handleFortify = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!identity.pubkey) {
        await login();
      }

      const proof = "pending";
      const tags = buildPoolTags(contentHash, BigInt(sats), proof);
      const unsigned = {
        kind: NIP_POOL_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: "",
      };

      const result = await sign(unsigned);
      if (!result) {
        setError("Failed to sign event");
        return;
      }

      const res = await fetch("/api/fortify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentHash,
          sats,
          proof,
          eventId: result.event.id,
          funderPubkey: result.event.pubkey,
          signedEvent: result.event,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.invoice) {
          setInvoice(data.invoice);
          // Try WebLN
          if (typeof window !== "undefined" && "webln" in window) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const webln = (window as any).webln;
              await webln.enable();
              await webln.sendPayment(data.invoice);
              setInvoice(null);
              setSuccess(true);
              onSuccess?.(data.balance ?? "0", data.funderCount ?? 0);
            } catch {
              // WebLN failed — show invoice for manual payment
            }
          }
        } else {
          // Direct credit (dev mode / no invoice)
          setSuccess(true);
          onSuccess?.(data.balance ?? "0", data.funderCount ?? 0);
        }
      } else {
        setError("Failed to process fortify");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [identity, login, sign, sats, contentHash, onSuccess]);

  // --- Success state: confirmation + share ---
  if (success) {
    const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/v/${contentHash}`;
    const shareText = `I just fortified this content with ${sats} sats. ${shareUrl}`;

    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-success font-semibold">Fortified {sats} sats</span>
        </div>
        <p className="text-xs text-muted">Share it — every click can bring more funders.</p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
            }}
            className="flex-1 rounded-md bg-surface-2 px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
          >
            Copy link
          </button>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-md bg-surface-2 px-3 py-1.5 text-xs text-center text-muted hover:text-foreground transition-colors"
          >
            Twitter
          </a>
          <a
            href={`https://nostr.com/intent?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-md bg-surface-2 px-3 py-1.5 text-xs text-center text-muted hover:text-foreground transition-colors"
          >
            Nostr
          </a>
        </div>
        <button
          onClick={() => { setSuccess(false); setOpen(false); }}
          className="text-xs text-muted hover:text-foreground"
        >
          Done
        </button>
      </div>
    );
  }

  // --- Closed state: single button ---
  if (!open) {
    return (
      <div className="inline-flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className={`rounded-lg bg-accent font-semibold text-background hover:bg-accent-dim transition-colors ${sizeClasses[size]}`}
        >
          Fortify
        </button>
        {showClaim && (
          <button
            onClick={claim}
            className="rounded-lg border border-accent/50 px-3 py-1.5 text-xs text-accent hover:bg-accent/10 transition-colors"
          >
            Claim funding
          </button>
        )}
      </div>
    );
  }

  // --- Open state: amount picker + pay ---
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      {/* Identity */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">
          {identity.pubkey
            ? `${identity.mode === "nip07" ? "NIP-07" : "Ephemeral"}: ${identity.pubkey.slice(0, 12)}...`
            : "No identity — will generate ephemeral key"}
        </span>
        {identity.mode !== "nip07" && (
          <button onClick={login} className="text-accent hover:underline">
            Connect NIP-07
          </button>
        )}
      </div>

      {/* Amount presets */}
      <div>
        <label className="block text-xs text-muted mb-1">Amount (sats)</label>
        <div className="flex gap-2">
          {PRESETS.map((amt) => (
            <button
              key={amt}
              onClick={() => setSats(amt)}
              className={`rounded-md px-2.5 py-1 text-xs font-mono ${
                sats === amt
                  ? "bg-accent text-background"
                  : "bg-surface-2 text-muted hover:text-foreground"
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

      {/* Lightning invoice */}
      {invoice && (
        <div className="space-y-2 rounded-md border border-accent/30 bg-accent/5 p-3">
          <p className="text-xs text-accent font-medium">Lightning Invoice</p>
          <p className="break-all font-mono text-[10px] text-muted select-all">
            {invoice}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(invoice)}
              className="flex-1 rounded-md bg-surface-2 px-3 py-1.5 text-xs text-muted hover:text-foreground"
            >
              Copy
            </button>
            <a
              href={`lightning:${invoice}`}
              className="flex-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-background text-center"
            >
              Open Wallet
            </a>
          </div>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-xs text-danger">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => { setOpen(false); setInvoice(null); setError(null); }}
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={handleFortify}
          disabled={loading}
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-background hover:bg-accent-dim disabled:opacity-50"
        >
          {loading ? "..." : `Fortify ${sats} sats`}
        </button>
      </div>
    </div>
  );
}
