/**
 * Citation graph: edges + PageRank with economic weights.
 *
 * Edge types: ref (event parent), body ([ref:hex] in content), list (LIST items).
 * importance(node) = direct_pool(node) + Σ(edge_weight × importance(neighbor)) × decay
 */

export interface GraphNode {
  hash: string;
  directPool: number; // sats as number for graph math
  edges: GraphEdge[];
}

export interface GraphEdge {
  targetHash: string;
  weight: number;
  type: "ref" | "body" | "list";
}

const DECAY = 0.85; // PageRank-style damping
const MAX_ITERATIONS = 50;
const CONVERGENCE_THRESHOLD = 0.0001;

/**
 * Compute graph importance (PageRank variant with economic weights).
 * Returns map of hash → importance score.
 */
export function computeGraphImportance(
  nodes: GraphNode[]
): Map<string, number> {
  const scores = new Map<string, number>();
  const nodeMap = new Map<string, GraphNode>();

  // Initialize: score = direct pool balance (normalized)
  const maxPool = Math.max(1, ...nodes.map((n) => n.directPool));
  for (const node of nodes) {
    scores.set(node.hash, node.directPool / maxPool);
    nodeMap.set(node.hash, node);
  }

  // Iterative propagation
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let maxDelta = 0;
    const newScores = new Map<string, number>();

    for (const node of nodes) {
      const directComponent = (1 - DECAY) * (node.directPool / maxPool);

      let neighborComponent = 0;
      for (const edge of node.edges) {
        const neighborScore = scores.get(edge.targetHash) ?? 0;
        neighborComponent += edge.weight * neighborScore;
      }

      const newScore = directComponent + DECAY * neighborComponent;
      newScores.set(node.hash, newScore);

      const delta = Math.abs(newScore - (scores.get(node.hash) ?? 0));
      maxDelta = Math.max(maxDelta, delta);
    }

    for (const [k, v] of newScores) scores.set(k, v);

    if (maxDelta < CONVERGENCE_THRESHOLD) break;
  }

  return scores;
}

/**
 * Extract body edges from content text.
 * Matches [ref:hex64] patterns.
 */
export function extractBodyEdges(content: string): string[] {
  const pattern = /\[ref:([0-9a-f]{64})\]/g;
  const refs: string[] = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}
