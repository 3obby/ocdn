/**
 * Payment watcher — standalone process that polls for incoming payments
 * and settles them by broadcasting the corresponding on-chain actions.
 *
 * Adaptive polling: checks quickly (10s) when pending payments exist,
 * backs off to slow interval (5min) when idle to reduce DB load.
 *
 * Usage: npx tsx scripts/payment-watcher.ts
 */

import "dotenv/config";
import ws from "ws";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { checkAndSettlePayments } from "../src/lib/payment-settler";

neonConfig.webSocketConstructor = ws;

const ACTIVE_POLL_MS = Number(process.env.PAYMENT_POLL_MS ?? "10000");
const IDLE_POLL_MS = Number(process.env.PAYMENT_IDLE_POLL_MS ?? "300000");

function createPrisma() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter }) as unknown as import("../src/generated/prisma/client.js").PrismaClient;
}

async function main() {
  console.log(`[payment-watcher] starting, active=${ACTIVE_POLL_MS}ms idle=${IDLE_POLL_MS}ms`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const prisma = createPrisma();
    let pollMs = IDLE_POLL_MS;

    try {
      const pendingCount = await prisma.paymentRequest.count({
        where: { status: "pending", expiresAt: { gt: new Date() } },
      });

      if (pendingCount > 0) {
        pollMs = ACTIVE_POLL_MS;
        const settled = await checkAndSettlePayments();
        if (settled > 0) {
          console.log(`[payment-watcher] settled ${settled} payment(s)`);
        }
      }
    } catch (err) {
      console.error("[payment-watcher] error:", err instanceof Error ? err.message : err);
    }

    try { await prisma.$disconnect(); } catch {}

    await new Promise((r) => setTimeout(r, pollMs));
  }
}

main().catch((err) => {
  console.error("[payment-watcher] fatal:", err);
  process.exit(1);
});
