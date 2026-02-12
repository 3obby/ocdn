import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/resolve/<input> — Ref resolver.
 * Input can be: sha256 hash, blossom URL, nostr event ID.
 * Returns importance data or "not indexed" status.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ input: string }> }
) {
  const { input } = await params;
  let hash = input;

  // Try to extract SHA256 from Blossom URL pattern
  const blossomMatch = input.match(/\/([0-9a-f]{64})(?:\.\w+)?$/);
  if (blossomMatch) {
    hash = blossomMatch[1];
  }

  // Validate as hex64
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    // Try as nostr event ID — look up the "r" tag
    const event = await prisma.nostrEvent.findUnique({
      where: { id: input },
    });
    if (event) {
      const tags = event.tags as string[][];
      const rTag = tags.find((t: string[]) => t[0] === "r");
      if (rTag) hash = rTag[1];
    }
  }

  if (!/^[0-9a-f]{64}$/.test(hash)) {
    return NextResponse.json(
      { error: "Could not resolve to a valid content hash" },
      { status: 400 }
    );
  }

  // Look up pool + importance
  const pool = await prisma.pool.findUnique({
    where: { hash },
    select: { balance: true, funderCount: true, totalFunded: true },
  });

  const importance = await prisma.importance.findUnique({
    where: { hash },
  });

  if (!pool && !importance) {
    return NextResponse.json({
      hash,
      status: "not_indexed",
      message: "Not indexed — be the first to Fortify.",
    });
  }

  return NextResponse.json({
    hash,
    status: pool ? "indexed" : "not_indexed",
    pool: pool
      ? {
          balance: pool.balance.toString(),
          funderCount: pool.funderCount,
          totalFunded: pool.totalFunded.toString(),
        }
      : null,
    importance: importance
      ? {
          commitment: importance.commitment,
          demand: importance.demand,
          centrality: importance.centrality,
          score: importance.score,
          label: importance.label,
        }
      : null,
  });
}
