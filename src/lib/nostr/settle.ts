import { NIP_SETTLE_KIND } from "@/lib/constants";
import { type NostrEvent, SettleEventSchema, getTag } from "./types";

export interface ParsedSettlement {
  epoch: number;
  hostPubkey: string;
  contentHash: string;
  rewardSats: bigint;
  receiptMerkleRoot: string;
  receiptCount: number;
  uniqueClients: number;
  settlerPubkey: string;
  eventId: string;
}

/** Validate and extract a NIP-SETTLE event */
export function parseSettleEvent(event: NostrEvent): ParsedSettlement | null {
  const result = SettleEventSchema.safeParse(event);
  if (!result.success) return null;

  const e = result.data;
  return {
    epoch: Number(getTag(e, "epoch")!),
    hostPubkey: getTag(e, "host")!,
    contentHash: getTag(e, "r")!,
    rewardSats: BigInt(getTag(e, "reward")!),
    receiptMerkleRoot: getTag(e, "receipt_merkle_root") ?? "",
    receiptCount: Number(getTag(e, "receipt_count") ?? "0"),
    uniqueClients: Number(getTag(e, "unique_clients") ?? "0"),
    settlerPubkey: e.pubkey,
    eventId: e.id,
  };
}

export function isSettleEvent(event: NostrEvent): boolean {
  return event.kind === NIP_SETTLE_KIND;
}
