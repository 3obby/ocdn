import { NIP_OFFER_KIND } from "@/lib/constants";
import { type NostrEvent, OfferEventSchema, getTag } from "./types";

export interface ParsedOffer {
  hostPubkey: string;
  contentHash: string;
  replicas: number;
  regions: string[];
  priceSats: bigint;
  bondSats: bigint;
  bondProof: string;
  durationEpochs: number;
  eventId: string;
}

export function parseOfferEvent(event: NostrEvent): ParsedOffer | null {
  const result = OfferEventSchema.safeParse(event);
  if (!result.success) return null;

  const e = result.data;
  return {
    hostPubkey: e.pubkey,
    contentHash: getTag(e, "r")!,
    replicas: Number(getTag(e, "replicas")!),
    regions: (getTag(e, "regions") ?? "").split(",").filter(Boolean),
    priceSats: BigInt(getTag(e, "price")!),
    bondSats: BigInt(getTag(e, "bond")!),
    bondProof: getTag(e, "bond_proof")!,
    durationEpochs: Number(getTag(e, "duration")!),
    eventId: e.id,
  };
}

export function isOfferEvent(event: NostrEvent): boolean {
  return event.kind === NIP_OFFER_KIND;
}
