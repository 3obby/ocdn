import { NIP_RECEIPT_KIND } from "@/lib/constants";
import { type NostrEvent, ReceiptEventSchema, getTag } from "./types";

export interface ParsedReceipt {
  contentHash: string;
  hostPubkey: string;
  clientPubkey: string;
  receiptToken: string;
  priceSats: bigint;
  epoch: number;
  responseHash: string;
  powNonce?: string;
  powHash?: string;
  indexPubkey?: string;
  indexProof?: string;
  eventId: string;
}

/** Validate and extract a NIP-RECEIPT event */
export function parseReceiptEvent(event: NostrEvent): ParsedReceipt | null {
  const result = ReceiptEventSchema.safeParse(event);
  if (!result.success) return null;

  const e = result.data;
  const powTag = e.tags.find((t) => t[0] === "pow");

  return {
    contentHash: getTag(e, "r")!,
    hostPubkey: getTag(e, "host")!,
    clientPubkey: e.pubkey,
    receiptToken: getTag(e, "receipt_token")!,
    priceSats: BigInt(getTag(e, "price")!),
    epoch: Number(getTag(e, "epoch")!),
    responseHash: getTag(e, "response_hash")!,
    powNonce: powTag?.[1],
    powHash: powTag?.[2],
    indexPubkey: getTag(e, "index"),
    indexProof: getTag(e, "index_proof"),
    eventId: e.id,
  };
}

/** Build NIP-RECEIPT event tags (unsigned) */
export function buildReceiptTags(opts: {
  contentHash: string;
  hostPubkey: string;
  receiptToken: string;
  priceSats: bigint;
  epoch: number;
  responseHash: string;
  powNonce?: string;
  powHash?: string;
  indexPubkey?: string;
  indexProof?: string;
}): string[][] {
  const tags: string[][] = [
    ["r", opts.contentHash],
    ["host", opts.hostPubkey],
    ["receipt_token", opts.receiptToken],
    ["price", opts.priceSats.toString()],
    ["epoch", opts.epoch.toString()],
    ["response_hash", opts.responseHash],
  ];
  if (opts.powNonce && opts.powHash) {
    tags.push(["pow", opts.powNonce, opts.powHash]);
  }
  if (opts.indexPubkey) tags.push(["index", opts.indexPubkey]);
  if (opts.indexProof) tags.push(["index_proof", opts.indexProof]);
  return tags;
}

export function isReceiptEvent(event: NostrEvent): boolean {
  return event.kind === NIP_RECEIPT_KIND;
}
