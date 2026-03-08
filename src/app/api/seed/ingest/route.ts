import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWriteAuth, errorResponse, log } from "@/lib/api-utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { schnorr } from "@noble/curves/secp256k1.js";
import { hexToBytes, bytesToHex } from "@noble/curves/utils.js";
import { topicHash as computeTopicHash } from "@/lib/protocol/crypto";

export const dynamic = "force-dynamic";

// ── Nostr event helpers ─────────────────────────────────────────────────────

type NostrEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
};

function makeEvent(
  privkeyHex: string,
  content: string,
  tags: string[][],
  createdAt: number,
): NostrEvent {
  const privkey = hexToBytes(privkeyHex);
  const pubkey = bytesToHex(schnorr.getPublicKey(privkey));
  const unsigned = { pubkey, created_at: createdAt, kind: 1, tags, content };
  const serialized = JSON.stringify([0, unsigned.pubkey, unsigned.created_at, unsigned.kind, unsigned.tags, unsigned.content]);
  const id = bytesToHex(sha256(new TextEncoder().encode(serialized)));
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), privkey));
  return { ...unsigned, id, sig };
}

// ── TTL (mirrors publish logic) ─────────────────────────────────────────────

function getTtlMs(replyDepth: number): number {
  const baseDays = Number(process.env.EPHEMERAL_TTL_DAYS ?? "30");
  const days = baseDays / Math.pow(2, replyDepth);
  return Math.max(days, 1) * 24 * 60 * 60 * 1000;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface IngestReply {
  content: string;
  sourceId?: string;
  sourceTs?: number;
  parentSourceId?: string;
  upvoteWeight?: number;
}

interface IngestItem {
  topic?: string | null;
  content: string;
  sourceId?: string;
  sourceTs?: number;
  replies?: IngestReply[];
  upvoteWeight?: number;
}

interface InsertedEntry {
  nostrEventId: string;
  expiresAt: Date;
  replyDepth: number;
}

// ── Handler ─────────────────────────────────────────────────────────────────

/**
 * POST /api/seed/ingest
 * Headers: x-api-key
 * Body: { items: IngestItem[] }
 *
 * Ingests external content (e.g. scraped 4chan threads) as ephemeral posts.
 * Signs Nostr events server-side with SEED_NOSTR_PRIVKEY.
 * Inserts parent-first; child expiresAt is capped at parent's expiresAt.
 * Supports parentSourceId on replies for proper nested threading.
 */
export async function POST(request: Request) {
  const authErr = requireWriteAuth(request);
  if (authErr) return authErr;

  const seedKey = process.env.SEED_NOSTR_PRIVKEY;
  if (!seedKey || seedKey.length !== 64) {
    return errorResponse("SEED_NOSTR_PRIVKEY not configured (need 64-char hex)", 500);
  }

  let body: { items?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return errorResponse("items array is required and must be non-empty");
  }
  if (body.items.length > 500) {
    return errorResponse("max 500 items per request");
  }

  const items = body.items as IngestItem[];
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of items) {
    if (!item.content || typeof item.content !== "string" || item.content.trim().length === 0) {
      errors++;
      continue;
    }

    const topic = typeof item.topic === "string" && item.topic.trim() ? item.topic.trim() : null;
    const content = item.content.trim();
    const now = Math.floor(Date.now() / 1000);
    const createdAt = item.sourceTs ?? now;

    const tags: string[][] = [["t", "ocdn"]];
    if (topic) tags.push(["t", topic]);
    if (item.sourceId) tags.push(["source", item.sourceId]);

    let tHash: string | null = null;
    if (topic) {
      const normalized = topic.toLowerCase().trim().normalize("NFC");
      tHash = bytesToHex(computeTopicHash(normalized));
    }

    const event = makeEvent(seedKey, content, tags, createdAt);

    // sourceId → inserted entry map for resolving parentSourceId within this item
    const sourceMap = new Map<string, InsertedEntry>();

    // Insert root post (upsert: update weight on re-ingest)
    const rootExpires = new Date(Date.now() + getTtlMs(0));
    const rootWeight = BigInt(item.upvoteWeight ?? 1);
    let rootId: string;
    try {
      const existing = await prisma.ephemeralPost.findUnique({
        where: { nostrEventId: event.id },
        select: { nostrEventId: true, upvoteWeight: true, topicHash: true },
      });
      if (existing) {
        const updates: Record<string, unknown> = {};
        if (rootWeight > 1n && rootWeight !== existing.upvoteWeight) {
          updates.upvoteWeight = rootWeight;
        }
        if (tHash && existing.topicHash !== tHash) {
          updates.topic = topic;
          updates.topicHash = tHash;
        }
        if (Object.keys(updates).length > 0) {
          await prisma.ephemeralPost.update({
            where: { nostrEventId: existing.nostrEventId },
            data: updates,
          });
        }
        skipped++;
        rootId = existing.nostrEventId;
      } else {
        const record = await prisma.ephemeralPost.create({
          data: {
            nostrEventId: event.id,
            nostrPubkey: event.pubkey,
            content,
            topic,
            topicHash: tHash,
            parentContentHash: null,
            parentNostrId: null,
            replyDepth: 0,
            anchoredToBtc: false,
            powDifficulty: 0,
            upvoteWeight: rootWeight,
            rawEvent: event as object,
            expiresAt: rootExpires,
          },
        });
        rootId = record.nostrEventId;
        inserted++;
      }
    } catch (err) {
      log("error", "api/seed/ingest", `root insert failed: ${err}`);
      errors++;
      continue;
    }

    if (item.sourceId) {
      sourceMap.set(item.sourceId, { nostrEventId: rootId, expiresAt: rootExpires, replyDepth: 0 });
    }

    // Insert replies — process in order so earlier replies are in sourceMap for later ones
    if (Array.isArray(item.replies)) {
      for (let i = 0; i < item.replies.length; i++) {
        const reply = item.replies[i];
        if (!reply.content || typeof reply.content !== "string" || reply.content.trim().length === 0) {
          errors++;
          continue;
        }

        // Resolve parent: look up parentSourceId in map, fall back to root
        let parentNostrId = rootId;
        let parentExpires = rootExpires;
        let parentDepth = 0;

        if (reply.parentSourceId && sourceMap.has(reply.parentSourceId)) {
          const parent = sourceMap.get(reply.parentSourceId)!;
          parentNostrId = parent.nostrEventId;
          parentExpires = parent.expiresAt;
          parentDepth = parent.replyDepth;
        }

        const replyDepth = parentDepth + 1;
        const replyContent = reply.content.trim();
        const replyTs = reply.sourceTs ?? (createdAt + i + 1);
        const replyTags: string[][] = [
          ["t", "ocdn"],
          ["e", parentNostrId, "", "reply"],
        ];
        if (topic) replyTags.push(["t", topic]);
        if (reply.sourceId) replyTags.push(["source", reply.sourceId]);

        const replyEvent = makeEvent(seedKey, replyContent, replyTags, replyTs);

        let replyExpires = new Date(Date.now() + getTtlMs(replyDepth));
        if (replyExpires > parentExpires) replyExpires = parentExpires;

        const replyWeight = BigInt(reply.upvoteWeight ?? 1);
        try {
          const existing = await prisma.ephemeralPost.findUnique({
            where: { nostrEventId: replyEvent.id },
            select: { nostrEventId: true, upvoteWeight: true, topicHash: true },
          });
          if (existing) {
            const updates: Record<string, unknown> = {};
            if (replyWeight > 1n && replyWeight !== existing.upvoteWeight) {
              updates.upvoteWeight = replyWeight;
            }
            if (tHash && existing.topicHash !== tHash) {
              updates.topic = topic;
              updates.topicHash = tHash;
            }
            if (Object.keys(updates).length > 0) {
              await prisma.ephemeralPost.update({
                where: { nostrEventId: existing.nostrEventId },
                data: updates,
              });
            }
            skipped++;
            if (reply.sourceId) {
              sourceMap.set(reply.sourceId, { nostrEventId: existing.nostrEventId, expiresAt: replyExpires, replyDepth });
            }
            continue;
          }
          const record = await prisma.ephemeralPost.create({
            data: {
              nostrEventId: replyEvent.id,
              nostrPubkey: replyEvent.pubkey,
              content: replyContent,
              topic,
              topicHash: tHash,
              parentContentHash: null,
              parentNostrId: parentNostrId,
              replyDepth,
              anchoredToBtc: false,
              powDifficulty: 0,
              upvoteWeight: replyWeight,
              rawEvent: replyEvent as object,
              expiresAt: replyExpires,
            },
          });
          if (reply.sourceId) {
            sourceMap.set(reply.sourceId, { nostrEventId: record.nostrEventId, expiresAt: replyExpires, replyDepth });
          }
          inserted++;
        } catch (err) {
          log("error", "api/seed/ingest", `reply insert failed: ${err}`);
          errors++;
        }
      }
    }
  }

  log("info", "api/seed/ingest", "batch complete", { inserted, skipped, errors });

  return NextResponse.json({ inserted, skipped, errors }, { status: inserted > 0 ? 201 : 200 });
}
