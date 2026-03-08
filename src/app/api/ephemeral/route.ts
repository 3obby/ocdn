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
 *   pubkey=<nostrPubkey>       — all posts by this pubkey (for profile view)
 *   root=true                  — root ephemeral posts only (no BTC parent)
 *   sort=new|top               — new = createdAt, top = upvoteWeight
 *   order=asc|desc             — sort direction (default desc)
 *   cursor=<nostrEventId>      — pagination cursor
 *   limit=<n>                  — page size
 *
 * When pubkey is set, also returns: expiredCount, parents (btc + ephemeral)
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const parentHash = searchParams.get("parentHash");
  const topicHash = searchParams.get("topicHash");
  const pubkey = searchParams.get("pubkey");
  const root = searchParams.get("root") === "true";
  const sort = searchParams.get("sort") === "new" ? "new" : "top";
  const order = searchParams.get("order") === "asc" ? ("asc" as const) : ("desc" as const);
  const cursor = searchParams.get("cursor");
  const limit = parsePageSize(searchParams.get("limit"));

  if (!parentHash && !topicHash && !root && !pubkey) {
    return errorResponse("parentHash, topicHash, root=true, or pubkey is required");
  }

  try {
    // Balanced fetch for the "all topics" home feed: 3 queries total
    // 1) all true roots (parentNostrId IS NULL) — every topic represented
    // 2) their direct children  3) grandchildren
    if (root && !topicHash && !parentHash && !pubkey && !cursor) {
      const now = new Date();
      const expiry = { gt: now };

      const roots = await prisma.ephemeralPost.findMany({
        where: {
          parentContentHash: null,
          parentNostrId: null,
          expiresAt: expiry,
          promotedToHash: null,
        },
        orderBy: sort === "top"
          ? [{ upvoteWeight: order }, { createdAt: order }]
          : [{ createdAt: order }],
      });

      const seen = new Set(roots.map((p) => p.nostrEventId));
      const allPosts = [...roots];

      if (seen.size > 0) {
        const children = await prisma.ephemeralPost.findMany({
          where: { parentNostrId: { in: [...seen] }, expiresAt: expiry, promotedToHash: null },
        });
        const newChildIds: string[] = [];
        for (const c of children) {
          if (!seen.has(c.nostrEventId)) {
            seen.add(c.nostrEventId);
            allPosts.push(c);
            newChildIds.push(c.nostrEventId);
          }
        }

        if (newChildIds.length > 0) {
          const grandchildren = await prisma.ephemeralPost.findMany({
            where: { parentNostrId: { in: newChildIds }, expiresAt: expiry, promotedToHash: null },
          });
          for (const gc of grandchildren) {
            if (!seen.has(gc.nostrEventId)) {
              seen.add(gc.nostrEventId);
              allPosts.push(gc);
            }
          }
        }
      }

      return NextResponse.json({ posts: allPosts.map(mapEphemeralPost) });
    }

    const where: Record<string, unknown> = {
      expiresAt: { gt: new Date() },
      promotedToHash: null,
    };
    if (parentHash) where.parentContentHash = parentHash;
    if (topicHash) where.topicHash = topicHash;
    if (root) where.parentContentHash = null;
    if (pubkey) where.nostrPubkey = pubkey;

    const orderBy =
      sort === "top"
        ? [{ upvoteWeight: order }, { createdAt: order }]
        : [{ createdAt: order }];

    if (cursor && sort === "new") {
      const cursorPost = await prisma.ephemeralPost.findUnique({
        where: { nostrEventId: cursor },
        select: { createdAt: true },
      });
      if (cursorPost) {
        where.createdAt = { [order === "asc" ? "gt" : "lt"]: cursorPost.createdAt };
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

    if (pubkey) {
      const expiredCount = await prisma.ephemeralPost.count({
        where: { nostrPubkey: pubkey, expiresAt: { lte: new Date() } },
      });

      const btcHashes = [...new Set(page.map((p) => p.parentContentHash).filter(Boolean))] as string[];
      const ephIds = [...new Set(page.map((p) => p.parentNostrId).filter(Boolean))] as string[];

      const [btcParents, ephParents] = await Promise.all([
        btcHashes.length > 0
          ? prisma.post.findMany({
              where: { contentHash: { in: btcHashes } },
              select: { contentHash: true, content: true, authorPubkey: true, topic: true },
            })
          : [],
        ephIds.length > 0
          ? prisma.ephemeralPost.findMany({
              where: { nostrEventId: { in: ephIds } },
            })
          : [],
      ]);

      return NextResponse.json({
        posts: page.map(mapEphemeralPost),
        nextCursor,
        expiredCount,
        parents: {
          btc: Object.fromEntries(
            btcParents.map((p) => [p.contentHash, { text: p.content, authorPubkey: p.authorPubkey, topicName: p.topic }]),
          ),
          ephemeral: Object.fromEntries(
            ephParents.map((p) => [p.nostrEventId, mapEphemeralPost(p)]),
          ),
        },
      });
    }

    return NextResponse.json({
      posts: page.map(mapEphemeralPost),
      nextCursor,
    });
  } catch (err) {
    log("error", "api/ephemeral", String(err));
    return errorResponse("Internal server error", 500);
  }
}
