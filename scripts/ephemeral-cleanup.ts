/**
 * Prune expired ephemeral posts and old Nostr boosts.
 * Can be run as a standalone script or wired into the indexer.
 *
 * Usage: npx tsx scripts/ephemeral-cleanup.ts
 */

import "dotenv/config";
import ws from "ws";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";

neonConfig.webSocketConstructor = ws;

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter }) as unknown as import("../src/generated/prisma/client.js").PrismaClient;

  const ephDeleted = await prisma.ephemeralPost.deleteMany({
    where: { expiresAt: { lt: new Date() }, promotedToHash: null },
  });
  console.log(`Pruned ${ephDeleted.count} expired ephemeral posts`);

  const boostDeleted = await prisma.nostrBoost.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
  });
  console.log(`Pruned ${boostDeleted.count} old nostr boosts`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
