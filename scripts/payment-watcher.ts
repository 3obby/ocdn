/**
 * Payment watcher — standalone process that polls for incoming payments
 * and settles them by broadcasting the corresponding on-chain actions.
 *
 * Usage: npx tsx scripts/payment-watcher.ts
 */

import "dotenv/config";
import { checkAndSettlePayments } from "../src/lib/payment-settler";

const POLL_INTERVAL_MS = Number(process.env.PAYMENT_POLL_MS ?? "10000");

async function main() {
  console.log(`[payment-watcher] starting, poll interval ${POLL_INTERVAL_MS}ms`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const settled = await checkAndSettlePayments();
      if (settled > 0) {
        console.log(`[payment-watcher] settled ${settled} payment(s)`);
      }
    } catch (err) {
      console.error("[payment-watcher] error:", err instanceof Error ? err.message : err);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error("[payment-watcher] fatal:", err);
  process.exit(1);
});
