"use client";

interface InstrumentClusterProps {
  poolBalance: string;
  funderCount: number;
  receiptCount: number;
  sustainabilityRatio: number;
  commitment: number;
  demand: number;
  centrality: number;
  label: string | null;
  drainPerEpoch: string;
}

export function InstrumentCluster({
  poolBalance,
  funderCount,
  receiptCount,
  sustainabilityRatio,
  commitment,
  demand,
  centrality,
  label,
  drainPerEpoch,
}: InstrumentClusterProps) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      {/* Pool balance — hero stat */}
      <div className="text-center">
        <div className="text-3xl font-bold font-mono text-accent">
          {formatSats(poolBalance)}
        </div>
        <div className="text-xs text-muted">sats in pool</div>
      </div>

      {/* Divergence label */}
      {label && (
        <div className="text-center">
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${labelStyle(label)}`}
          >
            {label}
          </span>
        </div>
      )}

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Funders" value={String(funderCount)} />
        <Metric label="Receipts" value={String(receiptCount)} />
        <Metric
          label="Sustainability"
          value={
            sustainabilityRatio >= 1
              ? "Self-sustaining"
              : `${(sustainabilityRatio * 100).toFixed(0)}%`
          }
          color={sustainabilityRatio >= 1 ? "text-success" : "text-warning"}
        />
        <Metric label="Drain/epoch" value={`${formatSats(drainPerEpoch)} sats`} />
      </div>

      {/* Importance triangle */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted uppercase tracking-wider">
          Importance Triangle
        </h4>
        <TriangleBar label="Commitment" value={commitment} />
        <TriangleBar label="Demand" value={demand} />
        <TriangleBar label="Centrality" value={centrality} />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-md bg-surface-2 p-2">
      <div className={`text-sm font-mono font-medium ${color}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function TriangleBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span className="font-mono">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2">
        <div
          className="h-1.5 rounded-full bg-accent transition-all"
          style={{ width: `${Math.min(value * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

function labelStyle(label: string): string {
  switch (label) {
    case "underpriced":
      return "bg-success/20 text-success";
    case "flash":
      return "bg-warning/20 text-warning";
    case "endowed":
      return "bg-accent/20 text-accent";
    default:
      return "bg-surface-2 text-muted";
  }
}

function formatSats(sats: string): string {
  const n = Number(sats);
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} BTC`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return sats;
}
