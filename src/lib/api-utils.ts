import { NextResponse } from "next/server";
import type { Post as PrismaPost } from "@/generated/prisma/client";
import type { Post as FrontendPost, Topic } from "./mock-data";

// ═══ BIGINT SERIALIZATION ═══

export function bigintToNumber(v: bigint): number {
  if (v <= Number.MAX_SAFE_INTEGER && v >= Number.MIN_SAFE_INTEGER) return Number(v);
  return Number(v);
}

// ═══ DB → FRONTEND TYPE MAPPERS ═══

export function mapPost(
  p: PrismaPost & { burns?: { amount: bigint }[] },
  tipHeight: number,
): FrontendPost {
  const burnTotal = p.burns
    ? p.burns.reduce((sum, b) => sum + bigintToNumber(b.amount), 0)
    : 0;

  return {
    id: p.contentHash,
    contentHash: p.contentHash,
    protocol: p.protocol,
    authorPubkey: p.authorPubkey,
    text: p.content,
    topicHash: p.topicHash,
    topicName: p.topic,
    parentId: p.parentHash,
    burnTotal,
    timestamp: p.createdAt.getTime(),
    blockHeight: p.blockHeight,
    confirmations: Math.max(0, tipHeight - p.blockHeight + 1),
  };
}

export function mapTopic(t: { topicHash: string; topicName: string | null; totalBurned: bigint }): Topic {
  return {
    hash: t.topicHash,
    name: t.topicName,
    totalBurned: bigintToNumber(t.totalBurned),
  };
}

// ═══ TIP HEIGHT CACHE ═══

let _tipHeightCache: { height: number; ts: number } | null = null;
const TIP_CACHE_TTL = 10_000;

export async function getTipHeight(prisma: { indexerState: { findFirst: (args?: object) => Promise<{ chainTipHeight: number } | null> } }): Promise<number> {
  if (_tipHeightCache && Date.now() - _tipHeightCache.ts < TIP_CACHE_TTL) {
    return _tipHeightCache.height;
  }
  const state = await prisma.indexerState.findFirst();
  const height = state?.chainTipHeight ?? 0;
  _tipHeightCache = { height, ts: Date.now() };
  return height;
}

// ═══ RATE LIMITER ═══

interface RateBucket {
  count: number;
  resetAt: number;
}

const readBuckets = new Map<string, RateBucket>();
const writeBuckets = new Map<string, RateBucket>();

const READ_LIMIT = 60;
const WRITE_LIMIT = 10;
const WINDOW_MS = 60_000;

function getIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

function checkLimit(buckets: Map<string, RateBucket>, ip: string, limit: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

// Periodically clean up stale buckets
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of readBuckets) if (now >= v.resetAt) readBuckets.delete(k);
  for (const [k, v] of writeBuckets) if (now >= v.resetAt) writeBuckets.delete(k);
}, 60_000).unref?.();

export function rateLimit(request: Request, type: "read" | "write"): NextResponse | null {
  const ip = getIp(request);
  const buckets = type === "read" ? readBuckets : writeBuckets;
  const limit = type === "read" ? READ_LIMIT : WRITE_LIMIT;
  if (!checkLimit(buckets, ip, limit)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 },
    );
  }
  return null;
}

// ═══ PAGINATION ═══

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function parsePageSize(param: string | null): number {
  if (!param) return DEFAULT_PAGE_SIZE;
  const n = parseInt(param, 10);
  if (isNaN(n) || n < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
}

// ═══ PROTOCOL FILTER ═══

const VALID_PROTOCOLS = new Set(["ocdn", "ew"]);

export function parseProtocolFilter(param: string | null): string | null {
  if (!param || param === "all") return null;
  if (VALID_PROTOCOLS.has(param)) return param;
  return null;
}

// ═══ ERROR RESPONSE HELPERS ═══

export function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function notFound(message: string = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}
