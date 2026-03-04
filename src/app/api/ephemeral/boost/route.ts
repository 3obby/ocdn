import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, errorResponse, log } from "@/lib/api-utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { schnorr } from "@noble/curves/secp256k1.js";
import { hexToBytes, bytesToHex } from "@noble/curves/utils.js";
import { POW, powWeight, equivalentZeros } from "@/lib/pow-config";

export const dynamic = "force-dynamic";

type NostrEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
};

function serializeEvent(e: Omit<NostrEvent, "id" | "sig">): string {
  return JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]);
}

function getEventId(e: Omit<NostrEvent, "id" | "sig">): string {
  return bytesToHex(sha256(new TextEncoder().encode(serializeEvent(e))));
}

function verifyNostrEvent(event: NostrEvent): boolean {
  try {
    if (getEventId(event) !== event.id) return false;
    return schnorr.verify(hexToBytes(event.sig), hexToBytes(event.id), hexToBytes(event.pubkey));
  } catch {
    return false;
  }
}

function countLeadingZeroBits(id: string): number {
  let bits = 0;
  for (let i = 0; i < id.length; i += 2) {
    const byte = parseInt(id.slice(i, i + 2), 16);
    if (byte === 0) {
      bits += 8;
    } else {
      for (let b = 7; b >= 0; b--) {
        if ((byte >> b) & 1) break;
        bits++;
      }
      break;
    }
  }
  return bits;
}

/**
 * POST /api/ephemeral/boost
 * Body: { signedEvent: NostrEvent }  — kind:7 reaction with NIP-13 PoW
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "write");
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const event = body.signedEvent as NostrEvent;
  if (!event || typeof event !== "object") return errorResponse("signedEvent is required");
  if (event.kind !== 7) return errorResponse("boost event kind must be 7");
  if (!event.id || !event.pubkey || !event.sig) return errorResponse("event missing required fields");

  if (!verifyNostrEvent(event)) return errorResponse("invalid event signature or id");

  const powDifficulty = countLeadingZeroBits(event.id);
  if (powDifficulty < POW.MIN_BOOST) {
    return errorResponse(`insufficient proof-of-work (need ≥${POW.MIN_BOOST} bits, got ${powDifficulty})`);
  }

  const targetNostrId = event.tags.find((t) => t[0] === "e")?.[1] ?? null;
  const targetContentHash = event.tags.find((t) => t[0] === "ocdn-ref")?.[1] ?? null;

  if (!targetNostrId && !targetContentHash) {
    return errorResponse("boost must target a nostr event id or content hash");
  }

  const weight = powWeight(powDifficulty);

  try {
    const existing = await prisma.nostrBoost.findUnique({ where: { nostrEventId: event.id } });
    if (existing) {
      return NextResponse.json({ duplicate: true, powDifficulty: existing.powDifficulty });
    }

    await prisma.nostrBoost.create({
      data: {
        nostrEventId: event.id,
        nostrPubkey: event.pubkey,
        targetNostrId,
        targetContentHash,
        powDifficulty,
        rawEvent: event as object,
      },
    });

    let resultWeight: bigint | null = null;

    if (targetNostrId) {
      const target = await prisma.ephemeralPost.findUnique({
        where: { nostrEventId: targetNostrId },
      });
      if (target) {
        const baseDays = Number(process.env.EPHEMERAL_TTL_DAYS ?? "30");
        const maxTtlMs = Math.max(baseDays / Math.pow(2, target.replyDepth), 1) * 24 * 60 * 60 * 1000;
        const newExpiry = new Date(
          Math.min(
            target.expiresAt.getTime() + POW.BOOST_TTL_EXTENSION_MS,
            target.createdAt.getTime() + maxTtlMs,
          ),
        );

        const updated = await prisma.ephemeralPost.update({
          where: { nostrEventId: targetNostrId },
          data: {
            upvoteWeight: { increment: weight },
            boostCount: { increment: 1 },
            lastBoostedAt: new Date(),
            expiresAt: newExpiry,
          },
          select: { upvoteWeight: true },
        });
        resultWeight = updated.upvoteWeight;
      }
    }

    if (targetContentHash) {
      const btcPost = await prisma.post.findUnique({
        where: { contentHash: targetContentHash },
        select: { contentHash: true },
      });
      if (btcPost) {
        const updated = await prisma.post.update({
          where: { contentHash: targetContentHash },
          data: {
            workWeight: { increment: weight },
            boostCount: { increment: 1 },
          },
          select: { workWeight: true },
        });
        resultWeight = updated.workWeight;
      }
    }

    log("info", "api/ephemeral/boost", "boost recorded", {
      pow: powDifficulty,
      target: targetNostrId ?? targetContentHash,
    });

    return NextResponse.json(
      {
        powDifficulty,
        powWeight: weight.toString(),
        upvoteWeight: resultWeight?.toString() ?? null,
        equivalentZeros: resultWeight != null ? equivalentZeros(resultWeight) : powDifficulty,
      },
      { status: 201 },
    );
  } catch (err) {
    log("error", "api/ephemeral/boost", String(err));
    return errorResponse("Internal server error", 500);
  }
}
