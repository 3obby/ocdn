/**
 * Importance computation: the product.
 *
 * Three axes (the importance triangle):
 *   Commitment — pool balance (NIP-POOL)
 *   Demand     — receipt velocity (NIP-RECEIPT events/epoch)
 *   Centrality — graph importance (citation DAG)
 *
 * Divergence labels:
 *   Underpriced — high centrality + low pool
 *   Flash       — high demand + low pool
 *   Endowed     — high pool + low centrality + low demand
 */

export interface ImportanceScore {
  hash: string;
  commitment: number;
  demand: number;
  centrality: number;
  score: number;
  label: DivergenceLabel | null;
}

export type DivergenceLabel = "underpriced" | "flash" | "endowed";

export interface RawMetrics {
  hash: string;
  poolBalance: bigint;
  receiptsThisEpoch: number;
  graphImportance: number;
}

/**
 * Compute normalized importance scores from raw metrics.
 * Normalization: each axis → [0, 1] relative to current max.
 * Composite: geometric mean (commitment × demand × centrality)^(1/3)
 */
export function computeImportance(items: RawMetrics[]): ImportanceScore[] {
  if (items.length === 0) return [];

  // Find maxes for normalization
  const maxPool = items.reduce(
    (m, i) => (i.poolBalance > m ? i.poolBalance : m),
    1n
  );
  const maxReceipts = Math.max(1, ...items.map((i) => i.receiptsThisEpoch));
  const maxGraph = Math.max(1, ...items.map((i) => i.graphImportance));

  return items.map((item) => {
    const commitment = Number(item.poolBalance) / Number(maxPool);
    const demand = item.receiptsThisEpoch / maxReceipts;
    const centrality = item.graphImportance / maxGraph;

    const score = Math.cbrt(
      Math.max(commitment, 0.001) *
        Math.max(demand, 0.001) *
        Math.max(centrality, 0.001)
    );

    const label = detectDivergence(commitment, demand, centrality);

    return { hash: item.hash, commitment, demand, centrality, score, label };
  });
}

const DIVERGENCE_HIGH = 0.6;
const DIVERGENCE_LOW = 0.2;

function detectDivergence(
  commitment: number,
  demand: number,
  centrality: number
): DivergenceLabel | null {
  if (centrality > DIVERGENCE_HIGH && commitment < DIVERGENCE_LOW)
    return "underpriced";
  if (demand > DIVERGENCE_HIGH && commitment < DIVERGENCE_LOW)
    return "flash";
  if (
    commitment > DIVERGENCE_HIGH &&
    centrality < DIVERGENCE_LOW &&
    demand < DIVERGENCE_LOW
  )
    return "endowed";
  return null;
}

/** Sort by composite score descending */
export function rankByImportance(scores: ImportanceScore[]): ImportanceScore[] {
  return [...scores].sort((a, b) => b.score - a.score);
}
