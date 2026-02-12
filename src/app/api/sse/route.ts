import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Server-Sent Events endpoint for live updates.
 * Polls for new events and streams them to connected clients.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const contentHash = searchParams.get("hash") ?? undefined;

  const encoder = new TextEncoder();
  let lastCheck = Math.floor(Date.now() / 1000);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Send initial ping
      send({ type: "connected", timestamp: Date.now() });

      const interval = setInterval(async () => {
        try {
          const where: Record<string, unknown> = {
            createdAt: { gt: lastCheck },
          };
          if (contentHash) {
            where.tags = {
              path: "$",
              array_contains: [["r", contentHash]],
            };
          }

          const newEvents = await prisma.nostrEvent.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 20,
          });

          for (const event of newEvents) {
            send({ type: "event", event });
          }

          if (newEvents.length > 0) {
            lastCheck = newEvents[0].createdAt;

            // Send updated importance if applicable
            if (contentHash) {
              const importance = await prisma.importance.findUnique({
                where: { hash: contentHash },
              });
              if (importance) {
                send({ type: "importance", data: importance });
              }
            }
          }
        } catch {
          // Connection might be closed
        }
      }, 5000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
