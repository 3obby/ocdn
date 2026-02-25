import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bigintToNumber, log } from "@/lib/api-utils";
import { getRpc } from "@/lib/bitcoin/rpc";

export const dynamic = "force-dynamic";

const UTXO_LOW_THRESHOLD = Number(process.env.UTXO_LOW_THRESHOLD ?? "3");
const INDEXER_LAG_WARN = Number(process.env.INDEXER_LAG_WARN ?? "5");

export async function GET() {
  const checks: Record<string, unknown> = {};
  let status: "ok" | "degraded" | "error" = "ok";

  // ── Indexer state ──
  try {
    const state = await prisma.indexerState.findFirst();
    if (state) {
      checks.indexer = {
        tipHeight: state.chainTipHeight,
        tipHash: state.chainTipHash.slice(0, 12) + "…",
        updatedAt: state.updatedAt.toISOString(),
        ageSeconds: Math.round((Date.now() - state.updatedAt.getTime()) / 1000),
      };
    } else {
      checks.indexer = { error: "no state" };
      status = "degraded";
    }
  } catch (e) {
    checks.indexer = { error: String(e) };
    status = "error";
  }

  // ── Node connectivity + lag ──
  try {
    const rpc = getRpc();
    const nodeHeight = await rpc.getBlockCount();
    checks.node = { height: nodeHeight };

    const indexerHeight = (checks.indexer as { tipHeight?: number })?.tipHeight ?? 0;
    const lag = nodeHeight - indexerHeight;
    checks.lag = { blocks: lag };

    if (lag > INDEXER_LAG_WARN) {
      checks.lag = { blocks: lag, warning: `indexer ${lag} blocks behind` };
      if (status === "ok") status = "degraded";
      log("warn", "health", `indexer lagging ${lag} blocks`, { lag, nodeHeight, indexerHeight });
    }
  } catch (e) {
    checks.node = { error: "unreachable" };
    if (status === "ok") status = "degraded";
    log("warn", "health", "node unreachable", { error: String(e) });
  }

  // ── UTXO pool ──
  try {
    const utxos = await prisma.utxo.groupBy({
      by: ["status"],
      _count: true,
      _sum: { amount: true },
    });

    const pool: Record<string, { count: number; totalSats: number }> = {};
    for (const row of utxos) {
      pool[row.status] = {
        count: row._count,
        totalSats: bigintToNumber(row._sum.amount ?? 0n),
      };
    }
    checks.utxoPool = pool;

    const available = pool["available"]?.count ?? 0;
    if (available < UTXO_LOW_THRESHOLD) {
      checks.utxoPool = { ...pool, warning: `only ${available} available UTXOs` };
      if (status === "ok") status = "degraded";
      log("warn", "health", `low UTXO pool: ${available} available`, { available, threshold: UTXO_LOW_THRESHOLD });
    }
  } catch (e) {
    checks.utxoPool = { error: String(e) };
    if (status === "ok") status = "degraded";
  }

  // ── Content stats ──
  try {
    const [postCount, burnCount, topicCount] = await Promise.all([
      prisma.post.count(),
      prisma.burn.count(),
      prisma.topicAggregate.count(),
    ]);
    checks.content = { posts: postCount, burns: burnCount, topics: topicCount };
  } catch {
    checks.content = { error: "unavailable" };
  }

  // ── Pending txs ──
  try {
    const pending = await prisma.pendingTx.groupBy({
      by: ["status"],
      _count: true,
    });
    const pendingMap: Record<string, number> = {};
    for (const row of pending) pendingMap[row.status] = row._count;
    checks.pendingTxs = pendingMap;
  } catch {
    checks.pendingTxs = { error: "unavailable" };
  }

  const httpStatus = status === "error" ? 503 : 200;
  return NextResponse.json({ status, checks }, { status: httpStatus });
}
