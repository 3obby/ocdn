import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/stats — Live header stats: doc count, total sats, unique hosts.
 */
export async function GET() {
  try {
    const [docCount, satsAgg, hostCount] = await Promise.all([
      prisma.pool.count(),
      prisma.pool.aggregate({ _sum: { balance: true } }),
      prisma.receipt
        .findMany({
          select: { hostPubkey: true },
          distinct: ["hostPubkey"],
        })
        .then((r) => r.length),
    ]);

    return NextResponse.json({
      docCount,
      totalSats: (satsAgg._sum.balance ?? 0n).toString(),
      hostCount,
    });
  } catch {
    return NextResponse.json(
      { docCount: 0, totalSats: "0", hostCount: 0 },
      { status: 200 }
    );
  }
}
