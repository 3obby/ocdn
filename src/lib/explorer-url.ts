/**
 * Mempool.space transaction page base (no trailing slash).
 * Uses NEXT_PUBLIC_MEMPOOL_TX_BASE if set, else mainnet vs signet from NEXT_PUBLIC_BITCOIN_NETWORK.
 */
export function mempoolTxExplorerBase(): string {
  const override = process.env.NEXT_PUBLIC_MEMPOOL_TX_BASE?.replace(/\/$/, "");
  if (override) return override;
  return process.env.NEXT_PUBLIC_BITCOIN_NETWORK === "signet"
    ? "https://mempool.space/signet/tx"
    : "https://mempool.space/tx";
}

export function txExplorerHref(txid: string): string {
  return `${mempoolTxExplorerBase()}/${txid}`;
}
