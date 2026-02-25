import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  mapPost,
  getTipHeight,
  rateLimit,
  parsePageSize,
  parseProtocolFilter,
  notFound,
  errorResponse,
  bigintToNumber,
  log,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/author/:pubkey
 *
 * Post history, burn totals, key age for a given author pubkey.
 * Query params:
 *   cursor=<contentHash>   cursor-based pagination
 *   limit=<number>         page size (default 20, max 100)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ pubkey: string }> },
) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  const { pubkey } = await params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = parsePageSize(searchParams.get("limit"));
  const protocolFilter = parseProtocolFilter(searchParams.get("protocol"));

  try {
    const tipHeight = await getTipHeight(prisma);

    const authorAgg = await prisma.authorAggregate.findUnique({
      where: { pubkey },
    });

    if (!authorAgg) return notFound("Author not found");

    const where: Record<string, unknown> = { authorPubkey: pubkey };
    if (protocolFilter) where.protocol = protocolFilter;
    if (cursor) {
      const cursorPost = await prisma.post.findUnique({
        where: { contentHash: cursor },
        select: { blockHeight: true },
      });
      if (cursorPost) {
        where.OR = [
          { blockHeight: { lt: cursorPost.blockHeight } },
          { blockHeight: cursorPost.blockHeight, contentHash: { lt: cursor } },
        ];
      }
    }

    const posts = await prisma.post.findMany({
      where,
      include: { burns: { select: { amount: true } } },
      orderBy: [{ blockHeight: "desc" }, { contentHash: "desc" }],
      take: limit + 1,
    });

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;
    const mapped = page.map((p) => mapPost(p, tipHeight));
    const nextCursor = hasMore ? page[page.length - 1].contentHash : null;

    return NextResponse.json({
      author: {
        pubkey: authorAgg.pubkey,
        postCount: authorAgg.postCount,
        totalBurnsReceived: bigintToNumber(authorAgg.totalBurnsReceived),
        totalBurnsGiven: bigintToNumber(authorAgg.totalBurnsGiven),
        firstSeenHeight: authorAgg.firstSeenHeight,
        lastSeenHeight: authorAgg.lastSeenHeight,
      },
      posts: mapped,
      nextCursor,
    });
  } catch (err) {
    log("error", "api/author", "author query failed", { pubkey, error: String(err) });
    return errorResponse("Internal server error", 500);
  }
}
