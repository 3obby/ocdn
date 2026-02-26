import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, errorResponse, log, bigintToNumber } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/topics
 *
 * Paginated topic list for the search dropdown.
 * Query params:
 *   q=<query>       search by topic name (case-insensitive contains)
 *   offset=<n>      pagination offset (default 0)
 *   limit=<n>       page size (default 30, max 100)
 *
 * Returns:
 *   topics[]        OCDN topics ranked by totalBurned
 *   external[]      external protocol entries (EW, etc.)
 *   hasMore         whether more topics exist beyond this page
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0") || 0);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "30") || 30));

  try {
    const where = q
      ? { topicName: { contains: q, mode: "insensitive" as const } }
      : {};

    const qLower = q.toLowerCase();
    const ewMatches =
      !q ||
      "eternitywall".includes(qLower) ||
      "ew".startsWith(qLower);

    const [topicsRaw, ewCount, ewBurnAgg] = await Promise.all([
      prisma.topicAggregate.findMany({
        where,
        orderBy: { totalBurned: "desc" },
        skip: offset,
        take: limit + 1,
        select: {
          topicHash: true,
          topicName: true,
          totalBurned: true,
          postCount: true,
        },
      }),
      ewMatches
        ? prisma.post.count({ where: { protocol: "ew" } })
        : Promise.resolve(0),
      ewMatches
        ? prisma.burn.aggregate({
            where: { post: { protocol: "ew" } },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null as bigint | null } }),
    ]);

    const hasMore = topicsRaw.length > limit;
    const page = hasMore ? topicsRaw.slice(0, limit) : topicsRaw;

    const external: Array<{
      protocol: string;
      label: string;
      postCount: number;
      totalBurned: number;
    }> = [];

    if (ewMatches && ewCount > 0) {
      external.push({
        protocol: "ew",
        label: "EternityWall",
        postCount: ewCount,
        totalBurned: bigintToNumber(ewBurnAgg._sum.amount ?? 0n),
      });
    }

    return NextResponse.json({
      topics: page.map((t) => ({
        hash: t.topicHash,
        name: t.topicName,
        totalBurned: bigintToNumber(t.totalBurned),
        postCount: t.postCount,
      })),
      external,
      hasMore,
    });
  } catch (err) {
    log("error", "api/topics", "topics query failed", { error: String(err) });
    return errorResponse("Internal server error", 500);
  }
}
