import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, validateContent, errorResponse, log } from "@/lib/api-utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { schnorr } from "@noble/curves/secp256k1.js";
import { hexToBytes, bytesToHex } from "@noble/curves/utils.js";

export const dynamic = "force-dynamic";

// ── Types ──────────────────────────────────────────────────────────────────────

type NostrEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function serializeEvent(e: Omit<NostrEvent, "id" | "sig">): string {
  return JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]);
}

function getEventId(e: Omit<NostrEvent, "id" | "sig">): string {
  const bytes = sha256(new TextEncoder().encode(serializeEvent(e)));
  return bytesToHex(bytes);
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

function verifyNostrEvent(event: NostrEvent): boolean {
  try {
    // Verify event ID
    const expectedId = getEventId(event);
    if (expectedId !== event.id) return false;
    // Verify Schnorr signature
    return schnorr.verify(hexToBytes(event.sig), hexToBytes(event.id), hexToBytes(event.pubkey));
  } catch {
    return false;
  }
}

function getNonceTag(tags: string[][]): string[] | null {
  return tags.find((t) => t[0] === "nonce") ?? null;
}

function getTtlMs(replyDepth: number): number {
  const baseDays = Number(process.env.EPHEMERAL_TTL_DAYS ?? "30");
  const days = baseDays / Math.pow(2, replyDepth);
  return Math.max(days, 1) * 24 * 60 * 60 * 1000;
}

function getTagValue(tags: string[][], name: string): string | null {
  return tags.find((t) => t[0] === name)?.[1] ?? null;
}

// ── Handler ────────────────────────────────────────────────────────────────────

/**
 * POST /api/ephemeral/publish
 * Body: { signedEvent: NostrEvent }
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
  if (event.kind !== 1) return errorResponse("event kind must be 1");

  // Validate structure
  if (!event.id || !event.pubkey || !event.sig || !event.content) {
    return errorResponse("event missing required fields");
  }

  // Content validation
  const contentResult = validateContent(event.content);
  if (!contentResult.ok) return errorResponse(contentResult.error);

  // Verify signature + ID
  if (!verifyNostrEvent(event)) {
    return errorResponse("invalid event signature or id");
  }

  // Verify PoW difficulty
  const minPoW = Number(process.env.NOSTR_MIN_POW_POST ?? "8");
  const powDifficulty = countLeadingZeroBits(event.id);
  const nonceTag = getNonceTag(event.tags);

  if (!nonceTag || powDifficulty < minPoW) {
    return errorResponse(`insufficient proof-of-work (need ≥${minPoW} bits, got ${powDifficulty})`);
  }

  // Extract OCDN metadata from tags
  const tTags = event.tags.filter((t) => t[0] === "t");
  const hasProtocol = tTags.some((t) => t[1] === "ocdn");
  let topic: string | null = null;
  if (hasProtocol) {
    const nonOcdnTopic = tTags.find((t) => t[1] !== "ocdn")?.[1] ?? null;
    if (nonOcdnTopic) {
      topic = nonOcdnTopic;
    } else if (tTags.filter((t) => t[1] === "ocdn").length > 1) {
      topic = "ocdn";
    }
  }
  let parentContentHash = getTagValue(event.tags, "ocdn-ref");
  const parentNostrId = event.tags.find((t) => t[0] === "e" && t[3] === "reply")?.[1] ?? null;

  // Compute topic hash if topic exists (normalize for consistent matching)
  let topicHash: string | null = null;
  if (topic) {
    try {
      const { topicHash: computeTopicHash } = await import("@/lib/protocol/crypto");
      const normalized = topic.toLowerCase().trim().normalize("NFC");
      topicHash = bytesToHex(computeTopicHash(normalized));
    } catch {}
  }

  // Resolve topic from parent Bitcoin post if not set directly
  if (!topic && parentContentHash) {
    let currentHash = parentContentHash;
    for (let depth = 0; depth < 20; depth++) {
      const row: { topic: string | null; topicHash: string | null; parentHash: string | null } | null =
        await prisma.post.findUnique({
          where: { contentHash: currentHash },
          select: { topic: true, topicHash: true, parentHash: true },
        });
      if (!row) break;
      if (row.topic) {
        topic = row.topic;
        topicHash = row.topicHash;
        break;
      }
      if (!row.parentHash) break;
      currentHash = row.parentHash;
    }
  }

  // Compute reply depth: 0 for root / direct BTC reply, parent.replyDepth+1 for ephemeral chains
  // Also inherit parentContentHash from parent ephemeral so the whole subtree
  // stays anchored to the same BTC post for retrieval.
  let replyDepth = 0;
  if (parentNostrId) {
    const parentEph = await prisma.ephemeralPost.findUnique({
      where: { nostrEventId: parentNostrId },
      select: { replyDepth: true, parentContentHash: true, topicHash: true, topic: true },
    });
    if (parentEph) {
      replyDepth = parentEph.replyDepth + 1;
      if (!parentContentHash && parentEph.parentContentHash) {
        parentContentHash = parentEph.parentContentHash;
      }
      if (!topic && parentEph.topic) {
        topic = parentEph.topic;
        topicHash = parentEph.topicHash;
      }
    }
  }

  // Compute anchoredToBtc: true if parent is a Bitcoin post or topic exists on-chain
  let anchoredToBtc = false;
  if (parentContentHash) {
    const btcParent = await prisma.post.findUnique({
      where: { contentHash: parentContentHash },
      select: { contentHash: true },
    });
    anchoredToBtc = btcParent !== null;
  } else if (topicHash) {
    const btcTopicCount = await prisma.post.count({ where: { topicHash } });
    anchoredToBtc = btcTopicCount > 0;
  }

  const expiresAt = new Date(Date.now() + getTtlMs(replyDepth));

  try {
    // Dedup by event ID
    const existing = await prisma.ephemeralPost.findUnique({
      where: { nostrEventId: event.id },
    });
    if (existing) {
      return NextResponse.json({
        nostrEventId: existing.nostrEventId,
        expiresAt: existing.expiresAt.toISOString(),
        powDifficulty: existing.powDifficulty,
        duplicate: true,
      });
    }

    const record = await prisma.ephemeralPost.create({
      data: {
        nostrEventId: event.id,
        nostrPubkey: event.pubkey,
        content: event.content,
        topic,
        topicHash,
        parentContentHash,
        parentNostrId,
        replyDepth,
        anchoredToBtc,
        powDifficulty,
        upvoteWeight: BigInt(0),
        rawEvent: event as object,
        expiresAt,
      },
    });

    log("info", "api/ephemeral/publish", "ephemeral post stored", {
      id: event.id,
      pow: powDifficulty,
    });

    // Fire-and-forget relay broadcast (server-side, best effort)
    broadcastToRelays(event).catch(() => {});

    return NextResponse.json(
      {
        nostrEventId: record.nostrEventId,
        expiresAt: record.expiresAt.toISOString(),
        powDifficulty,
      },
      { status: 201 },
    );
  } catch (err) {
    log("error", "api/ephemeral/publish", String(err));
    return errorResponse("Internal server error", 500);
  }
}

async function broadcastToRelays(event: NostrEvent) {
  const relayUrls = (process.env.NOSTR_RELAYS ?? "wss://relay.damus.io,wss://nos.lol")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const results = await Promise.allSettled(
    relayUrls.map((url) =>
      new Promise<void>((resolve) => {
        // Use native WebSocket in Node.js 22+ or ws in older
        try {
          const ws = new (globalThis.WebSocket ?? require("ws"))(url);
          const timer = setTimeout(() => { try { ws.close(); } catch {} resolve(); }, 3000);
          ws.onopen = () => ws.send(JSON.stringify(["EVENT", event]));
          ws.onmessage = () => { clearTimeout(timer); ws.close(); resolve(); };
          ws.onerror = () => { clearTimeout(timer); resolve(); };
        } catch { resolve(); }
      }),
    ),
  );
  log("info", "api/ephemeral/publish", "relay broadcast", {
    results: results.map((r) => r.status),
  });
}
