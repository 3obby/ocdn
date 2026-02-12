import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { epochRewardCap, sustainabilityRatio } from "@/lib/pool";
import { AUTO_BID_PCT } from "@/lib/constants";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params;

  const pool = await prisma.pool.findUnique({
    where: { hash },
    include: {
      funders: {
        orderBy: { sats: "desc" },
        take: 50,
        select: { pubkey: true, sats: true },
      },
      _count: { select: { receipts: true } },
    },
  });

  if (!pool) {
    return NextResponse.json(
      { hash, balance: 0, funderCount: 0, status: "not_indexed" },
      { status: 404 }
    );
  }

  const drainPerEpoch = epochRewardCap(pool.balance);

  // Estimate auto-bid income from recent receipts
  const recentReceipts = await prisma.receipt.aggregate({
    where: { contentHash: hash },
    _sum: { priceSats: true },
    _count: true,
  });
  const autoBidIncome = BigInt(
    Math.floor(Number(recentReceipts._sum.priceSats ?? 0n) * AUTO_BID_PCT)
  );

  const sustainability = sustainabilityRatio(autoBidIncome, drainPerEpoch);

  return NextResponse.json({
    hash,
    balance: pool.balance.toString(),
    totalFunded: pool.totalFunded.toString(),
    funderCount: pool.funderCount,
    drainPerEpoch: drainPerEpoch.toString(),
    receiptCount: pool._count.receipts,
    sustainabilityRatio: sustainability,
    topFunders: pool.funders.map((f) => ({
      pubkey: f.pubkey,
      sats: f.sats.toString(),
    })),
  });
}
