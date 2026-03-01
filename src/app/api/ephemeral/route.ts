import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, parsePageSize, errorResponse, log, mapEphemeralPost } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/ephemeral
 *
 * Query params:
 *   parentHash=<contentHash>   — ephemeral children of a Bitcoin-layer post (for ThreadView)
 *   topicHash=<hash>           — ephemeral posts under a topic (for topic feed toggle)
 *   sort=new|top               — new = createdAt desc, top = upvoteWeight desc
 *   cursor=<nostrEventId>      — pagination cursor
 *   limit=<n>                  — page size
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const parentHash = searchParams.get("parentHash");
  const topicHash = searchParams.get("topicHash");
  const root = searchParams.get("root") === "true";
  const sort = searchParams.get("sort") === "new" ? "new" : "top";
  const cursor = searchParams.get("cursor");
  const limit = parsePageSize(searchParams.get("limit"));

  if (!parentHash && !topicHash && !root) {
    return errorResponse("parentHash, topicHash, or root=true is required");
  }

  try {
    const where: Record<string, unknown> = {
      expiresAt: { gt: new Date() },
      promotedToHash: null,
    };
    if (parentHash) where.parentContentHash = parentHash;
    if (topicHash) where.topicHash = topicHash;
    if (root) where.parentContentHash = null;

    const orderBy =
      sort === "top"
        ? [{ upvoteWeight: "desc" as const }, { createdAt: "desc" as const }]
        : [{ createdAt: "desc" as const }];

    // Cursor pagination
    if (cursor && sort === "new") {
      const cursorPost = await prisma.ephemeralPost.findUnique({
        where: { nostrEventId: cursor },
        select: { createdAt: true },
      });
      if (cursorPost) {
        where.createdAt = { lt: cursorPost.createdAt };
      }
    }

    const rows = await prisma.ephemeralPost.findMany({
      where,
      orderBy,
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].nostrEventId : null;

    return NextResponse.json({
      posts: page.map(mapEphemeralPost),
      nextCursor,
    });
  } catch (err) {
    log("error", "api/ephemeral", String(err));
    return errorResponse("Internal server error", 500);
  }
}
