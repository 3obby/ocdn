import { prisma } from "@/lib/db";
import { LeaderboardFeed } from "@/components/leaderboard/Feed";
import { RefResolver } from "@/components/resolve/RefResolver";

export const dynamic = "force-dynamic";

export default async function Home() {
  const items = await prisma.importance.findMany({
    orderBy: { score: "desc" },
    take: 50,
    include: {
      pool: {
        select: {
          balance: true,
          funderCount: true,
        },
      },
    },
  });

  const feed = items.map((item) => ({
    hash: item.hash,
    score: item.score,
    commitment: item.commitment,
    demand: item.demand,
    centrality: item.centrality,
    label: item.label,
    poolBalance: item.pool.balance.toString(),
    funderCount: item.pool.funderCount,
    rank: 0, // set by Feed
  }));

  return (
    <div className="mx-auto max-w-4xl">
      {/* Hero / resolver */}
      <section className="px-4 py-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          The Importance Index
        </h1>
        <p className="mt-2 text-muted">
          Content ranked by economic commitment, demand, and structural
          centrality.
        </p>
        <div className="mt-6">
          <RefResolver />
        </div>
      </section>

      {/* Leaderboard */}
      <section className="border-t border-border">
        <div className="flex items-center justify-between px-4 py-3 text-sm text-muted">
          <span>Ranked by importance score</span>
          <span>{feed.length} documents</span>
        </div>
        <LeaderboardFeed items={feed} />
      </section>
    </div>
  );
}
