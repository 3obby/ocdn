/**
 * Clearinghouse: matches NIP-PRESERVE bids with NIP-OFFER supply at epoch boundary.
 *
 * For each CID with active preserves + offers:
 *   1. Aggregate demand (total replicas needed)
 *   2. Sort offers by price ascending
 *   3. Match until demand filled or offers exhausted
 *   4. Clearing price = marginal offer price
 *   5. Credit pool (minus spread)
 *   6. Publish NIP-CLEARING event
 */

import { prisma } from "@/lib/db";
import { CLEARING_SPREAD_PCT, EPOCH_LENGTH_SECS } from "@/lib/constants";

export interface ClearingResult {
  epoch: number;
  contentHash: string;
  clearingPriceSats: bigint;
  matchedReplicas: number;
  spreadSats: bigint;
  poolCreditSats: bigint;
}

/** Run clearing for a single epoch */
export async function clearEpoch(epoch: number): Promise<ClearingResult[]> {
  const results: ClearingResult[] = [];

  // Get active preserves grouped by content hash
  const preserves = await prisma.preserveOrder.findMany({
    where: { status: "active" },
  });

  const demandByCid = new Map<string, { totalReplicas: number; maxPrice: bigint }>();
  for (const p of preserves) {
    const entry = demandByCid.get(p.contentHash) ?? {
      totalReplicas: 0,
      maxPrice: 0n,
    };
    entry.totalReplicas += p.replicas;
    if (p.maxPriceSats > entry.maxPrice) entry.maxPrice = p.maxPriceSats;
    demandByCid.set(p.contentHash, entry);
  }

  for (const [contentHash, demand] of demandByCid) {
    // Get offers for this CID (or wildcard "*")
    const offers = await prisma.hostOffer.findMany({
      where: {
        status: "active",
        OR: [{ contentHash }, { contentHash: "*" }],
      },
      orderBy: { priceSats: "asc" },
    });

    let matched = 0;
    let clearingPrice = 0n;
    let totalCost = 0n;

    for (const offer of offers) {
      if (matched >= demand.totalReplicas) break;
      if (offer.priceSats > demand.maxPrice) break;

      const take = Math.min(offer.replicas, demand.totalReplicas - matched);
      matched += take;
      clearingPrice = offer.priceSats; // marginal price
      totalCost += offer.priceSats * BigInt(take);
    }

    if (matched === 0) continue;

    const spread = BigInt(Math.floor(Number(totalCost) * CLEARING_SPREAD_PCT));
    const poolCredit = totalCost - spread;

    // Credit pool
    await prisma.pool.upsert({
      where: { hash: contentHash },
      update: { balance: { increment: poolCredit } },
      create: { hash: contentHash, balance: poolCredit },
    });

    results.push({
      epoch,
      contentHash,
      clearingPriceSats: clearingPrice,
      matchedReplicas: matched,
      spreadSats: spread,
      poolCreditSats: poolCredit,
    });
  }

  return results;
}

/** Run clearinghouse on a timer */
export function startClearinghouse() {
  console.log("[clearing] Starting clearinghouse...");

  const run = async () => {
    const epoch = Math.floor(Date.now() / 1000 / EPOCH_LENGTH_SECS);
    try {
      const results = await clearEpoch(epoch);
      if (results.length > 0) {
        console.log(
          `[clearing] Epoch ${epoch}: ${results.length} CIDs cleared`
        );
      }
    } catch (err) {
      console.error(`[clearing] Epoch ${epoch} failed:`, err);
    }
  };

  run();
  setInterval(run, EPOCH_LENGTH_SECS * 1000);
}
