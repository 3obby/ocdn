import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, errorResponse, log } from "@/lib/api-utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { schnorr } from "@noble/curves/secp256k1.js";
import { hexToBytes, bytesToHex } from "@noble/curves/utils.js";

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

  const minPoW = Number(process.env.NOSTR_MIN_POW_BOOST ?? "12");
  const powDifficulty = countLeadingZeroBits(event.id);
  if (powDifficulty < minPoW) {
    return errorResponse(`insufficient proof-of-work (need ≥${minPoW} bits, got ${powDifficulty})`);
  }

  const targetNostrId = event.tags.find((t) => t[0] === "e")?.[1] ?? null;
  const targetContentHash = event.tags.find((t) => t[0] === "ocdn-ref")?.[1] ?? null;

  if (!targetNostrId && !targetContentHash) {
    return errorResponse("boost must target a nostr event id or ocdn content hash");
  }

  const powWeight = BigInt(1) << BigInt(powDifficulty);

  try {
    // Dedup
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
      },
    });

    // Update accumulator, TTL, and best PoW on target ephemeral post
    let updatedPost: { upvoteWeight: bigint; expiresAt: Date; powDifficulty: number } | null = null;
    if (targetNostrId) {
      const target = await prisma.ephemeralPost.findUnique({
        where: { nostrEventId: targetNostrId },
      });
      if (target) {
        const BOOST_EXTENSION_MS = 30 * 60 * 1000;
        const baseDays = Number(process.env.EPHEMERAL_TTL_DAYS ?? "30");
        const maxTtlMs = Math.max(baseDays / Math.pow(2, target.replyDepth), 1) * 24 * 60 * 60 * 1000;
        const newExpiry = new Date(
          Math.min(target.expiresAt.getTime() + BOOST_EXTENSION_MS, target.createdAt.getTime() + maxTtlMs),
        );

        // Lazy recompute anchoredToBtc for pre-migration posts
        let anchorFix: { anchoredToBtc: true } | Record<string, never> = {};
        if (!target.anchoredToBtc) {
          let anchored = false;
          if (target.parentContentHash) {
            const btcParent = await prisma.post.findUnique({
              where: { contentHash: target.parentContentHash },
              select: { contentHash: true },
            });
            anchored = btcParent !== null;
          } else if (target.topicHash) {
            anchored = (await prisma.post.count({ where: { topicHash: target.topicHash } })) > 0;
          }
          if (anchored) anchorFix = { anchoredToBtc: true };
        }

        updatedPost = await prisma.ephemeralPost.update({
          where: { nostrEventId: targetNostrId },
          data: {
            upvoteWeight: { increment: powWeight },
            boostCount: { increment: 1 },
            lastBoostedAt: new Date(),
            expiresAt: newExpiry,
            ...(powDifficulty > target.powDifficulty ? { powDifficulty } : {}),
            ...anchorFix,
          },
          select: { upvoteWeight: true, expiresAt: true, powDifficulty: true },
        });
      }
    }

    // Update best PoW on target Bitcoin post + distribute to ephemeral children
    let updatedBitcoinPost: { powDifficulty: number } | null = null;
    let childrenBoosted = 0;
    if (targetContentHash) {
      const btcTarget = await prisma.post.findUnique({
        where: { contentHash: targetContentHash },
        select: { powDifficulty: true },
      });
      if (btcTarget && powDifficulty > btcTarget.powDifficulty) {
        updatedBitcoinPost = await prisma.post.update({
          where: { contentHash: targetContentHash },
          data: { powDifficulty },
          select: { powDifficulty: true },
        });
      }

      // Distribute PoW evenly to live ephemeral children (floor division)
      if (btcTarget) {
        const children = await prisma.ephemeralPost.findMany({
          where: { parentContentHash: targetContentHash, expiresAt: { gt: new Date() } },
          select: { nostrEventId: true, replyDepth: true, createdAt: true, expiresAt: true },
        });
        if (children.length > 0) {
          const share = powWeight / BigInt(children.length);
          if (share > 0n) {
            const baseDays = Number(process.env.EPHEMERAL_TTL_DAYS ?? "30");
            const BOOST_EXT_MS = 30 * 60 * 1000;
            const now = Date.now();
            for (const child of children) {
              const maxTtlMs = Math.max(baseDays / Math.pow(2, child.replyDepth), 1) * 24 * 60 * 60 * 1000;
              const newExpiry = new Date(
                Math.min(child.expiresAt.getTime() + BOOST_EXT_MS, child.createdAt.getTime() + maxTtlMs),
              );
              await prisma.ephemeralPost.update({
                where: { nostrEventId: child.nostrEventId },
                data: {
                  upvoteWeight: { increment: share },
                  boostCount: { increment: 1 },
                  lastBoostedAt: new Date(now),
                  expiresAt: newExpiry,
                },
              });
            }
            childrenBoosted = children.length;
          }
        }
      }
    }

    log("info", "api/ephemeral/boost", "boost recorded", {
      pow: powDifficulty,
      target: targetNostrId ?? targetContentHash,
      ...(childrenBoosted > 0 ? { childrenBoosted } : {}),
    });

    return NextResponse.json(
      {
        powDifficulty,
        powWeight: powWeight.toString(),
        upvoteWeight: updatedPost?.upvoteWeight?.toString() ?? null,
        expiresAt: updatedPost?.expiresAt?.toISOString() ?? null,
        targetPowDifficulty: updatedBitcoinPost?.powDifficulty ?? updatedPost?.powDifficulty ?? null,
        childrenBoosted,
      },
      { status: 201 },
    );
  } catch (err) {
    log("error", "api/ephemeral/boost", String(err));
    return errorResponse("Internal server error", 500);
  }
}
