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

const BATCH_SIZE = Number(process.env.INDEXER_BATCH_SIZE ?? "30");
const BATCH_DELAY_MS = Number(process.env.INDEXER_BATCH_DELAY_MS ?? "0");
const MAX_RETRIES = 10;
const PROGRESS_INTERVAL = 5000;

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      const msg = (e as Error).message;
      const isRateLimit = code === "429" || msg.includes("429") || msg.includes("rate limit") || msg.includes("daily request");
      const isServerError = code === "503" || msg.includes("503");
      if ((isRateLimit || isServerError) && attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 120_000);
        elog("rate limited, backing off", { label, attempt, delayMs: delay });
        await sleep(delay);
        attempt++;
        continue;
      }
      throw e;
    }
  }
}

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
    const batchEnd = Math.min(height + BATCH_SIZE - 1, toHeight);
    const heights = Array.from({ length: batchEnd - height + 1 }, (_, i) => height + i);

    const blocks = await Promise.all(
      heights.map((h) => withRetry(() => rpc.getBlock(h, 3), `getblock ${h}`)),
    );

    for (const block of blocks) {
      const result = await processBlock(block, prisma);

      totalPosts += result.posts;
      totalBurns += result.burns;
      totalSignals += result.signals;

      if (result.posts + result.burns + result.signals > 0) {
        ilog("block indexed", { height: block.height, posts: result.posts, burns: result.burns, signals: result.signals });
      }
    }

    const lastBlock = blocks[blocks.length - 1];
    if ((height - fromHeight) % flushEvery < BATCH_SIZE || batchEnd === toHeight) {
      await updateIndexerState(
        { hash: lastBlock.hash, height: lastBlock.height },
        prisma,
      );
    }

    const scannedSoFar = batchEnd - fromHeight + 1;
    if (scannedSoFar % PROGRESS_INTERVAL < BATCH_SIZE && scannedSoFar >= PROGRESS_INTERVAL) {
      const pct = ((scannedSoFar / (toHeight - fromHeight + 1)) * 100).toFixed(2);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const bps = (scannedSoFar / ((Date.now() - startTime) / 1000)).toFixed(1);
      ilog("backfill progress", { height: batchEnd, pct: `${pct}%`, blocksPerSec: bps, elapsedSec: elapsed, totalPosts, totalBurns });
    }

    height = batchEnd + 1;
    if (BATCH_DELAY_MS > 0) await sleep(BATCH_DELAY_MS);
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

  const tipHeight = await withRetry(() => rpc.getBlockCount(), "getblockcount");
  while (nextHeight <= tipHeight) {
    const block = await withRetry(() => rpc.getBlock(nextHeight, 3), `getblock ${nextHeight}`);
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
