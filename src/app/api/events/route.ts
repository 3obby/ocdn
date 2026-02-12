import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const kind = searchParams.get("kind") ? Number(searchParams.get("kind")) : undefined;
  const pubkey = searchParams.get("pubkey") ?? undefined;
  const contentHash = searchParams.get("hash") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const since = searchParams.get("since") ? Number(searchParams.get("since")) : undefined;

  const where: Record<string, unknown> = {};
  if (kind) where.kind = kind;
  if (pubkey) where.pubkey = pubkey;
  if (since) where.createdAt = { gte: since };
  if (contentHash) {
    where.tags = { path: "$", array_contains: [["r", contentHash]] };
  }

  const events = await prisma.nostrEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ events, count: events.length });
}
