import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/push — Register new content in the index.
 * Body: { hash, fileName?, fileType?, fileSize? }
 *
 * Creates a pool entry with zero balance so the content is "indexed"
 * and visible on /v/{hash}. Caller can immediately Fortify after.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { hash, fileName, fileType, fileSize } = body;

  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) {
    return NextResponse.json(
      { error: "Invalid content hash" },
      { status: 400 }
    );
  }

  try {
    // Upsert pool — if it already exists, this is a no-op
    const pool = await prisma.pool.upsert({
      where: { hash },
      update: {},
      create: {
        hash,
        balance: 0n,
        totalFunded: 0n,
        funderCount: 0,
      },
    });

    // Also upsert a minimal importance row so it shows on the leaderboard
    await prisma.importance.upsert({
      where: { hash },
      update: {},
      create: {
        hash,
        commitment: 0,
        demand: 0,
        centrality: 0,
        score: 0,
        label: null,
        epoch: 0,
      },
    });

    return NextResponse.json({
      success: true,
      hash,
      balance: pool.balance.toString(),
      funderCount: pool.funderCount,
      meta: { fileName, fileType, fileSize },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to register content", details: String(err) },
      { status: 500 }
    );
  }
}
