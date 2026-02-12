"use client";

import { useState } from "react";
import Link from "next/link";
import { FortifyButton } from "@/components/fortify/FortifyButton";

export interface ContentCardProps {
  rank: number;
  hash: string;
  score: number;
  commitment: number;
  demand: number;
  centrality: number;
  label: string | null;
  poolBalance: string;
  funderCount: number;
}

export function ContentCard({
  rank,
  hash,
  score,
  commitment,
  demand,
  centrality,
  label,
  poolBalance,
  funderCount,
}: ContentCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border">
      {/* Collapsed row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-surface transition-colors"
      >
        {/* Rank */}
        <span className="w-8 text-right font-mono text-sm text-muted">
          {rank}
        </span>

        {/* Hash (truncated) */}
        <Link
          href={`/v/${hash}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-sm text-accent hover:underline"
        >
          {hash.slice(0, 8)}...{hash.slice(-8)}
        </Link>

        {/* Divergence label */}
        {label && <DivergenceLabel label={label} />}

        {/* Score bar */}
        <div className="flex-1">
          <div className="h-1.5 rounded-full bg-surface-2">
            <div
              className="h-1.5 rounded-full bg-accent"
              style={{ width: `${Math.min(score * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Pool balance */}
        <span className="font-mono text-sm">
          {formatSats(poolBalance)} <span className="text-muted">sats</span>
        </span>

        {/* Funder count */}
        <span className="font-mono text-xs text-muted">
          {funderCount} funders
        </span>

        {/* Expand chevron */}
        <span className="text-muted">{expanded ? "−" : "+"}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border bg-surface px-4 py-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <AxisBar label="Commitment" value={commitment} />
            <AxisBar label="Demand" value={demand} />
            <AxisBar label="Centrality" value={centrality} />
          </div>

          <div className="flex items-center justify-between">
            <Link
              href={`/v/${hash}`}
              className="text-sm text-accent hover:underline"
            >
              View content &rarr;
            </Link>
            <FortifyButton contentHash={hash} size="sm" />
          </div>
        </div>
      )}
    </div>
  );
}

function AxisBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted mb-1">
        <span>{label}</span>
        <span>{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1 rounded-full bg-surface-2">
        <div
          className="h-1 rounded-full bg-accent"
          style={{ width: `${Math.min(value * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

function DivergenceLabel({ label }: { label: string }) {
  const colors: Record<string, string> = {
    underpriced: "bg-success/20 text-success",
    flash: "bg-warning/20 text-warning",
    endowed: "bg-accent/20 text-accent",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[label] ?? "bg-surface-2 text-muted"}`}
    >
      {label}
    </span>
  );
}

function formatSats(sats: string): string {
  const n = Number(sats);
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} BTC`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return sats;
}
