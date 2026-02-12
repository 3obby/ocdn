import { EPOCH_REWARD_PCT, EPOCH_REWARD_BASE } from "./constants";

/**
 * Per-CID epoch reward cap:
 *   cap = min(pool × EPOCH_REWARD_PCT,
 *             EPOCH_REWARD_BASE × (1 + floor(log2(pool / EPOCH_REWARD_BASE + 1))))
 *
 * Log-scaled cap: bigger pools drain sublinearly (endowment behavior).
 */
export function epochRewardCap(poolBalance: bigint): bigint {
  const pool = Number(poolBalance);
  const linearCap = pool * EPOCH_REWARD_PCT;
  const logCap =
    EPOCH_REWARD_BASE * (1 + Math.floor(Math.log2(pool / EPOCH_REWARD_BASE + 1)));
  return BigInt(Math.floor(Math.min(linearCap, logCap)));
}

/**
 * Host payout weight:
 *   weight = total_proven_sats × (1 + log2(unique_clients))
 */
export function payoutWeight(totalProvenSats: bigint, uniqueClients: number): number {
  return Number(totalProvenSats) * (1 + Math.log2(Math.max(uniqueClients, 1)));
}

/**
 * Host share of epoch cap:
 *   share = cap × (host_weight / total_weight)
 */
export function hostShare(
  cap: bigint,
  hostWeight: number,
  totalWeight: number
): bigint {
  if (totalWeight === 0) return 0n;
  return BigInt(Math.floor(Number(cap) * (hostWeight / totalWeight)));
}

/**
 * Sustainability ratio:
 *   auto_bid_income / preservation_cost
 *   >= 1.0 means self-sustaining from traffic alone
 */
export function sustainabilityRatio(
  autoBidIncomeSats: bigint,
  preservationCostSats: bigint
): number {
  if (preservationCostSats === 0n) return Infinity;
  return Number(autoBidIncomeSats) / Number(preservationCostSats);
}
