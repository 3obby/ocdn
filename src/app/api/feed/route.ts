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
  log,
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
  const topicless = searchParams.get("topicless") === "true";
  const excludeTopicless = searchParams.get("excludeTopicless") === "true";
  const excludeTopicsParam = searchParams.get("excludeTopics");
  const excludeTopics = excludeTopicsParam
    ? excludeTopicsParam.split(",").map((h) => h.trim()).filter(Boolean)
    : [];
  const protocolFilter = parseProtocolFilter(searchParams.get("protocol"));
  const cursor = searchParams.get("cursor");
  const limit = parsePageSize(searchParams.get("limit"));
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";

  if (!["topics", "new", "top"].includes(sort)) {
    return errorResponse("sort must be one of: topics, new, top");
  }

  const section = searchParams.get("section");

  try {
    const tipHeight = await getTipHeight(prisma);

    if (section === "untagged" || section === "ew") {
      return NextResponse.json(await getSectionFeed(section, cursor, limit, tipHeight));
    }

    if (sort === "topics") {
      return NextResponse.json(await getGroupedFeed(topicFilter, topicless, excludeTopicless, excludeTopics, protocolFilter, limit, tipHeight, order));
    }

    return NextResponse.json(await getFlatFeed(sort as "new" | "top", topicFilter, topicless, excludeTopicless, excludeTopics, protocolFilter, cursor, limit, tipHeight, order));
  } catch (err) {
    log("error", "api/feed", "feed query failed", { error: String(err) });
    return errorResponse("Internal server error", 500);
  }
}

async function getGroupedFeed(
  topicFilter: string | null,
  topicless: boolean,
  excludeTopicless: boolean,
  excludeTopics: string[],
  protocolFilter: string | null,
  postsPerTopic: number,
  tipHeight: number,
  order: "asc" | "desc",
): Promise<{ groups: TopicGroup[]; untagged: FrontendPost[]; untaggedHasMore: boolean; ewPosts: FrontendPost[]; ewHasMore: boolean }> {
  const protoWhere = protocolFilter ? { protocol: protocolFilter } : {};

  if (topicless) {
    const standalone = await prisma.post.findMany({
      where: { topicHash: null, parentHash: null, protocol: "ocdn" },
      include: { burns: { select: { amount: true } } },
      orderBy: { blockHeight: order },
      take: postsPerTopic,
    });
    const mapped = standalone.map((p) => mapPost(p, tipHeight));
    return { groups: [{ topic: null, posts: mapped }], untagged: [], untaggedHasMore: false, ewPosts: [], ewHasMore: false };
  }

  if (protocolFilter && !topicFilter) {
    const rows = await prisma.post.findMany({
      where: { protocol: protocolFilter, parentHash: null },
      include: { burns: { select: { amount: true } } },
      orderBy: { blockHeight: order },
      take: postsPerTopic,
    });
    const mapped = rows.map((p) => mapPost(p, tipHeight));
    return { groups: [{ topic: null, posts: mapped }], untagged: [], untaggedHasMore: false, ewPosts: [], ewHasMore: false };
  }

  if (topicFilter) {
    const topicAgg = await prisma.topicAggregate.findUnique({
      where: { topicHash: topicFilter },
    });
    const topic = topicAgg ? mapTopic(topicAgg) : null;

    const posts = await prisma.post.findMany({
      where: { topicHash: topicFilter, ...protoWhere },
      include: { burns: { select: { amount: true } } },
      orderBy: { blockHeight: order },
      take: postsPerTopic,
    });

    return {
      groups: [{
        topic,
        posts: posts.map((p) => mapPost(p, tipHeight)),
      }],
      untagged: [],
      untaggedHasMore: false,
      ewPosts: [],
      ewHasMore: false,
    };
  }

  const topicsRaw = await prisma.topicAggregate.findMany({
    orderBy: { totalBurned: order },
    take: 50,
  });

  const topics = excludeTopics.length > 0
    ? topicsRaw.filter((t) => !excludeTopics.includes(t.topicHash))
    : topicsRaw;

  // OCDN topic groups
  const groups: TopicGroup[] = [];
  for (const topicAgg of topics) {
    const posts = await prisma.post.findMany({
      where: { topicHash: topicAgg.topicHash, parentHash: null, protocol: "ocdn" },
      include: { burns: { select: { amount: true } } },
      orderBy: { blockHeight: order },
    });
    if (posts.length > 0) {
      const mapped = posts
        .map((p) => mapPost(p, tipHeight))
        .sort((a, b) => (order === "desc" ? b.burnTotal - a.burnTotal : a.burnTotal - b.burnTotal));
      groups.push({ topic: mapTopic(topicAgg), posts: mapped });
    }
  }

  const sectionLimit = 7;

  // Untagged OCDN posts (separate section, paginated)
  let untagged: FrontendPost[] = [];
  let untaggedHasMore = false;
  if (!excludeTopicless) {
    const standalone = await prisma.post.findMany({
      where: { topicHash: null, parentHash: null, protocol: "ocdn" },
      include: { burns: { select: { amount: true } } },
      orderBy: { blockHeight: order },
      take: sectionLimit + 1,
    });
    untaggedHasMore = standalone.length > sectionLimit;
    const page = untaggedHasMore ? standalone.slice(0, sectionLimit) : standalone;
    untagged = page.map((p) => mapPost(p, tipHeight));
  }

  // EternityWall posts (separate section, paginated)
  const ewRaw = await prisma.post.findMany({
    where: { protocol: "ew", parentHash: null },
    include: { burns: { select: { amount: true } } },
    orderBy: { blockHeight: order },
    take: sectionLimit + 1,
  });
  const ewHasMore = ewRaw.length > sectionLimit;
  const ewPage = ewHasMore ? ewRaw.slice(0, sectionLimit) : ewRaw;
  const ewPosts = ewPage.map((p) => mapPost(p, tipHeight));

  return {
    groups,
    untagged,
    untaggedHasMore,
    ewPosts,
    ewHasMore,
  };
}

async function getSectionFeed(
  section: "untagged" | "ew",
  cursor: string | null,
  limit: number,
  tipHeight: number,
): Promise<{ posts: FrontendPost[]; hasMore: boolean }> {
  const where: Record<string, unknown> = { parentHash: null };
  if (section === "untagged") {
    where.protocol = "ocdn";
    where.topicHash = null;
  } else {
    where.protocol = "ew";
  }

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

  const rows = await prisma.post.findMany({
    where,
    include: { burns: { select: { amount: true } } },
    orderBy: [{ blockHeight: "desc" }, { contentHash: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { posts: page.map((p) => mapPost(p, tipHeight)), hasMore };
}

async function getFlatFeed(
  sort: "new" | "top",
  topicFilter: string | null,
  topicless: boolean,
  excludeTopicless: boolean,
  excludeTopics: string[],
  protocolFilter: string | null,
  cursor: string | null,
  limit: number,
  tipHeight: number,
  order: "asc" | "desc",
): Promise<{ posts: FrontendPost[]; nextCursor: string | null }> {
  const where: Record<string, unknown> = {};
  if (topicFilter) where.topicHash = topicFilter;
  if (topicless) where.topicHash = null;
  if ((excludeTopicless || excludeTopics.length > 0) && !topicFilter && !topicless) {
    if (excludeTopicless && excludeTopics.length > 0) {
      where.AND = [
        { topicHash: { not: null } },
        { topicHash: { notIn: excludeTopics } },
      ];
    } else if (excludeTopicless) {
      where.topicHash = { not: null };
    } else {
      where.topicHash = { notIn: excludeTopics };
    }
  }
  if (protocolFilter) where.protocol = protocolFilter;

  if (sort === "new") {
    if (cursor) {
      const cursorPost = await prisma.post.findUnique({
        where: { contentHash: cursor },
        select: { blockHeight: true, contentHash: true },
      });
      if (cursorPost) {
        where.OR = order === "desc"
          ? [
              { blockHeight: { lt: cursorPost.blockHeight } },
              { blockHeight: cursorPost.blockHeight, contentHash: { lt: cursor } },
            ]
          : [
              { blockHeight: { gt: cursorPost.blockHeight } },
              { blockHeight: cursorPost.blockHeight, contentHash: { gt: cursor } },
            ];
      }
    }

    const posts = await prisma.post.findMany({
      where,
      include: { burns: { select: { amount: true } } },
      orderBy: order === "desc"
        ? [{ blockHeight: "desc" }, { contentHash: "desc" }]
        : [{ blockHeight: "asc" }, { contentHash: "asc" }],
      take: limit + 1,
    });

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;
    const mapped = page.map((p) => mapPost(p, tipHeight));
    const nextCursor = hasMore ? page[page.length - 1].contentHash : null;

    return { posts: mapped, nextCursor };
  }

  // sort === "top" — rank by burn total
  const posts = await prisma.post.findMany({
    where,
    include: { burns: { select: { amount: true } } },
  });

  const mapped = posts.map((p) => mapPost(p, tipHeight));
  mapped.sort((a, b) => (order === "desc" ? b.burnTotal - a.burnTotal : a.burnTotal - b.burnTotal));

  // Simple offset pagination for "top" since ordering is by computed value
  const cursorIdx = cursor ? mapped.findIndex((p) => p.contentHash === cursor) : -1;
  const startIdx = cursorIdx >= 0 ? cursorIdx + 1 : 0;
  const page = mapped.slice(startIdx, startIdx + limit);
  const nextCursor = startIdx + limit < mapped.length ? page[page.length - 1]?.contentHash ?? null : null;

  return { posts: page, nextCursor };
}
