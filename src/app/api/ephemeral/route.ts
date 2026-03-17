import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, parsePageSize, errorResponse, log, mapEphemeralPost } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// Fields needed for display — rawEvent is large JSON we never send to the frontend
const EPH_SELECT = {
  nostrEventId: true,
  nostrPubkey: true,
  content: true,
  topic: true,
  topicHash: true,
  parentContentHash: true,
  parentNostrId: true,
  replyDepth: true,
  anchoredToBtc: true,
  powDifficulty: true,
  upvoteWeight: true,
  boostCount: true,
  lastBoostedAt: true,
  expiresAt: true,
  promotedToHash: true,
  createdAt: true,
} as const;

// Hard caps to prevent runaway queries
const ROOTS_LIMIT = 200;
const CHILDREN_LIMIT = 150;  // per childrenOf request (≈ 5 children × 30 roots)
const GRANDCHILDREN_LIMIT = 150;
const FULL_CHILDREN_LIMIT = 400; // for the combined root=true path

/**
 * GET /api/ephemeral
 *
 * Query params:
 *   parentHash=<contentHash>   — ephemeral children of a Bitcoin-layer post
 *   topicHash=<hash>           — ephemeral posts under a topic
 *   pubkey=<nostrPubkey>       — all posts by this pubkey
 *   root=true                  — root ephemeral posts only (no parent); includes children/grandchildren
 *   rootsOnly=true             — same as root=true but returns ONLY root rows (fast, for section headers)
 *   childrenOf=<ids,…>         — fetch children/grandchildren for a comma-separated list of root IDs
 *   sort=new|top               — new = createdAt, top = upvoteWeight
 *   order=asc|desc             — sort direction (default desc)
 *   cursor=<nostrEventId>      — pagination cursor
 *   limit=<n>                  — page size
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const parentHash = searchParams.get("parentHash");
  const topicHash = searchParams.get("topicHash");
  const pubkey = searchParams.get("pubkey");
  const root = searchParams.get("root") === "true";
  const rootsOnly = searchParams.get("rootsOnly") === "true";
  const childrenOf = searchParams.get("childrenOf");
  const sort = searchParams.get("sort") === "new" ? "new" : "top";
  const order = searchParams.get("order") === "asc" ? ("asc" as const) : ("desc" as const);
  const cursor = searchParams.get("cursor");
  const limit = parsePageSize(searchParams.get("limit"));

  if (!parentHash && !topicHash && !root && !rootsOnly && !pubkey && !childrenOf) {
    return errorResponse("parentHash, topicHash, root=true, rootsOnly=true, childrenOf, or pubkey is required");
  }

  try {
    const now = new Date();
    const expiry = { gt: now };

    // ── Fast path: roots only (no children), used for immediate section header rendering ──
    // Fetches top N roots per distinct topic so every board is represented, not just the most-recent one.
    if (rootsOnly && !topicHash && !parentHash && !pubkey && !cursor) {
      // Step 1: get all distinct topicHash values among live roots (fast index scan)
      const topicGroups = await prisma.ephemeralPost.groupBy({
        by: ["topicHash"],
        where: {
          parentContentHash: null,
          parentNostrId: null,
          expiresAt: expiry,
          promotedToHash: null,
        },
        _count: { nostrEventId: true },
        orderBy: { _count: { nostrEventId: "desc" } },
        take: 30, // cap at 30 unique topics
      });

      // Step 2: fetch top roots per topic in parallel (1 query per topic)
      const PER_TOPIC = 15;
      const orderBy = sort === "top"
        ? [{ upvoteWeight: order }, { createdAt: order }]
        : [{ createdAt: order }];

      const perTopicResults = await Promise.all(
        topicGroups.map((g) =>
          prisma.ephemeralPost.findMany({
            where: {
              topicHash: g.topicHash,
              parentContentHash: null,
              parentNostrId: null,
              expiresAt: expiry,
              promotedToHash: null,
            },
            orderBy,
            take: PER_TOPIC,
            select: EPH_SELECT,
          })
        )
      );

      const roots = perTopicResults.flat();
      return NextResponse.json({ posts: roots.map(mapEphemeralPost) });
    }

    // ── Children/grandchildren fetch for a set of root IDs ──
    if (childrenOf) {
      const rootIds = childrenOf.split(",").filter(Boolean).slice(0, 300);
      if (rootIds.length === 0) return NextResponse.json({ posts: [] });

      const children = await prisma.ephemeralPost.findMany({
        where: { parentNostrId: { in: rootIds }, expiresAt: expiry, promotedToHash: null },
        take: CHILDREN_LIMIT,
        select: EPH_SELECT,
      });

      const childIds = children.map((c) => c.nostrEventId);
      const grandchildren = childIds.length > 0
        ? await prisma.ephemeralPost.findMany({
            where: { parentNostrId: { in: childIds }, expiresAt: expiry, promotedToHash: null },
            take: GRANDCHILDREN_LIMIT,
            select: EPH_SELECT,
          })
        : [];

      return NextResponse.json({
        posts: [...children, ...grandchildren].map(mapEphemeralPost),
      });
    }

    // ── Full balanced fetch: roots + children + grandchildren ──
    if (root && !topicHash && !parentHash && !pubkey && !cursor) {
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
        take: ROOTS_LIMIT,
        select: EPH_SELECT,
      });

      const seen = new Set(roots.map((p) => p.nostrEventId));
      const allPosts = [...roots];

      if (seen.size > 0) {
        const children = await prisma.ephemeralPost.findMany({
          where: { parentNostrId: { in: [...seen] }, expiresAt: expiry, promotedToHash: null },
          take: FULL_CHILDREN_LIMIT,
          select: EPH_SELECT,
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
            take: FULL_CHILDREN_LIMIT,
            select: EPH_SELECT,
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

    // ── Standard paginated fetch (by topic, parent, or pubkey) ──
    const where: Record<string, unknown> = {
      expiresAt: { gt: now },
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
      select: EPH_SELECT,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].nostrEventId : null;

    if (pubkey) {
      const expiredCount = await prisma.ephemeralPost.count({
        where: { nostrPubkey: pubkey, expiresAt: { lte: now } },
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
              select: EPH_SELECT,
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
    log("error", "api/ephemeral", err instanceof Error ? err.message : String(err));
    return errorResponse("Internal server error", 500);
  }
}
