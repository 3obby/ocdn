"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export interface SSEMessage {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface UseSSEOptions {
  /** Content hash to filter events for (optional) */
  hash?: string;
  /** Whether the SSE connection is enabled */
  enabled?: boolean;
  /** Reconnect delay in ms (default 3000) */
  reconnectDelay?: number;
}

/**
 * React hook for Server-Sent Events from /api/sse.
 * Auto-reconnects on disconnect. Returns latest messages.
 */
export function useSSE(
  onMessage: (msg: SSEMessage) => void,
  options: UseSSEOptions = {}
) {
  const { hash, enabled = true, reconnectDelay = 3000 } = options;
  const onMessageRef = useRef(onMessage);
  const [connected, setConnected] = useState(false);

  // Keep callback ref fresh without re-subscribing
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    function connect() {
      if (cancelled) return;

      const params = new URLSearchParams();
      if (hash) params.set("hash", hash);

      const url = `/api/sse${params.toString() ? `?${params}` : ""}`;
      es = new EventSource(url);

      es.onopen = () => {
        if (!cancelled) setConnected(true);
      };

      es.onmessage = (e) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(e.data);
          onMessageRef.current(data);
        } catch {
          // ignore malformed messages
        }
      };

      es.onerror = () => {
        if (cancelled) return;
        setConnected(false);
        es?.close();
        reconnectTimer = setTimeout(connect, reconnectDelay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      es?.close();
      clearTimeout(reconnectTimer);
      setConnected(false);
    };
  }, [hash, enabled, reconnectDelay]);

  return { connected };
}

/**
 * Hook that fetches live header stats (doc count, total sats, host count).
 * Polls every 30s + listens to SSE for incremental updates.
 */
export function useHeaderStats() {
  const [stats, setStats] = useState({
    docs: "—",
    sats: "—",
    hosts: "—",
  });

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        setStats({
          docs: formatCompact(data.docCount),
          sats: formatCompact(data.totalSats),
          hosts: formatCompact(data.hostCount),
        });
      }
    } catch {
      // Silent fail - stats are non-critical
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Also update on SSE events
  useSSE(
    useCallback(
      (msg: SSEMessage) => {
        if (msg.type === "stats") {
          setStats({
            docs: formatCompact(msg.docCount),
            sats: formatCompact(msg.totalSats),
            hosts: formatCompact(msg.hostCount),
          });
        }
        // On any event, refetch to get latest
        if (msg.type === "event") {
          fetchStats();
        }
      },
      [fetchStats]
    )
  );

  return stats;
}

function formatCompact(n: number | string | undefined): string {
  if (n === undefined || n === null) return "—";
  const num = typeof n === "string" ? Number(n) : n;
  if (isNaN(num)) return "—";
  if (num >= 100_000_000) return `${(num / 100_000_000).toFixed(2)} BTC`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
}
