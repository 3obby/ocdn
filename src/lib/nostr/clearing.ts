import { NIP_CLEARING_KIND } from "@/lib/constants";
import { type NostrEvent, ClearingEventSchema, getTag } from "./types";

export interface ParsedClearing {
  epoch: number;
  contentHash: string;
  clearingPriceSats: bigint;
  matchedReplicas: number;
  spreadSats: bigint;
  poolCreditSats: bigint;
  eventId: string;
}

export function parseClearingEvent(event: NostrEvent): ParsedClearing | null {
  const result = ClearingEventSchema.safeParse(event);
  if (!result.success) return null;

  const e = result.data;
  return {
    epoch: Number(getTag(e, "epoch")!),
    contentHash: getTag(e, "r")!,
    clearingPriceSats: BigInt(getTag(e, "clearing_price")!),
    matchedReplicas: Number(getTag(e, "matched_replicas")!),
    spreadSats: BigInt(getTag(e, "spread") ?? "0"),
    poolCreditSats: BigInt(getTag(e, "pool_credit") ?? "0"),
    eventId: e.id,
  };
}

export function isClearingEvent(event: NostrEvent): boolean {
  return event.kind === NIP_CLEARING_KIND;
}
