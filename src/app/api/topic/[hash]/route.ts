import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  mapPost,
  mapTopic,
  getTipHeight,
  rateLimit,
  parsePageSize,
  parseProtocolFilter,
  notFound,
  errorResponse,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/topic/:hash
 *
 * Posts under a topic, root posts ranked by burn total (descending).
 * Query params:
 *   cursor=<contentHash>   cursor-based pagination
 *   limit=<number>         page size (default 20, max 100)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  const { hash } = await params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = parsePageSize(searchParams.get("limit"));
  const protocolFilter = parseProtocolFilter(searchParams.get("protocol"));

  try {
    const tipHeight = await getTipHeight(prisma);

    const topicAgg = await prisma.topicAggregate.findUnique({
      where: { topicHash: hash },
    });

    if (!topicAgg) return notFound("Topic not found");

    const where: Record<string, unknown> = { topicHash: hash };
    if (protocolFilter) where.protocol = protocolFilter;

    const posts = await prisma.post.findMany({
      where,
      include: { burns: { select: { amount: true } } },
    });

    const mapped = posts.map((p) => mapPost(p, tipHeight));
    mapped.sort((a, b) => b.burnTotal - a.burnTotal);

    const cursorIdx = cursor ? mapped.findIndex((p) => p.contentHash === cursor) : -1;
    const startIdx = cursorIdx >= 0 ? cursorIdx + 1 : 0;
    const page = mapped.slice(startIdx, startIdx + limit);
    const nextCursor = startIdx + limit < mapped.length ? page[page.length - 1]?.contentHash ?? null : null;

    return NextResponse.json({
      topic: mapTopic(topicAgg),
      posts: page,
      nextCursor,
    });
  } catch (err) {
    console.error("GET /api/topic error:", err);
    return errorResponse("Internal server error", 500);
  }
}
