import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { netAfterRoyalty } from "@/lib/royalty";
import { publishEvent } from "@/lib/nostr/relay";
import { type NostrEvent } from "@/lib/nostr/types";

/**
 * POST /api/fortify — Accept a pool credit (NIP-POOL event + payment proof).
 * Body: { contentHash, sats, proof, eventId, funderPubkey, signedEvent? }
 *
 * If signedEvent is provided, publishes it to configured Nostr relays
 * so the broader ecosystem can see the funding activity.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { contentHash, sats, proof, eventId, funderPubkey, signedEvent } = body;

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

    // Publish signed event to Nostr relays (non-blocking)
    if (signedEvent && signedEvent.id && signedEvent.sig) {
      publishEvent(signedEvent as NostrEvent).catch((err) => {
        console.error("[fortify] Failed to publish to relays:", err);
      });
    }

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
