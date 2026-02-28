/**
 * Server-side Nostr relay subscription for the OCDN indexer.
 * Runs in Node.js context (scripts/indexer.ts).
 */

import WebSocket from "ws";

export type NostrEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
};

export type Subscription = {
  close: () => void;
};

const SUB_ID = "ocdn-ephemeral";
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 60_000;

/**
 * Subscribe to ocdn-tagged events from a list of Nostr relays.
 * Reconnects automatically with exponential backoff.
 */
export function subscribeToOcdnEvents(
  relayUrls: string[],
  onEvent: (event: NostrEvent) => void,
): Subscription {
  const sockets: Array<{ ws: WebSocket | null; closed: boolean }> = [];

  for (const url of relayUrls) {
    const state = { ws: null as WebSocket | null, closed: false };
    sockets.push(state);

    let lastEventAt = Math.floor(Date.now() / 1000) - 60; // start from 1 minute ago
    let retryMs = RECONNECT_BASE_MS;

    function connect() {
      if (state.closed) return;

      const ws = new WebSocket(url);
      state.ws = ws;

      ws.on("open", () => {
        retryMs = RECONNECT_BASE_MS;
        const filter = {
          kinds: [1, 7],
          "#t": ["ocdn"],
          since: lastEventAt,
        };
        ws.send(JSON.stringify(["REQ", SUB_ID, filter]));
      });

      ws.on("message", (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString()) as unknown[];
          if (msg[0] === "EVENT" && msg[2] && typeof msg[2] === "object") {
            const event = msg[2] as NostrEvent;
            if (event.created_at) {
              lastEventAt = Math.max(lastEventAt, event.created_at + 1);
            }
            onEvent(event);
          }
        } catch {}
      });

      ws.on("close", () => {
        state.ws = null;
        if (!state.closed) {
          setTimeout(connect, retryMs);
          retryMs = Math.min(retryMs * 2, RECONNECT_MAX_MS);
        }
      });

      ws.on("error", () => {
        ws.terminate();
      });
    }

    connect();
  }

  return {
    close: () => {
      for (const s of sockets) {
        s.closed = true;
        s.ws?.terminate();
      }
    },
  };
}
