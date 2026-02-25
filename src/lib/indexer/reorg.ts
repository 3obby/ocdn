import type { PrismaClient } from "../../generated/prisma/client";
import type { BitcoinRpc } from "../bitcoin/rpc";

// ═══ TYPES ═══

export interface ChainTip {
  hash: string;
  height: number;
}

// ═══ INDEXER STATE ═══

export async function getIndexerState(
  prisma: PrismaClient,
): Promise<ChainTip | null> {
  const state = await prisma.indexerState.findUnique({ where: { id: 1 } });
  if (!state) return null;
  return { hash: state.chainTipHash, height: state.chainTipHeight };
}

export async function updateIndexerState(
  tip: ChainTip,
  prisma: PrismaClient,
): Promise<void> {
  await prisma.indexerState.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      chainTipHash: tip.hash,
      chainTipHeight: tip.height,
    },
    update: {
      chainTipHash: tip.hash,
      chainTipHeight: tip.height,
    },
  });
}

// ═══ REORG DETECTION ═══

/**
 * Check whether our stored chain tip still matches the node's chain.
 * Returns true if the hashes agree (no reorg), false otherwise.
 */
export async function tipMatchesNode(
  rpc: BitcoinRpc,
  prisma: PrismaClient,
): Promise<boolean> {
  const state = await getIndexerState(prisma);
  if (!state) return true; // first run — nothing to disagree with
  try {
    const nodeHash = await rpc.getBlockHash(state.height);
    return nodeHash === state.hash;
  } catch {
    // height beyond chain tip (extreme reorg) → mismatch
    return false;
  }
}

/**
 * Walk backward from our chain tip to find the highest block where
 * both our index and the node agree.  Returns the fork-point height.
 */
export async function findForkPoint(
  rpc: BitcoinRpc,
  prisma: PrismaClient,
  ourTipHeight: number,
): Promise<number> {
  let height = ourTipHeight;

  while (height > 0) {
    // Check if we have an IndexedBlock at this height
    const indexed = await prisma.indexedBlock.findFirst({
      where: { height },
      select: { hash: true },
    });

    if (indexed) {
      try {
        const nodeHash = await rpc.getBlockHash(height);
        if (nodeHash === indexed.hash) return height;
      } catch {
        // height beyond node's tip — keep walking back
      }
    }

    // No indexed block here, or hashes disagree — compare with indexerState
    // for the fast path (most blocks won't have IndexedBlock records)
    try {
      // We don't store every block hash, so just keep walking back until
      // we find an IndexedBlock whose hash agrees with the node.
      height--;
    } catch {
      height--;
    }
  }

  return 0; // ultimate fallback: re-index from genesis
}

/**
 * Delete all indexed data above the given height.
 * CASCADE delete on IndexedBlock removes associated posts, burns, signals.
 * Returns the number of blocks rewound.
 */
export async function rewindToHeight(
  forkHeight: number,
  prisma: PrismaClient,
): Promise<number> {
  const deleted = await prisma.indexedBlock.deleteMany({
    where: { height: { gt: forkHeight } },
  });

  // Also clean up aggregates that might reference deleted data.
  // A full recompute from remaining data is the safest approach for
  // aggregates, but for now we rely on the incremental re-indexing to
  // re-add the counts.  Aggregate accuracy after reorg is "eventually
  // correct" once the new chain is re-processed.

  return deleted.count;
}

/**
 * Detect a reorg and rewind the index to the fork point.
 * Returns the height to resume scanning from, or null if no reorg.
 */
export async function handleReorg(
  rpc: BitcoinRpc,
  prisma: PrismaClient,
): Promise<number | null> {
  const matches = await tipMatchesNode(rpc, prisma);
  if (matches) return null;

  const state = await getIndexerState(prisma);
  if (!state) return null;

  console.log(`  reorg detected at height ${state.height}`);
  const forkHeight = await findForkPoint(rpc, prisma, state.height);
  const rewound = await rewindToHeight(forkHeight, prisma);
  console.log(
    `  rewound ${rewound} blocks to fork point ${forkHeight}`,
  );

  await updateIndexerState(
    { hash: await rpc.getBlockHash(forkHeight), height: forkHeight },
    prisma,
  );

  return forkHeight + 1;
}
