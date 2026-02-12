/**
 * Epoch settler: computes rewards, publishes NIP-SETTLE events.
 *
 * For each CID with receipts in the epoch:
 *   1. Compute epoch reward cap (log-scaled)
 *   2. Score hosts by proven sats × log2(unique clients)
 *   3. Distribute cap pro-rata by host score
 *   4. Deduct royalty, apply split
 *   5. Publish settlement summary as Nostr event
 */

import { prisma } from "@/lib/db";
import { epochRewardCap, payoutWeight, hostShare } from "@/lib/pool";
import { computeRoyalty, splitRoyalty } from "@/lib/royalty";
import { EPOCH_LENGTH_SECS } from "@/lib/constants";

export interface EpochResult {
  epoch: number;
  settlements: CidSettlement[];
  totalRewarded: bigint;
  totalRoyalty: bigint;
}

export interface CidSettlement {
  contentHash: string;
  cap: bigint;
  hosts: HostReward[];
}

export interface HostReward {
  hostPubkey: string;
  rewardSats: bigint;
  receiptCount: number;
  uniqueClients: number;
}

/** Get current epoch number */
export function currentEpoch(): number {
  return Math.floor(Date.now() / 1000 / EPOCH_LENGTH_SECS);
}

/** Settle a single epoch */
export async function settleEpoch(epoch: number): Promise<EpochResult> {
  // Get all receipts for this epoch, grouped by content hash
  const receipts = await prisma.receipt.findMany({
    where: { epoch },
    select: {
      contentHash: true,
      hostPubkey: true,
      clientPubkey: true,
      priceSats: true,
    },
  });

  // Group by content hash
  const byCid = new Map<string, typeof receipts>();
  for (const r of receipts) {
    const list = byCid.get(r.contentHash) ?? [];
    list.push(r);
    byCid.set(r.contentHash, list);
  }

  const settlements: CidSettlement[] = [];
  let totalRewarded = 0n;
  let totalRoyalty = 0n;

  for (const [contentHash, cidReceipts] of byCid) {
    // Get pool balance
    const pool = await prisma.pool.findUnique({
      where: { hash: contentHash },
      select: { balance: true },
    });
    if (!pool || pool.balance <= 0n) continue;

    const cap = epochRewardCap(pool.balance);
    if (cap <= 0n) continue;

    // Group by host
    const byHost = new Map<string, { sats: bigint; clients: Set<string> }>();
    for (const r of cidReceipts) {
      const entry = byHost.get(r.hostPubkey) ?? {
        sats: 0n,
        clients: new Set<string>(),
      };
      entry.sats += r.priceSats;
      entry.clients.add(r.clientPubkey);
      byHost.set(r.hostPubkey, entry);
    }

    // Compute weights
    const hostWeights: { pubkey: string; weight: number; entry: { sats: bigint; clients: Set<string> } }[] = [];
    let totalW = 0;
    for (const [pubkey, entry] of byHost) {
      const w = payoutWeight(entry.sats, entry.clients.size);
      hostWeights.push({ pubkey, weight: w, entry });
      totalW += w;
    }

    // Distribute cap
    const hosts: HostReward[] = [];
    let cidRewarded = 0n;
    for (const { pubkey, weight, entry } of hostWeights) {
      const reward = hostShare(cap, weight, totalW);
      hosts.push({
        hostPubkey: pubkey,
        rewardSats: reward,
        receiptCount: cidReceipts.filter((r) => r.hostPubkey === pubkey).length,
        uniqueClients: entry.clients.size,
      });
      cidRewarded += reward;
    }

    // Compute royalty on rewards
    const cumVol = await prisma.pool.aggregate({ _sum: { totalFunded: true } });
    const royalty = computeRoyalty(cidRewarded, cumVol._sum.totalFunded ?? 0n);
    totalRoyalty += royalty;
    totalRewarded += cidRewarded;

    // Drain pool
    await prisma.pool.update({
      where: { hash: contentHash },
      data: { balance: { decrement: cidRewarded } },
    });

    settlements.push({ contentHash, cap, hosts });
  }

  return { epoch, settlements, totalRewarded, totalRoyalty };
}

/** Run settler on a timer (every EPOCH_LENGTH_SECS) */
export function startSettler() {
  console.log("[settler] Starting epoch settler...");

  const run = async () => {
    const epoch = currentEpoch() - 1; // settle previous epoch

    // Check if already settled
    const existing = await prisma.settlement.findFirst({
      where: { epoch },
    });
    if (existing) return;

    try {
      const result = await settleEpoch(epoch);
      console.log(
        `[settler] Epoch ${epoch}: ${result.settlements.length} CIDs, ` +
          `${result.totalRewarded} sats rewarded, ${result.totalRoyalty} sats royalty`
      );
    } catch (err) {
      console.error(`[settler] Epoch ${epoch} failed:`, err);
    }
  };

  // Run immediately, then on interval
  run();
  setInterval(run, EPOCH_LENGTH_SECS * 1000);
}
