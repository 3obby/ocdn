import "dotenv/config";
import ws from "ws";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { BitcoinRpc } from "../src/lib/bitcoin/rpc.js";
import { runIndexer } from "../src/lib/indexer/scanner.js";
import { subscribeToOcdnEvents, type NostrEvent } from "../src/lib/nostr/relay-sub.js";

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

  // Start Nostr relay subscription for ephemeral posts
  const nostrRelays = (process.env.NOSTR_RELAYS ?? "wss://relay.damus.io,wss://nos.lol")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const nostrSub = subscribeToOcdnEvents(nostrRelays, async (event: NostrEvent) => {
    try {
      await ingestNostrEvent(prisma, event);
    } catch (e) {
      slog("warn", "nostr event ingest failed", { error: String(e) });
    }
  });
  slog("info", "nostr relay subscription started", { relays: nostrRelays });

  // Cleanup job: prune expired ephemeral posts every 15 minutes
  const cleanupInterval = setInterval(async () => {
    try {
      const deleted = await prisma.ephemeralPost.deleteMany({
        where: { expiresAt: { lt: new Date() }, promotedToHash: null },
      });
      if (deleted.count > 0) slog("info", "pruned expired ephemeral posts", { count: deleted.count });
      const boostsPruned = await prisma.nostrBoost.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
      });
      if (boostsPruned.count > 0) slog("info", "pruned old nostr boosts", { count: boostsPruned.count });
    } catch {}
  }, 15 * 60 * 1000);

  const _shutdown = shutdown;
  process.removeAllListeners("SIGINT");
  process.removeAllListeners("SIGTERM");
  const shutdownFull = async () => {
    clearInterval(cleanupInterval);
    nostrSub.close();
    await _shutdown();
  };
  process.on("SIGINT", shutdownFull);
  process.on("SIGTERM", shutdownFull);

  await runIndexer({
    rpc,
    prisma,
    startHeight: DEFAULTS.startHeight,
    pollIntervalMs: DEFAULTS.pollIntervalMs,
    stateFlushInterval: DEFAULTS.stateFlushInterval,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getTagValue(tags: string[][], name: string): string | null {
  return tags.find((t) => t[0] === name)?.[1] ?? null;
}

function countLeadingZeroBits(id: string): number {
  let bits = 0;
  for (let i = 0; i < id.length; i += 2) {
    const byte = parseInt(id.slice(i, i + 2), 16);
    if (byte === 0) { bits += 8; }
    else { for (let b = 7; b >= 0; b--) { if ((byte >> b) & 1) break; bits++; } break; }
  }
  return bits;
}

async function ingestNostrEvent(prisma: PrismaClient, event: NostrEvent) {
  const minPow = event.kind === 1
    ? Number(process.env.NOSTR_MIN_POW_POST ?? "8")
    : Number(process.env.NOSTR_MIN_POW_BOOST ?? "12");

  const powDifficulty = countLeadingZeroBits(event.id);
  if (powDifficulty < minPow) return; // ignore low-PoW events

  if (event.kind === 1) {
    // Check for ocdn tag
    const hasOcdnTag = event.tags.some((t) => t[0] === "t" && t[1] === "ocdn");
    if (!hasOcdnTag) return;

    const topic = event.tags.filter((t) => t[0] === "t" && t[1] !== "ocdn")[0]?.[1] ?? null;
    const parentContentHash = getTagValue(event.tags, "ocdn-ref");
    const parentNostrId = event.tags.find((t) => t[0] === "e" && t[3] === "reply")?.[1] ?? null;

    const baseTtlMs = Number(process.env.EPHEMERAL_TTL_HOURS ?? "24") * 60 * 60 * 1000;
    const bonusMs = Math.max(0, powDifficulty - 8) * 60 * 60 * 1000;
    const expiresAt = new Date(event.created_at * 1000 + Math.min(baseTtlMs + bonusMs, 7 * 24 * 60 * 60 * 1000));

    await prisma.ephemeralPost.upsert({
      where: { nostrEventId: event.id },
      create: {
        nostrEventId: event.id,
        nostrPubkey: event.pubkey,
        content: event.content,
        topic,
        topicHash: null,
        parentContentHash,
        parentNostrId,
        powDifficulty,
        upvoteWeight: BigInt(0),
        rawEvent: event as object,
        expiresAt,
      },
      update: {},
    });
  } else if (event.kind === 7) {
    const targetNostrId = event.tags.find((t) => t[0] === "e")?.[1] ?? null;
    const targetContentHash = event.tags.find((t) => t[0] === "ocdn-ref")?.[1] ?? null;
    if (!targetNostrId && !targetContentHash) return;

    const powWeight = BigInt(1) << BigInt(powDifficulty);
    await prisma.nostrBoost.upsert({
      where: { nostrEventId: event.id },
      create: {
        nostrEventId: event.id,
        nostrPubkey: event.pubkey,
        targetNostrId,
        targetContentHash,
        powDifficulty,
        powWeight,
        rawEvent: event as object,
      },
      update: {},
    });

    if (targetNostrId) {
      const BOOST_EXT_MS = 30 * 60 * 1000;
      const target = await prisma.ephemeralPost.findUnique({ where: { nostrEventId: targetNostrId } });
      if (target) {
        await prisma.ephemeralPost.update({
          where: { nostrEventId: targetNostrId },
          data: {
            upvoteWeight: { increment: powWeight },
            expiresAt: new Date(Math.min(target.expiresAt.getTime() + BOOST_EXT_MS, Date.now() + 7 * 24 * 60 * 60 * 1000)),
          },
        });
      }
    }
  }
}

main().catch((e) => {
  slog("error", "fatal", { error: String(e) });
  process.exit(1);
});
