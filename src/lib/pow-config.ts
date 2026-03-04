export const POW = {
  MIN_POST: Number(process.env.NOSTR_MIN_POW_POST ?? "8"),
  MIN_BOOST: Number(process.env.NOSTR_MIN_POW_BOOST ?? "12"),
  PROGRESS_INTERVAL: 10_000,
  BOOST_TTL_EXTENSION_MS: 30 * 60 * 1000,
  AUTO_SUBMIT_INTERVAL_MS: 5_000,
} as const;

export function powWeight(difficulty: number): bigint {
  return BigInt(1) << BigInt(difficulty);
}

export function equivalentZeros(weight: bigint | number): number {
  const w = typeof weight === "number" ? BigInt(weight) : weight;
  if (w <= 0n) return 0;
  return w.toString(2).length - 1;
}
