/**
 * Daily leaderboard imprint: promotes the top PoW ephemeral content to
 * permanent Bitcoin posts, funded by the public leaderboard fund wallet.
 * Runs as a cron job every 24h (midnight UTC).
 *
 * The top-N ephemeral posts by powDifficulty in the previous 24h window
 * are promoted via the payment pipeline. Bitcoin posts with PoW are logged
 * but already permanent — they just earn a leaderboard record.
 *
 * Fund wallet: LEADERBOARD_FUND_ADDRESS (anyone can donate)
 * Fund key:    LEADERBOARD_FUND_PRIVKEY (used to sign promotion txs)
 *
 * Usage: npx tsx scripts/leaderboard-imprint.ts
 */

import "dotenv/config";
import ws from "ws";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";

neonConfig.webSocketConstructor = ws;

const TOP_N = Number(process.env.LEADERBOARD_TOP_N ?? "4");

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter }) as unknown as import("../src/generated/prisma/client.js").PrismaClient;

  const now = new Date();
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  console.log(`Leaderboard cycle: ${windowStart.toISOString()} → ${now.toISOString()}`);

  // Top ephemeral posts by PoW difficulty in the window
  const topEphemeral = await prisma.ephemeralPost.findMany({
    where: {
      powDifficulty: { gt: 0 },
      createdAt: { gte: windowStart },
      promotedToHash: null,
    },
    orderBy: { powDifficulty: "desc" },
    take: TOP_N,
  });

  // Top Bitcoin posts by PoW difficulty in the window (for logging)
  const topBitcoin = await prisma.post.findMany({
    where: {
      powDifficulty: { gt: 0 },
      createdAt: { gte: windowStart },
    },
    orderBy: { powDifficulty: "desc" },
    take: TOP_N,
  });

  console.log(`\nTop ${TOP_N} ephemeral posts by PoW:`);
  for (const ep of topEphemeral) {
    console.log(`  ⚡${ep.powDifficulty} — ${ep.content.slice(0, 60)}… [${ep.nostrEventId.slice(0, 12)}]`);
  }

  console.log(`\nTop ${TOP_N} Bitcoin posts by PoW:`);
  for (const bp of topBitcoin) {
    console.log(`  ⚡${bp.powDifficulty} — ${bp.content.slice(0, 60)}… [${bp.contentHash.slice(0, 12)}]`);
  }

  const fundAddress = process.env.LEADERBOARD_FUND_ADDRESS;
  const fundKey = process.env.LEADERBOARD_FUND_PRIVKEY;
  if (!fundAddress || !fundKey) {
    console.log("\n⚠ LEADERBOARD_FUND_ADDRESS / LEADERBOARD_FUND_PRIVKEY not set. Skipping promotion.");
  } else {
    // Check fund balance via mempool.space
    try {
      const res = await fetch(`https://mempool.space/api/address/${fundAddress}`);
      if (res.ok) {
        const data = await res.json();
        const balance = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
        console.log(`\nFund balance: ${balance} sats (${(balance / 1e8).toFixed(8)} BTC)`);
        if (balance < 5000) {
          console.log("⚠ Fund balance too low for inscription. Skipping promotion.");
        }
      }
    } catch (e) {
      console.log(`\n⚠ Could not check fund balance: ${e}`);
    }

    // TODO: Construct and broadcast promotion transactions.
    // For each ephemeral winner:
    //   1. Build commit/reveal tx using fund wallet UTXOs
    //   2. Content from the ephemeral post, author pubkey preserved
    //   3. Broadcast via Bitcoin Core RPC
    //   4. Update EphemeralPost.promotedToHash = new contentHash
  }

  if (topEphemeral.length === 0 && topBitcoin.length === 0) {
    console.log("\nNo PoW activity in this window. Nothing to imprint.");
  } else {
    console.log(`\nLeaderboard cycle complete. ${topEphemeral.length} ephemeral + ${topBitcoin.length} Bitcoin entries.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
