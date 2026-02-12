import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const offset = Number(searchParams.get("offset") ?? 0);
  const label = searchParams.get("label"); // filter by divergence label

  const where = label ? { label } : {};

  const items = await prisma.importance.findMany({
    where,
    orderBy: { score: "desc" },
    take: limit,
    skip: offset,
    include: {
      pool: {
        select: {
          balance: true,
          funderCount: true,
          totalFunded: true,
        },
      },
    },
  });

  const total = await prisma.importance.count({ where });

  return NextResponse.json({
    items: items.map((i) => ({
      hash: i.hash,
      commitment: i.commitment,
      demand: i.demand,
      centrality: i.centrality,
      score: i.score,
      label: i.label,
      poolBalance: i.pool.balance.toString(),
      funderCount: i.pool.funderCount,
    })),
    total,
    limit,
    offset,
  });
}
