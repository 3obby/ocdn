import "dotenv/config";
import ws from "ws";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { BitcoinRpc } from "../src/lib/bitcoin/rpc.js";
import { runIndexer } from "../src/lib/indexer/scanner.js";

neonConfig.webSocketConstructor = ws;

const DEFAULTS = {
  startHeight: Number(process.env.INDEXER_START_HEIGHT ?? "0"),
  pollIntervalMs: Number(process.env.INDEXER_POLL_MS ?? "10000"),
  stateFlushInterval: Number(process.env.INDEXER_FLUSH_INTERVAL ?? "50"),
};

function slog(level: string, msg: string, data?: Record<string, unknown>) {
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, ctx: "indexer-main", msg, ...(data ? { data } : {}) });
  if (level === "error") console.error(entry);
  else console.log(entry);
}

async function main() {
  slog("info", "indexer starting");

  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter }) as unknown as import("../src/generated/prisma/client.js").PrismaClient;
  const rpc = new BitcoinRpc();

  // Release stale UTXO reservations from previous crashes
  const staleReleased = await prisma.utxo.updateMany({
    where: { status: "reserved", reservedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
    data: { status: "available", reservedAt: null },
  });
  if (staleReleased.count > 0) {
    slog("info", "released stale UTXO reservations", { count: staleReleased.count });
  }

  const shutdown = async () => {
    slog("info", "shutting down");
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await runIndexer({
    rpc,
    prisma,
    startHeight: DEFAULTS.startHeight,
    pollIntervalMs: DEFAULTS.pollIntervalMs,
    stateFlushInterval: DEFAULTS.stateFlushInterval,
  });
}

main().catch((e) => {
  slog("error", "fatal", { error: String(e) });
  process.exit(1);
});
