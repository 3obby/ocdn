"use client";

import Link from "next/link";

interface CitationListProps {
  citedBy: { hash: string; edgeType: string }[];
  cites: { hash: string; edgeType: string }[];
}

export function CitationList({ citedBy, cites }: CitationListProps) {
  return (
    <div className="space-y-4">
      {/* Cited by */}
      <div>
        <h4 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
          Cited by ({citedBy.length})
        </h4>
        {citedBy.length === 0 ? (
          <p className="text-sm text-muted">No incoming citations yet.</p>
        ) : (
          <ul className="space-y-1">
            {citedBy.map((c) => (
              <li key={c.hash} className="flex items-center gap-2">
                <EdgeBadge type={c.edgeType} />
                <Link
                  href={`/v/${c.hash}`}
                  className="font-mono text-xs text-accent hover:underline"
                >
                  {c.hash.slice(0, 12)}...{c.hash.slice(-8)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Cites */}
      <div>
        <h4 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
          Cites ({cites.length})
        </h4>
        {cites.length === 0 ? (
          <p className="text-sm text-muted">No outgoing citations.</p>
        ) : (
          <ul className="space-y-1">
            {cites.map((c) => (
              <li key={c.hash} className="flex items-center gap-2">
                <EdgeBadge type={c.edgeType} />
                <Link
                  href={`/v/${c.hash}`}
                  className="font-mono text-xs text-accent hover:underline"
                >
                  {c.hash.slice(0, 12)}...{c.hash.slice(-8)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EdgeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    ref: "bg-accent/20 text-accent",
    body: "bg-success/20 text-success",
    list: "bg-warning/20 text-warning",
  };

  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[type] ?? "bg-surface-2 text-muted"}`}
    >
      {type}
    </span>
  );
}
