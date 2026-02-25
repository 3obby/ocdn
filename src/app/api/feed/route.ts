import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  mapPost,
  mapTopic,
  getTipHeight,
  rateLimit,
  parsePageSize,
  parseProtocolFilter,
  errorResponse,
  bigintToNumber,
} from "@/lib/api-utils";
import type { TopicGroup, Post as FrontendPost } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/feed
 *
 * Query params:
 *   sort=topics (default) | new | top
 *   topic=<topicHash>         filter to a single topic
 *   protocol=ocdn|ew|all      filter by protocol (default: all)
 *   cursor=<contentHash>      cursor-based pagination (last contentHash)
 *   limit=<number>            page size (default 20, max 100)
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const sort = searchParams.get("sort") ?? "topics";
  const topicFilter = searchParams.get("topic");
  const protocolFilter = parseProtocolFilter(searchParams.get("protocol"));
  const cursor = searchParams.get("cursor");
  const limit = parsePageSize(searchParams.get("limit"));

  if (!["topics", "new", "top"].includes(sort)) {
    return errorResponse("sort must be one of: topics, new, top");
  }

  try {
    const tipHeight = await getTipHeight(prisma);

    if (sort === "topics") {
      return NextResponse.json(await getGroupedFeed(topicFilter, protocolFilter, limit, tipHeight));
    }

    return NextResponse.json(await getFlatFeed(sort as "new" | "top", topicFilter, protocolFilter, cursor, limit, tipHeight));
  } catch (err) {
    console.error("GET /api/feed error:", err);
    return errorResponse("Internal server error", 500);
  }
}

async function getGroupedFeed(
  topicFilter: string | null,
  protocolFilter: string | null,
  postsPerTopic: number,
  tipHeight: number,
): Promise<{ groups: TopicGroup[] }> {
  const protoWhere = protocolFilter ? { protocol: protocolFilter } : {};

  if (topicFilter) {
    const topicAgg = await prisma.topicAggregate.findUnique({
      where: { topicHash: topicFilter },
    });
    const topic = topicAgg ? mapTopic(topicAgg) : null;

    const posts = await prisma.post.findMany({
      where: { topicHash: topicFilter, ...protoWhere },
      include: { burns: { select: { amount: true } } },
      orderBy: { blockHeight: "desc" },
      take: postsPerTopic,
    });

    return {
      groups: [{
        topic,
        posts: posts.map((p) => mapPost(p, tipHeight)),
      }],
    };
  }

  const topics = await prisma.topicAggregate.findMany({
    orderBy: { totalBurned: "desc" },
    take: 50,
  });

  const groups: TopicGroup[] = [];

  for (const topicAgg of topics) {
    const posts = await prisma.post.findMany({
      where: { topicHash: topicAgg.topicHash, parentHash: null, ...protoWhere },
      include: { burns: { select: { amount: true } } },
      orderBy: { blockHeight: "desc" },
      take: 3,
    });

    if (posts.length > 0) {
      const mapped = posts
        .map((p) => mapPost(p, tipHeight))
        .sort((a, b) => b.burnTotal - a.burnTotal);
      groups.push({ topic: mapTopic(topicAgg), posts: mapped });
    }
  }

  const standalone = await prisma.post.findMany({
    where: { topicHash: null, parentHash: null, ...protoWhere },
    include: { burns: { select: { amount: true } } },
    orderBy: { blockHeight: "desc" },
    take: 3,
  });

  if (standalone.length > 0) {
    const mapped = standalone
      .map((p) => mapPost(p, tipHeight))
      .sort((a, b) => b.burnTotal - a.burnTotal);
    groups.push({ topic: null, posts: mapped });
  }

  return { groups };
}

async function getFlatFeed(
  sort: "new" | "top",
  topicFilter: string | null,
  protocolFilter: string | null,
  cursor: string | null,
  limit: number,
  tipHeight: number,
): Promise<{ posts: FrontendPost[]; nextCursor: string | null }> {
  const where: Record<string, unknown> = {};
  if (topicFilter) where.topicHash = topicFilter;
  if (protocolFilter) where.protocol = protocolFilter;

  if (sort === "new") {
    if (cursor) {
      const cursorPost = await prisma.post.findUnique({
        where: { contentHash: cursor },
        select: { blockHeight: true, contentHash: true },
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

    return { posts: mapped, nextCursor };
  }

  // sort === "top" — rank by burn total
  // We need to aggregate burns per post; use a raw approach for efficiency
  const posts = await prisma.post.findMany({
    where,
    include: { burns: { select: { amount: true } } },
  });

  const mapped = posts.map((p) => mapPost(p, tipHeight));
  mapped.sort((a, b) => b.burnTotal - a.burnTotal);

  // Simple offset pagination for "top" since ordering is by computed value
  const cursorIdx = cursor ? mapped.findIndex((p) => p.contentHash === cursor) : -1;
  const startIdx = cursorIdx >= 0 ? cursorIdx + 1 : 0;
  const page = mapped.slice(startIdx, startIdx + limit);
  const nextCursor = startIdx + limit < mapped.length ? page[page.length - 1]?.contentHash ?? null : null;

  return { posts: page, nextCursor };
}
