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

// ═══ STRUCTURED LOGGER ═══

function ilog(msg: string, data?: Record<string, unknown>) {
  const entry = JSON.stringify({ ts: new Date().toISOString(), level: "info", ctx: "indexer", msg, ...(data ? { data } : {}) });
  console.log(entry);
}
function elog(msg: string, data?: Record<string, unknown>) {
  const entry = JSON.stringify({ ts: new Date().toISOString(), level: "error", ctx: "indexer", msg, ...(data ? { data } : {}) });
  console.error(entry);
}

// ═══ MAIN LOOP ═══

export async function runIndexer(config: IndexerConfig): Promise<void> {
  const {
    rpc,
    prisma,
    startHeight = 0,
    pollIntervalMs = 10_000,
    stateFlushInterval = 50,
  } = config;

  const info = await rpc.getBlockchainInfo();
  ilog("connected", { chain: info.chain, nodeHeight: info.blocks });

  const state = await getIndexerState(prisma);
  let nextHeight = state ? state.height + 1 : startHeight;
  ilog(state ? "resuming" : "first run", { nextHeight, lastTip: state?.height ?? null });

  const chainTip = info.blocks;
  if (nextHeight <= chainTip) {
    ilog("backfill start", { from: nextHeight, to: chainTip, blocks: chainTip - nextHeight + 1 });
    nextHeight = await backfill(rpc, prisma, nextHeight, chainTip, stateFlushInterval);
    ilog("backfill complete");
  }

  ilog("real-time mode", { pollIntervalMs });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      nextHeight = await pollOnce(rpc, prisma, nextHeight);
    } catch (e) {
      elog("poll error", { error: (e as Error).message });
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
    const block = await rpc.getBlock(height, 3);
    const result = await processBlock(block, prisma);

    totalPosts += result.posts;
    totalBurns += result.burns;
    totalSignals += result.signals;

    if (result.posts + result.burns + result.signals > 0) {
      ilog("block indexed", { height, posts: result.posts, burns: result.burns, signals: result.signals });
    }

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
  ilog("backfill summary", { scanned, elapsedSec: elapsed, totalPosts, totalBurns, totalSignals });

  return height;
}

// ═══ REAL-TIME ═══

async function pollOnce(
  rpc: BitcoinRpc,
  prisma: PrismaClient,
  nextHeight: number,
): Promise<number> {
  const reorgResume = await handleReorg(rpc, prisma);
  if (reorgResume !== null) {
    nextHeight = reorgResume;
  }

  const tipHeight = await rpc.getBlockCount();
  while (nextHeight <= tipHeight) {
    const block = await rpc.getBlock(nextHeight, 3);
    const result = await processBlock(block, prisma);
    await updateIndexerState(
      { hash: block.hash, height: block.height },
      prisma,
    );

    const items = result.posts + result.burns + result.signals;
    if (items > 0) {
      ilog("block indexed", { height: nextHeight, posts: result.posts, burns: result.burns, signals: result.signals });
    }

    nextHeight++;
  }

  return nextHeight;
}

// ═══ UTIL ═══

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
