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

async function main() {
  console.log("ocdn indexer starting…");

  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter }) as unknown as import("../src/generated/prisma/client.js").PrismaClient;
  const rpc = new BitcoinRpc();

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nshutting down…");
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
  console.error("fatal:", e);
  process.exit(1);
});
