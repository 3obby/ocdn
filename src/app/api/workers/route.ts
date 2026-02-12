import { NextResponse } from "next/server";
import { startRelaySubscriber } from "@/workers/relay-sub";
import { startSettler } from "@/workers/settler";
import { startClearinghouse } from "@/workers/clearing";

/**
 * Worker lifecycle state.
 * Workers are singletons — calling POST /api/workers multiple times is safe.
 */
let workersStarted = false;
let workerStatus: {
  relaySub: boolean;
  settler: boolean;
  clearing: boolean;
} = { relaySub: false, settler: false, clearing: false };

/**
 * POST /api/workers — Start background workers (relay subscriber, settler, clearinghouse).
 * Idempotent: safe to call multiple times.
 */
export async function POST() {
  if (workersStarted) {
    return NextResponse.json({
      message: "Workers already running",
      status: workerStatus,
    });
  }

  workersStarted = true;

  try {
    // Start relay subscriber
    await startRelaySubscriber();
    workerStatus.relaySub = true;
  } catch (err) {
    console.error("[workers] Failed to start relay subscriber:", err);
  }

  try {
    // Start settler (runs on interval)
    startSettler();
    workerStatus.settler = true;
  } catch (err) {
    console.error("[workers] Failed to start settler:", err);
  }

  try {
    // Start clearinghouse (runs on interval)
    startClearinghouse();
    workerStatus.clearing = true;
  } catch (err) {
    console.error("[workers] Failed to start clearinghouse:", err);
  }

  return NextResponse.json({
    message: "Workers started",
    status: workerStatus,
  });
}

/**
 * GET /api/workers — Check worker status.
 */
export async function GET() {
  return NextResponse.json({
    started: workersStarted,
    status: workerStatus,
  });
}
