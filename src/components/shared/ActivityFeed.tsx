"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSSE, type SSEMessage } from "@/hooks/useSSE";

interface ActivityItem {
  id: string;
  type: "fortify" | "push" | "receipt";
  hash: string;
  sats?: string;
  pubkey?: string;
  timestamp: number;
}

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial fetch
  useEffect(() => {
    fetch("/api/events?limit=15")
      .then((res) => res.json())
      .then((data) => {
        if (data.events) {
          setItems(parseEvents(data.events));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Live updates via SSE
  useSSE(
    useCallback((msg: SSEMessage) => {
      if (msg.type === "event" && msg.event) {
        const parsed = parseEvents([msg.event]);
        if (parsed.length > 0) {
          setItems((prev) => [...parsed, ...prev].slice(0, 30));
        }
      }
    }, [])
  );

  if (loading) {
    return (
      <div className="text-xs text-muted animate-pulse py-2">
        Loading activity...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-xs text-muted py-2">
        No activity yet. Be the first to Fortify content.
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 text-xs py-1 text-muted"
        >
          <span className={activityColor(item.type)}>
            {activityIcon(item.type)}
          </span>
          <Link
            href={`/v/${item.hash}`}
            className="font-mono text-accent hover:underline"
          >
            {item.hash.slice(0, 8)}...
          </Link>
          {item.sats && (
            <span className="font-mono">{formatSats(item.sats)} sats</span>
          )}
          <span className="ml-auto text-muted/60">
            {timeAgo(item.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseEvents(events: any[]): ActivityItem[] {
  const results: ActivityItem[] = [];

  for (const e of events) {
    const tags = e.tags ?? [];
    const rTag = tags.find((t: string[]) => t[0] === "r");
    const amountTag = tags.find((t: string[]) => t[0] === "amount");

    if (!rTag?.[1]) continue;

    const kind = e.kind;
    let type: ActivityItem["type"] = "fortify";
    if (kind === 30079) type = "receipt";
    if (kind === 30078 && amountTag?.[1] === "0") type = "push";

    results.push({
      id: e.id,
      type,
      hash: rTag[1],
      sats: amountTag?.[1],
      pubkey: e.pubkey,
      timestamp: e.created_at ?? e.createdAt ?? Math.floor(Date.now() / 1000),
    });
  }

  return results;
}

function activityIcon(type: ActivityItem["type"]): string {
  switch (type) {
    case "fortify": return "⚡";
    case "push": return "↑";
    case "receipt": return "✓";
  }
}

function activityColor(type: ActivityItem["type"]): string {
  switch (type) {
    case "fortify": return "text-accent";
    case "push": return "text-success";
    case "receipt": return "text-muted";
  }
}

function formatSats(sats: string): string {
  const n = Number(sats);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return sats;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
