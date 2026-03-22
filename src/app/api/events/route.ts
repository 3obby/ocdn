import { prisma } from "@/lib/db";
import { mapPost, getTipHeight, bigintToNumber, log } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const BASE_POLL_MS = Number(process.env.SSE_POLL_INTERVAL_MS ?? "30000");
const MIN_POLL_MS = 10_000;
const MAX_POLL_MS = 120_000;
const HEARTBEAT_INTERVAL_MS = 60_000;
const IDLE_BACKOFF_FACTOR = 1.5;

/**
 * GET /api/events
 *
 * Server-Sent Events stream. Polls the DB for new content since the client's
 * last-seen height and pushes events when new posts/burns/signals appear.
 * Uses adaptive backoff: poll interval increases during idle periods and
 * resets when new data is found.
 */
export async function GET(request: Request) {
  if (process.env.ENABLE_REALTIME_SSE === "false") {
    return new Response("SSE disabled", { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get("since");

  let lastSeenHeight = sinceParam ? parseInt(sinceParam, 10) : 0;
  if (isNaN(lastSeenHeight) || lastSeenHeight < 0) lastSeenHeight = 0;

  if (!sinceParam) {
    const tipHeight = await getTipHeight(prisma);
    lastSeenHeight = tipHeight;
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      send("connected", { lastSeenHeight });

      let currentPollMs = Math.max(BASE_POLL_MS, MIN_POLL_MS);
      let heartbeatCounter = 0;

      const poll = async () => {
        if (closed) return;

        let hadData = false;
        try {
          const tipHeight = await getTipHeight(prisma);

          if (tipHeight > lastSeenHeight) {
            hadData = true;

            const newPosts = await prisma.post.findMany({
              where: { blockHeight: { gt: lastSeenHeight } },
              include: { burns: { select: { amount: true } } },
              orderBy: { blockHeight: "asc" },
              take: 50,
            });

            if (newPosts.length > 0) {
              send("posts", {
                posts: newPosts.map((p) => mapPost(p, tipHeight)),
                tipHeight,
              });
            }

            const newBurns = await prisma.burn.findMany({
              where: { blockHeight: { gt: lastSeenHeight } },
              orderBy: { blockHeight: "asc" },
              take: 50,
            });

            if (newBurns.length > 0) {
              send("burns", {
                burns: newBurns.map((b) => ({
                  txid: b.txid,
                  targetHash: b.targetHash,
                  targetType: b.targetType,
                  amount: bigintToNumber(b.amount),
                  blockHeight: b.blockHeight,
                })),
              });
            }

            const newSignals = await prisma.signal.findMany({
              where: { blockHeight: { gt: lastSeenHeight } },
              orderBy: { blockHeight: "asc" },
              take: 50,
            });

            if (newSignals.length > 0) {
              send("signals", {
                signals: newSignals.map((s) => ({
                  txid: s.txid,
                  signerPubkey: s.signerPubkey,
                  fee: bigintToNumber(s.fee),
                  refs: s.refs,
                  blockHeight: s.blockHeight,
                })),
              });
            }

            send("tip", { height: tipHeight });
            lastSeenHeight = tipHeight;
          }

          heartbeatCounter += currentPollMs;
          if (heartbeatCounter >= HEARTBEAT_INTERVAL_MS) {
            send("heartbeat", { ts: Date.now(), tipHeight });
            heartbeatCounter = 0;
          }
        } catch (err) {
          log("error", "sse", "poll error", { error: String(err) });
        }

        if (hadData) {
          currentPollMs = Math.max(BASE_POLL_MS, MIN_POLL_MS);
        } else {
          currentPollMs = Math.min(currentPollMs * IDLE_BACKOFF_FACTOR, MAX_POLL_MS);
        }

        if (!closed) {
          setTimeout(poll, currentPollMs);
        }
      };

      poll();

      request.signal.addEventListener("abort", () => {
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      });
    },

    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
