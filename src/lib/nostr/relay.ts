import { Relay } from "nostr-tools/relay";
import { type NostrEvent } from "./types";
import { NIP_KINDS } from "./types";

const RELAY_URLS = (process.env.NOSTR_RELAYS ?? "").split(",").filter(Boolean);

export type EventHandler = (event: NostrEvent) => void;

interface Subscription {
  relay: Relay;
  close: () => void;
}

const NIP57_ZAP_RECEIPT_KIND = 9735;

/** Subscribe to all protocol event kinds + NIP-57 zaps on configured relays */
export async function subscribeProtocolEvents(
  onEvent: EventHandler,
  since?: number
): Promise<Subscription[]> {
  const kinds = [...Object.values(NIP_KINDS), NIP57_ZAP_RECEIPT_KIND];
  const subs: Subscription[] = [];

  for (const url of RELAY_URLS) {
    try {
      const relay = await Relay.connect(url);
      const sub = relay.subscribe(
        [{ kinds, since: since ?? Math.floor(Date.now() / 1000) - 86400 }],
        {
          onevent(event) {
            onEvent(event as unknown as NostrEvent);
          },
        }
      );
      subs.push({ relay, close: () => sub.close() });
    } catch (err) {
      console.error(`Failed to connect to relay ${url}:`, err);
    }
  }

  return subs;
}

/** Publish an event to all configured relays */
export async function publishEvent(event: NostrEvent): Promise<string[]> {
  const published: string[] = [];

  for (const url of RELAY_URLS) {
    try {
      const relay = await Relay.connect(url);
      await relay.publish(event as Parameters<typeof relay.publish>[0]);
      published.push(url);
      relay.close();
    } catch (err) {
      console.error(`Failed to publish to ${url}:`, err);
    }
  }

  return published;
}
