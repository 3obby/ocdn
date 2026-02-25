import { prisma } from "@/lib/db";
import { mapPost, getTipHeight, bigintToNumber, log } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * GET /api/events
 *
 * Server-Sent Events stream. Polls the DB for new content since the client's
 * last-seen height and pushes events when new posts/burns/signals appear.
 *
 * Query params:
 *   since=<blockHeight>   start streaming from this height (default: current tip)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get("since");

  let lastSeenHeight = sinceParam ? parseInt(sinceParam, 10) : 0;
  if (isNaN(lastSeenHeight) || lastSeenHeight < 0) lastSeenHeight = 0;

  // If no since param provided, start from current tip
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

      // Send initial connection event
      send("connected", { lastSeenHeight });

      let heartbeatCounter = 0;

      const poll = async () => {
        if (closed) return;

        try {
          const tipHeight = await getTipHeight(prisma);

          if (tipHeight > lastSeenHeight) {
            // New posts since lastSeenHeight
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

            // New burns since lastSeenHeight
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

            // New signals since lastSeenHeight
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

            // Tip update
            send("tip", { height: tipHeight });
            lastSeenHeight = tipHeight;
          }

          // Heartbeat every ~30s
          heartbeatCounter += POLL_INTERVAL_MS;
          if (heartbeatCounter >= HEARTBEAT_INTERVAL_MS) {
            send("heartbeat", { ts: Date.now(), tipHeight });
            heartbeatCounter = 0;
          }
        } catch (err) {
          log("error", "sse", "poll error", { error: String(err) });
        }

        if (!closed) {
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      };

      // Start polling loop
      poll();

      // Handle client disconnect
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
