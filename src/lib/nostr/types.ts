import { z } from "zod";
import {
  NIP_POOL_KIND,
  NIP_RECEIPT_KIND,
  NIP_SETTLE_KIND,
  NIP_PRESERVE_KIND,
  NIP_OFFER_KIND,
  NIP_CLEARING_KIND,
  NIP_IMPORTANCE_KIND,
} from "@/lib/constants";

// --- Base Nostr event shape ---

export const NostrEventSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{64}$/),
  kind: z.number().int(),
  pubkey: z.string().regex(/^[0-9a-f]{64}$/),
  created_at: z.number().int(),
  content: z.string(),
  tags: z.array(z.array(z.string())),
  sig: z.string().regex(/^[0-9a-f]{128}$/),
});

export type NostrEvent = z.infer<typeof NostrEventSchema>;

// --- Tag helpers ---

export function getTag(event: NostrEvent, name: string): string | undefined {
  return event.tags.find((t) => t[0] === name)?.[1];
}

export function getTags(event: NostrEvent, name: string): string[] {
  return event.tags.filter((t) => t[0] === name).map((t) => t[1]);
}

// --- NIP-POOL ---

export const PoolEventSchema = NostrEventSchema.extend({
  kind: z.literal(NIP_POOL_KIND),
}).refine(
  (e) => getTag(e, "r") && getTag(e, "amount") && getTag(e, "proof"),
  { message: "Pool event requires r, amount, proof tags" }
);

export type PoolEvent = z.infer<typeof PoolEventSchema>;

// --- NIP-RECEIPT ---

export const ReceiptEventSchema = NostrEventSchema.extend({
  kind: z.literal(NIP_RECEIPT_KIND),
}).refine(
  (e) =>
    getTag(e, "r") &&
    getTag(e, "host") &&
    getTag(e, "receipt_token") &&
    getTag(e, "price") &&
    getTag(e, "epoch") &&
    getTag(e, "response_hash"),
  { message: "Receipt event requires r, host, receipt_token, price, epoch, response_hash tags" }
);

export type ReceiptEvent = z.infer<typeof ReceiptEventSchema>;

// --- NIP-SETTLE ---

export const SettleEventSchema = NostrEventSchema.extend({
  kind: z.literal(NIP_SETTLE_KIND),
}).refine(
  (e) =>
    getTag(e, "epoch") &&
    getTag(e, "host") &&
    getTag(e, "r") &&
    getTag(e, "reward"),
  { message: "Settle event requires epoch, host, r, reward tags" }
);

export type SettleEvent = z.infer<typeof SettleEventSchema>;

// --- NIP-PRESERVE ---

export const PreserveEventSchema = NostrEventSchema.extend({
  kind: z.literal(NIP_PRESERVE_KIND),
}).refine(
  (e) =>
    getTag(e, "r") &&
    getTag(e, "tier") &&
    getTag(e, "replicas") &&
    getTag(e, "duration") &&
    getTag(e, "max_price") &&
    getTag(e, "escrow_proof"),
  { message: "Preserve event requires r, tier, replicas, duration, max_price, escrow_proof tags" }
);

export type PreserveEvent = z.infer<typeof PreserveEventSchema>;

// --- NIP-OFFER ---

export const OfferEventSchema = NostrEventSchema.extend({
  kind: z.literal(NIP_OFFER_KIND),
}).refine(
  (e) =>
    getTag(e, "r") &&
    getTag(e, "replicas") &&
    getTag(e, "price") &&
    getTag(e, "bond") &&
    getTag(e, "duration") &&
    getTag(e, "bond_proof"),
  { message: "Offer event requires r, replicas, price, bond, duration, bond_proof tags" }
);

export type OfferEvent = z.infer<typeof OfferEventSchema>;

// --- NIP-CLEARING ---

export const ClearingEventSchema = NostrEventSchema.extend({
  kind: z.literal(NIP_CLEARING_KIND),
}).refine(
  (e) =>
    getTag(e, "epoch") &&
    getTag(e, "r") &&
    getTag(e, "clearing_price") &&
    getTag(e, "matched_replicas"),
  { message: "Clearing event requires epoch, r, clearing_price, matched_replicas tags" }
);

export type ClearingEvent = z.infer<typeof ClearingEventSchema>;

// --- NIP-IMPORTANCE ---

export const ImportanceEventSchema = NostrEventSchema.extend({
  kind: z.literal(NIP_IMPORTANCE_KIND),
}).refine(
  (e) =>
    getTag(e, "r") &&
    getTag(e, "commitment") &&
    getTag(e, "demand") &&
    getTag(e, "centrality"),
  { message: "Importance event requires r, commitment, demand, centrality tags" }
);

export type ImportanceEvent = z.infer<typeof ImportanceEventSchema>;

// --- Event kind registry ---

export const NIP_KINDS = {
  pool: NIP_POOL_KIND,
  receipt: NIP_RECEIPT_KIND,
  settle: NIP_SETTLE_KIND,
  preserve: NIP_PRESERVE_KIND,
  offer: NIP_OFFER_KIND,
  clearing: NIP_CLEARING_KIND,
  importance: NIP_IMPORTANCE_KIND,
} as const;
