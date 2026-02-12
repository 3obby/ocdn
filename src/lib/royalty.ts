import {
  FOUNDER_ROYALTY_R0,
  FOUNDER_ROYALTY_V_STAR,
  FOUNDER_ROYALTY_ALPHA,
  ROYALTY_SPLIT_FOUNDER,
  ROYALTY_SPLIT_SETTLER,
  ROYALTY_SPLIT_INDEX,
  ROYALTY_SPLIT_DEV,
} from "./constants";

/**
 * Pool credit royalty rate: r(v) = R0 × (1 + v / V*)^(-α)
 * Rate halves every ~10× cumulative volume.
 */
export function royaltyRate(cumulativeVolumeSats: bigint): number {
  const v = Number(cumulativeVolumeSats);
  return FOUNDER_ROYALTY_R0 * Math.pow(1 + v / FOUNDER_ROYALTY_V_STAR, -FOUNDER_ROYALTY_ALPHA);
}

/** Compute royalty sats for a given credit amount at current cumulative volume */
export function computeRoyalty(creditSats: bigint, cumulativeVolumeSats: bigint): bigint {
  const rate = royaltyRate(cumulativeVolumeSats);
  return BigInt(Math.floor(Number(creditSats) * rate));
}

/** Net sats after royalty deduction */
export function netAfterRoyalty(creditSats: bigint, cumulativeVolumeSats: bigint): bigint {
  return creditSats - computeRoyalty(creditSats, cumulativeVolumeSats);
}

export interface RoyaltySplit {
  founder: bigint;
  settler: bigint;
  index: bigint;
  dev: bigint;
}

/** Split total royalty among recipients */
export function splitRoyalty(totalRoyaltySats: bigint): RoyaltySplit {
  const total = Number(totalRoyaltySats);
  return {
    founder: BigInt(Math.floor(total * ROYALTY_SPLIT_FOUNDER)),
    settler: BigInt(Math.floor(total * ROYALTY_SPLIT_SETTLER)),
    index: BigInt(Math.floor(total * ROYALTY_SPLIT_INDEX)),
    dev: BigInt(Math.floor(total * ROYALTY_SPLIT_DEV)),
  };
}
