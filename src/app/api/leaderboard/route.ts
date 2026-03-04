import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, errorResponse, log } from "@/lib/api-utils";
import { equivalentZeros } from "@/lib/pow-config";

export const dynamic = "force-dynamic";

type LeaderboardEntry = {
  type: "ephemeral";
  nostrEventId: string;
  text: string;
  authorPubkey: string;
  powDifficulty: number;
  equivalentZeros: number;
  topic?: string | null;
  topicHash?: string | null;
  createdAt: string;
  upvoteWeight?: string;
};

/**
 * GET /api/leaderboard
 *
 * Returns top-N nostr posts ranked by powDifficulty within the current 24h window.
 *
 * Query params:
 *   limit=<number>   (default 4, max 50)
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

    const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const nextMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);
    const msUntilNext = nextMidnight.getTime() - now.getTime();

    const ephPosts = await prisma.ephemeralPost.findMany({
      where: {
        upvoteWeight: { gt: 0 },
        expiresAt: { gt: now },
        createdAt: { gte: windowStart },
      },
      orderBy: { upvoteWeight: "desc" },
      take: limit,
    });

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

    const entries: LeaderboardEntry[] = [];
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
        equivalentZeros: equivalentZeros(ep.upvoteWeight),
        topic,
        topicHash,
        createdAt: ep.createdAt.toISOString(),
        upvoteWeight: ep.upvoteWeight.toString(),
      });
    }

    return NextResponse.json({
      entries,
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
