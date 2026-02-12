import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PRESERVE_TIERS, type PreserveTier } from "@/lib/constants";

/**
 * POST /api/preserve — Accept a preservation bid (NIP-PRESERVE event).
 * Body: { contentHash, tier, maxPriceSats, escrowProof, eventId, funderPubkey }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { contentHash, tier, maxPriceSats, escrowProof, eventId, funderPubkey } = body;

  if (!contentHash || !tier || !maxPriceSats || !escrowProof || !eventId || !funderPubkey) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const tierConfig = PRESERVE_TIERS[tier as PreserveTier];
  if (!tierConfig && tier !== "custom") {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const config = tierConfig ?? { replicas: 3, jurisdictions: 1, durationEpochs: 180 };

  try {
    const order = await prisma.preserveOrder.create({
      data: {
        eventId,
        contentHash,
        funderPubkey,
        tier,
        replicas: config.replicas,
        jurisdictions: config.jurisdictions,
        durationEpochs: config.durationEpochs,
        maxPriceSats: BigInt(maxPriceSats),
        escrowProof,
      },
    });

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create preserve order", details: String(err) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/preserve?hash=<sha256> — Get active preserve orders for a content hash.
 */
export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("hash");
  if (!hash) {
    return NextResponse.json({ error: "hash parameter required" }, { status: 400 });
  }

  const orders = await prisma.preserveOrder.findMany({
    where: { contentHash: hash, status: "active" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      tier: o.tier,
      replicas: o.replicas,
      jurisdictions: o.jurisdictions,
      durationEpochs: o.durationEpochs,
      maxPriceSats: o.maxPriceSats.toString(),
      funderPubkey: o.funderPubkey,
    })),
    count: orders.length,
  });
}
