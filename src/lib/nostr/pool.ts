import { NIP_POOL_KIND } from "@/lib/constants";
import { type NostrEvent, PoolEventSchema, getTag } from "./types";

export interface PoolCredit {
  contentHash: string;
  sats: bigint;
  funderPubkey: string;
  proof: string;
  eventId: string;
}

/** Validate and extract a NIP-POOL event */
export function parsePoolEvent(event: NostrEvent): PoolCredit | null {
  const result = PoolEventSchema.safeParse(event);
  if (!result.success) return null;

  const e = result.data;
  return {
    contentHash: getTag(e, "r")!,
    sats: BigInt(getTag(e, "amount")!),
    funderPubkey: e.pubkey,
    proof: getTag(e, "proof")!,
    eventId: e.id,
  };
}

/** Build NIP-POOL event tags (unsigned — caller signs) */
export function buildPoolTags(
  contentHash: string,
  sats: bigint,
  proof: string
): string[][] {
  return [
    ["r", contentHash],
    ["amount", sats.toString()],
    ["proof", proof],
  ];
}

export function isPoolEvent(event: NostrEvent): boolean {
  return event.kind === NIP_POOL_KIND;
}
