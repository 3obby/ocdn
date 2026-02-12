import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/push — Register new content in the index.
 * Body: { hash, fileName?, fileType?, fileSize?, uploadedBy? }
 *
 * Creates a pool entry with zero balance, an importance row for leaderboard
 * visibility, and a ContentMeta row with file metadata + pending status.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { hash, fileName, fileType, fileSize, uploadedBy } = body;

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

    // Upsert importance row so it shows on the leaderboard
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

    // Upsert content metadata — preserve existing if already there
    await prisma.contentMeta.upsert({
      where: { hash },
      update: {
        // Only fill in missing fields, don't overwrite existing
        ...(fileName ? { fileName } : {}),
        ...(fileType ? { fileType } : {}),
        ...(fileSize ? { fileSize } : {}),
        ...(uploadedBy ? { uploadedBy } : {}),
      },
      create: {
        hash,
        fileName: fileName ?? null,
        fileType: fileType ?? null,
        fileSize: fileSize ?? null,
        uploadedBy: uploadedBy ?? null,
        status: "pending",
      },
    });

    return NextResponse.json({
      success: true,
      hash,
      balance: pool.balance.toString(),
      funderCount: pool.funderCount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to register content", details: String(err) },
      { status: 500 }
    );
  }
}
