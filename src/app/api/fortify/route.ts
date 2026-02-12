import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { netAfterRoyalty } from "@/lib/royalty";

/**
 * POST /api/fortify — Accept a pool credit (NIP-POOL event + payment proof).
 * Body: { contentHash, sats, proof, eventId, funderPubkey }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { contentHash, sats, proof, eventId, funderPubkey } = body;

  if (!contentHash || !sats || !proof || !eventId || !funderPubkey) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const satsBig = BigInt(sats);

  // Get cumulative volume for royalty
  const cumVol = await prisma.pool.aggregate({ _sum: { totalFunded: true } });
  const net = netAfterRoyalty(satsBig, cumVol._sum.totalFunded ?? 0n);

  try {
    await prisma.$transaction([
      prisma.pool.upsert({
        where: { hash: contentHash },
        update: {
          balance: { increment: net },
          totalFunded: { increment: satsBig },
          funderCount: { increment: 1 },
        },
        create: {
          hash: contentHash,
          balance: net,
          totalFunded: satsBig,
          funderCount: 1,
        },
      }),
      prisma.poolFunder.create({
        data: {
          poolHash: contentHash,
          pubkey: funderPubkey,
          sats: satsBig,
          eventId,
        },
      }),
    ]);

    const pool = await prisma.pool.findUnique({ where: { hash: contentHash } });

    return NextResponse.json({
      success: true,
      balance: pool?.balance.toString(),
      funderCount: pool?.funderCount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to process fortify", details: String(err) },
      { status: 500 }
    );
  }
}
