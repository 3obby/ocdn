import type { PrismaClient } from "../../generated/prisma/client";
import type { BitcoinRpc } from "../bitcoin/rpc";
import { processBlock } from "./processor";
import {
  getIndexerState,
  updateIndexerState,
  handleReorg,
} from "./reorg";

// ═══ TYPES ═══

export interface IndexerConfig {
  rpc: BitcoinRpc;
  prisma: PrismaClient;
  startHeight?: number;
  pollIntervalMs?: number;
  stateFlushInterval?: number;
}

// ═══ MAIN LOOP ═══

/**
 * Run the indexer: backfill from the last-processed height to the chain tip,
 * then enter real-time mode polling for new blocks.
 */
export async function runIndexer(config: IndexerConfig): Promise<void> {
  const {
    rpc,
    prisma,
    startHeight = 0,
    pollIntervalMs = 10_000,
    stateFlushInterval = 50,
  } = config;

  // Verify RPC connectivity
  const info = await rpc.getBlockchainInfo();
  console.log(
    `connected to ${info.chain} — node height ${info.blocks}`,
  );

  // Determine where to resume
  const state = await getIndexerState(prisma);
  let nextHeight = state ? state.height + 1 : startHeight;
  console.log(
    state
      ? `resuming from height ${nextHeight} (tip was ${state.height})`
      : `first run — starting from height ${startHeight}`,
  );

  // ─── BACKFILL ───
  const chainTip = info.blocks;
  if (nextHeight <= chainTip) {
    console.log(
      `backfilling ${chainTip - nextHeight + 1} blocks (${nextHeight} → ${chainTip})`,
    );
    nextHeight = await backfill(
      rpc,
      prisma,
      nextHeight,
      chainTip,
      stateFlushInterval,
    );
    console.log("backfill complete");
  }

  // ─── REAL-TIME ───
  console.log(
    `entering real-time mode (polling every ${pollIntervalMs / 1000}s)`,
  );

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      nextHeight = await pollOnce(rpc, prisma, nextHeight);
    } catch (e) {
      console.error(`poll error: ${(e as Error).message}`);
    }
    await sleep(pollIntervalMs);
  }
}

// ═══ BACKFILL ═══

async function backfill(
  rpc: BitcoinRpc,
  prisma: PrismaClient,
  fromHeight: number,
  toHeight: number,
  flushEvery: number,
): Promise<number> {
  let height = fromHeight;
  let totalPosts = 0;
  let totalBurns = 0;
  let totalSignals = 0;
  const startTime = Date.now();

  while (height <= toHeight) {
    const block = await rpc.getBlock(height, 2);
    const result = await processBlock(block, prisma);

    totalPosts += result.posts;
    totalBurns += result.burns;
    totalSignals += result.signals;

    if (result.posts + result.burns + result.signals > 0) {
      console.log(
        `  block ${height}: ${result.posts} posts, ${result.burns} burns, ${result.signals} signals`,
      );
    }

    // Flush indexer state periodically to checkpoint progress
    if ((height - fromHeight) % flushEvery === 0 || height === toHeight) {
      await updateIndexerState(
        { hash: block.hash, height: block.height },
        prisma,
      );
    }

    height++;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const scanned = toHeight - fromHeight + 1;
  console.log(
    `  scanned ${scanned} blocks in ${elapsed}s — ` +
      `${totalPosts} posts, ${totalBurns} burns, ${totalSignals} signals`,
  );

  return height;
}

// ═══ REAL-TIME ═══

async function pollOnce(
  rpc: BitcoinRpc,
  prisma: PrismaClient,
  nextHeight: number,
): Promise<number> {
  // Check for reorgs before processing
  const reorgResume = await handleReorg(rpc, prisma);
  if (reorgResume !== null) {
    nextHeight = reorgResume;
  }

  const tipHeight = await rpc.getBlockCount();
  while (nextHeight <= tipHeight) {
    const block = await rpc.getBlock(nextHeight, 2);
    const result = await processBlock(block, prisma);
    await updateIndexerState(
      { hash: block.hash, height: block.height },
      prisma,
    );

    const items = result.posts + result.burns + result.signals;
    if (items > 0) {
      console.log(
        `  block ${nextHeight}: ${result.posts} posts, ${result.burns} burns, ${result.signals} signals`,
      );
    }

    nextHeight++;
  }

  return nextHeight;
}

// ═══ UTIL ═══

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
