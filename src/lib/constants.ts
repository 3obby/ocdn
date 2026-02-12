// Protocol constants — tunable, carried from mvp.md §Constants

// --- Royalty ---
export const FOUNDER_ROYALTY_R0 = 0.15; // 15% starting rate
export const FOUNDER_ROYALTY_V_STAR = 125_000_000; // 1.25 BTC in sats
export const FOUNDER_ROYALTY_ALPHA = Math.log(2) / Math.log(9); // ≈ 0.3155

export const EGRESS_ROYALTY_PCT = 0.01; // 1% flat, never tapers

export const ROYALTY_SPLIT_FOUNDER = 0.6;
export const ROYALTY_SPLIT_SETTLER = 0.2;
export const ROYALTY_SPLIT_INDEX = 0.1;
export const ROYALTY_SPLIT_DEV = 0.1;

// --- Epoch ---
export const EPOCH_LENGTH_HOURS = 4; // 6 cycles/day
export const EPOCH_LENGTH_SECS = EPOCH_LENGTH_HOURS * 3600;
export const EPOCH_REWARD_PCT = 0.02; // 2% cap per CID per epoch
export const EPOCH_REWARD_BASE = 50; // sats, scales log2

// --- Pool ---
export const AUTO_BID_PCT = 0.02; // egress → pool feedback

// --- PoW ---
export const POW_TARGET_BASE = 2n ** 240n; // ~200ms mobile

// --- Clearing ---
export const CLEARING_SPREAD_PCT = 0.03; // 3% clearinghouse toll

// --- NIP Event Kinds (custom range 30000+) ---
export const NIP_POOL_KIND = 30078;
export const NIP_RECEIPT_KIND = 30079;
export const NIP_SETTLE_KIND = 30080;
export const NIP_PRESERVE_KIND = 30081;
export const NIP_OFFER_KIND = 30082;
export const NIP_CLEARING_KIND = 30083;
export const NIP_IMPORTANCE_KIND = 30084;

// --- Preserve Tiers ---
export const PRESERVE_TIERS = {
  gold:   { replicas: 10, jurisdictions: 3, durationEpochs: 6 * 30 * 6 }, // ~6mo
  silver: { replicas: 5,  jurisdictions: 2, durationEpochs: 3 * 30 * 6 }, // ~3mo
  bronze: { replicas: 3,  jurisdictions: 1, durationEpochs: 1 * 30 * 6 }, // ~1mo
} as const;

export type PreserveTier = keyof typeof PRESERVE_TIERS;
