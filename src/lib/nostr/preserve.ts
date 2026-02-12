import { NIP_PRESERVE_KIND } from "@/lib/constants";
import { type NostrEvent, PreserveEventSchema, getTag } from "./types";

export interface ParsedPreserve {
  contentHash: string;
  funderPubkey: string;
  tier: string;
  replicas: number;
  jurisdictions: number;
  durationEpochs: number;
  maxPriceSats: bigint;
  escrowProof: string;
  eventId: string;
}

export function parsePreserveEvent(event: NostrEvent): ParsedPreserve | null {
  const result = PreserveEventSchema.safeParse(event);
  if (!result.success) return null;

  const e = result.data;
  return {
    contentHash: getTag(e, "r")!,
    funderPubkey: e.pubkey,
    tier: getTag(e, "tier")!,
    replicas: Number(getTag(e, "replicas")!),
    jurisdictions: Number(getTag(e, "jurisdictions") ?? "1"),
    durationEpochs: Number(getTag(e, "duration")!),
    maxPriceSats: BigInt(getTag(e, "max_price")!),
    escrowProof: getTag(e, "escrow_proof")!,
    eventId: e.id,
  };
}

export function isPreserveEvent(event: NostrEvent): boolean {
  return event.kind === NIP_PRESERVE_KIND;
}
