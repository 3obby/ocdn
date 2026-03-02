import { NextResponse } from "next/server";
import { rateLimit, errorResponse, log } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

type MempoolAddressResponse = {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
};

let cachedBalance: { sats: number; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * GET /api/leaderboard/fund
 *
 * Returns the leaderboard fund address and its current balance.
 * Balance is fetched from mempool.space and cached for 1 minute.
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  const address = process.env.LEADERBOARD_FUND_ADDRESS;
  if (!address) {
    return errorResponse("Leaderboard fund not configured", 503);
  }

  try {
    let balanceSats: number;

    if (cachedBalance && Date.now() - cachedBalance.timestamp < CACHE_TTL_MS) {
      balanceSats = cachedBalance.sats;
    } else {
      const res = await fetch(`https://mempool.space/api/address/${address}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        log("error", "api/leaderboard/fund", `mempool.space returned ${res.status}`);
        balanceSats = cachedBalance?.sats ?? 0;
      } else {
        const data = (await res.json()) as MempoolAddressResponse;
        const chain = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
        const mempool = data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum;
        balanceSats = chain + mempool;
        cachedBalance = { sats: balanceSats, timestamp: Date.now() };
      }
    }

    return NextResponse.json({
      address,
      balanceSats,
    });
  } catch (err) {
    log("error", "api/leaderboard/fund", String(err));
    return NextResponse.json({
      address,
      balanceSats: cachedBalance?.sats ?? 0,
    });
  }
}
