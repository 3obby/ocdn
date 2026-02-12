"use client";

import { useState, useCallback } from "react";
import { useIdentity } from "@/hooks/useIdentity";
import { NIP_POOL_KIND, NIP_PRESERVE_KIND, PRESERVE_TIERS, type PreserveTier } from "@/lib/constants";
import { buildPoolTags } from "@/lib/nostr/pool";

interface FortifyButtonProps {
  contentHash: string;
  size?: "sm" | "md" | "lg";
}

type FortifyMode = "preserve" | "fortify" | "fund";

export function FortifyButton({ contentHash, size = "md" }: FortifyButtonProps) {
  const { identity, sign, login, showClaim, claim } = useIdentity();
  const [mode, setMode] = useState<FortifyMode>("fortify");
  const [open, setOpen] = useState(false);
  const [sats, setSats] = useState("21");
  const [tier, setTier] = useState<PreserveTier>("bronze");
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
      // Ensure we have identity
      if (!identity.pubkey) {
        await login();
      }

      if (mode === "preserve") {
        // Build NIP-PRESERVE event
        const tierConfig = PRESERVE_TIERS[tier];
        const unsigned = {
          kind: NIP_PRESERVE_KIND,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ["r", contentHash],
            ["tier", tier],
            ["replicas", String(tierConfig.replicas)],
            ["jurisdictions", String(tierConfig.jurisdictions)],
            ["duration", String(tierConfig.durationEpochs)],
            ["max_price", "1000"], // placeholder
            ["escrow_proof", "pending"],
          ],
          content: JSON.stringify({ auto_renew: false }),
        };

        const result = await sign(unsigned);
        if (!result) {
          setError("Failed to sign event");
          return;
        }

        const res = await fetch("/api/preserve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentHash,
            tier,
            maxPriceSats: "1000",
            escrowProof: "pending",
            eventId: result.event.id,
            funderPubkey: result.event.pubkey,
          }),
        });

        if (res.ok) {
          setSuccess(true);
          setTimeout(() => setSuccess(false), 2000);
        } else {
          setError("Failed to create preserve order");
        }
      } else {
        // Fortify or Fund mode — build NIP-POOL event
        const proof = "pending"; // Will be replaced with real Lightning proof
        const tags = buildPoolTags(contentHash, BigInt(sats), proof);
        const unsigned = {
          kind: NIP_POOL_KIND,
          created_at: Math.floor(Date.now() / 1000),
          tags,
          content: mode === "fund" ? JSON.stringify({ type: "fund" }) : "",
        };

        const result = await sign(unsigned);
        if (!result) {
          setError("Failed to sign event");
          return;
        }

        // Request Lightning invoice from API
        const res = await fetch("/api/fortify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentHash,
            sats,
            proof,
            eventId: result.event.id,
            funderPubkey: result.event.pubkey,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.invoice) {
            setInvoice(data.invoice);
            // Try WebLN (Alby, etc.)
            if (typeof window !== "undefined" && "webln" in window) {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const webln = (window as any).webln;
                await webln.enable();
                await webln.sendPayment(data.invoice);
                setInvoice(null);
                setSuccess(true);
                setTimeout(() => setSuccess(false), 2000);
              } catch {
                // WebLN failed — show invoice for manual payment
              }
            }
          } else {
            // No invoice returned — direct credit (dev mode)
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2000);
          }
        } else {
          setError("Failed to process fortify");
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
      if (!invoice) setOpen(false);
    }
  }, [identity, login, sign, mode, tier, sats, contentHash, invoice]);

  // Closed state
  if (!open) {
    return (
      <div className="inline-flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className={`rounded-lg bg-accent font-semibold text-background hover:bg-accent-dim transition-colors ${sizeClasses[size]} ${success ? "bg-success" : ""}`}
        >
          {success ? "Fortified" : "Fortify"}
        </button>
        {/* Claim prompt */}
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

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      {/* Identity indicator */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">
          {identity.pubkey
            ? `${identity.mode === "nip07" ? "NIP-07" : "Ephemeral"}: ${identity.pubkey.slice(0, 12)}...`
            : "No identity — will generate ephemeral key"}
        </span>
        {identity.mode !== "nip07" && (
          <button
            onClick={login}
            className="text-accent hover:underline"
          >
            Connect NIP-07
          </button>
        )}
      </div>

      {/* Mode selector */}
      <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
        {(["preserve", "fortify", "fund"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
              mode === m
                ? "bg-accent text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Amount (fortify/fund modes) */}
      {mode !== "preserve" && (
        <div>
          <label className="block text-xs text-muted mb-1">
            Amount (sats)
          </label>
          <div className="flex gap-2">
            {["21", "100", "1000", "10000"].map((amt) => (
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
      )}

      {/* Preserve tier selector */}
      {mode === "preserve" && (
        <div className="space-y-2">
          <label className="block text-xs text-muted">Preservation tier</label>
          {(["gold", "silver", "bronze"] as const).map((t) => {
            const cfg = PRESERVE_TIERS[t];
            return (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
                  tier === t
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface-2 hover:border-accent/50"
                }`}
              >
                <span className="capitalize font-medium">{t}</span>
                <span className="text-xs text-muted">
                  {cfg.replicas} replicas · {cfg.jurisdictions} jurisdictions
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Lightning invoice display */}
      {invoice && (
        <div className="space-y-2 rounded-md border border-accent/30 bg-accent/5 p-3">
          <p className="text-xs text-accent font-medium">Lightning Invoice</p>
          <p className="break-all font-mono text-[10px] text-muted select-all">
            {invoice}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(invoice);
              }}
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

      {/* Error display */}
      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setOpen(false);
            setInvoice(null);
            setError(null);
          }}
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={handleFortify}
          disabled={loading}
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-background hover:bg-accent-dim disabled:opacity-50"
        >
          {loading
            ? "..."
            : mode === "preserve"
              ? `Preserve (${tier})`
              : `Fortify ${sats} sats`}
        </button>
      </div>
    </div>
  );
}
