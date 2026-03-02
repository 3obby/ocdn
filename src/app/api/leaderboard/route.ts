import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mapPost, getTipHeight, rateLimit, errorResponse, log } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

type LeaderboardEntry = {
  type: "bitcoin" | "ephemeral";
  contentHash?: string;
  nostrEventId?: string;
  text: string;
  authorPubkey: string;
  powDifficulty: number;
  topic?: string | null;
  topicHash?: string | null;
  viewCount?: number;
  createdAt: string;
  burnTotal?: number;
  upvoteWeight?: string;
};

/**
 * GET /api/leaderboard
 *
 * Returns top-N content ranked by powDifficulty within the current 24h window.
 * Merges Bitcoin posts and ephemeral posts into a single ranked list.
 *
 * Query params:
 *   limit=<number>   (default 10, max 50)
 *   window=<hours>   (default 24)
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "4"), 1), 50);
  const windowHours = Math.min(Math.max(Number(searchParams.get("window") ?? "24"), 1), 168);

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

    // Midnight UTC cycle boundaries
    const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const nextMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);
    const msUntilNext = nextMidnight.getTime() - now.getTime();

    const tipHeight = await getTipHeight(prisma);

    const [btcPosts, ephPosts] = await Promise.all([
      prisma.post.findMany({
        where: {
          powDifficulty: { gt: 0 },
          createdAt: { gte: windowStart },
        },
        include: { burns: { select: { amount: true } } },
        orderBy: { powDifficulty: "desc" },
        take: limit,
      }),
      prisma.ephemeralPost.findMany({
        where: {
          powDifficulty: { gt: 0 },
          expiresAt: { gt: now },
          anchoredToBtc: true,
        },
        orderBy: { powDifficulty: "desc" },
        take: limit,
      }),
    ]);

    const entries: LeaderboardEntry[] = [];

    for (const p of btcPosts) {
      const mapped = mapPost(p, tipHeight);
      entries.push({
        type: "bitcoin",
        contentHash: p.contentHash,
        text: p.content,
        authorPubkey: p.authorPubkey,
        powDifficulty: p.powDifficulty,
        topic: p.topic,
        topicHash: p.topicHash,
        viewCount: p.viewCount,
        createdAt: p.createdAt.toISOString(),
        burnTotal: mapped.burnTotal,
      });
    }

    // Resolve topics for ephemeral replies by walking up the Bitcoin thread tree
    async function resolveTopicForHash(hash: string): Promise<{ topic: string | null; topicHash: string | null }> {
      let current = hash;
      for (let depth = 0; depth < 20; depth++) {
        const post = await prisma.post.findUnique({
          where: { contentHash: current },
          select: { topic: true, topicHash: true, parentHash: true },
        });
        if (!post) break;
        if (post.topic) return { topic: post.topic, topicHash: post.topicHash };
        if (!post.parentHash) break;
        current = post.parentHash;
      }
      return { topic: null, topicHash: null };
    }

    for (const ep of ephPosts) {
      let topic = ep.topic;
      let topicHash = ep.topicHash;
      if (!topic && ep.parentContentHash) {
        const resolved = await resolveTopicForHash(ep.parentContentHash);
        topic = resolved.topic;
        topicHash = resolved.topicHash;
      }
      entries.push({
        type: "ephemeral",
        nostrEventId: ep.nostrEventId,
        text: ep.content,
        authorPubkey: ep.nostrPubkey,
        powDifficulty: ep.powDifficulty,
        topic,
        topicHash,
        viewCount: 0,
        createdAt: ep.createdAt.toISOString(),
        upvoteWeight: ep.upvoteWeight.toString(),
      });
    }

    entries.sort((a, b) => b.powDifficulty - a.powDifficulty);
    const top = entries.slice(0, limit);

    return NextResponse.json({
      entries: top,
      windowStart: windowStart.toISOString(),
      windowEnd: now.toISOString(),
      nextCycleMs: msUntilNext,
      nextCycleAt: nextMidnight.toISOString(),
    });
  } catch (err) {
    log("error", "api/leaderboard", String(err));
    return errorResponse("Internal server error", 500);
  }
}
