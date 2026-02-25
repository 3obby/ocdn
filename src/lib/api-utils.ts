import { NextResponse } from "next/server";
import type { Post as PrismaPost } from "@/generated/prisma/client";
import type { Post as FrontendPost, Topic } from "./mock-data";

// ═══ BIGINT SERIALIZATION ═══

export function bigintToNumber(v: bigint): number {
  if (v <= Number.MAX_SAFE_INTEGER && v >= Number.MIN_SAFE_INTEGER) return Number(v);
  return Number(v);
}

// ═══ STRUCTURED LOGGING ═══

type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, ctx: string, msg: string, data?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    ctx,
    msg,
    ...(data ? { data } : {}),
  };
  const out = JSON.stringify(entry);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

// ═══ INPUT VALIDATION ═══

const MAX_CONTENT_BYTES = 50_000;
const MAX_TOPIC_LENGTH = 100;

export function validateContent(content: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (!content || typeof content !== "string") {
    return { ok: false, error: "content is required and must be a non-empty string" };
  }
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "content must not be empty" };
  }
  const byteLen = new TextEncoder().encode(trimmed).length;
  if (byteLen > MAX_CONTENT_BYTES) {
    return { ok: false, error: `content exceeds maximum size (${MAX_CONTENT_BYTES} bytes)` };
  }
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(trimmed)) {
    return { ok: false, error: "content contains invalid control characters" };
  }
  try {
    new TextEncoder().encode(trimmed);
  } catch {
    return { ok: false, error: "content contains invalid UTF-8" };
  }
  return { ok: true, value: trimmed };
}

export function validateTopic(topic: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (topic === undefined || topic === null || topic === "") {
    return { ok: true, value: "" };
  }
  if (typeof topic !== "string") {
    return { ok: false, error: "topic must be a string" };
  }
  const trimmed = topic.trim();
  if (trimmed.length > MAX_TOPIC_LENGTH) {
    return { ok: false, error: `topic exceeds maximum length (${MAX_TOPIC_LENGTH} characters)` };
  }
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(trimmed)) {
    return { ok: false, error: "topic contains invalid control characters" };
  }
  return { ok: true, value: trimmed };
}

export function validateHex(value: unknown, name: string, length: number): { ok: true; value: string } | { ok: false; error: string } {
  if (!value || typeof value !== "string") {
    return { ok: false, error: `${name} is required and must be a string` };
  }
  if (value.length !== length) {
    return { ok: false, error: `${name} must be exactly ${length} hex characters` };
  }
  if (!/^[0-9a-f]+$/i.test(value)) {
    return { ok: false, error: `${name} must be a valid hex string` };
  }
  return { ok: true, value: value.toLowerCase() };
}

// ═══ FEE SPIKE HANDLING ═══

const MAX_FEE_RATE_SAT_VB = Number(process.env.MAX_FEE_RATE ?? "100");

export function checkFeeSpike(feeRate: number): NextResponse | null {
  if (feeRate > MAX_FEE_RATE_SAT_VB) {
    log("warn", "fee-spike", `Fee rate ${feeRate} sat/vB exceeds threshold ${MAX_FEE_RATE_SAT_VB}`, { feeRate, threshold: MAX_FEE_RATE_SAT_VB });
    return NextResponse.json(
      { error: `Fee rate too high (${feeRate} sat/vB). Try again when fees drop below ${MAX_FEE_RATE_SAT_VB} sat/vB.` },
      { status: 503 },
    );
  }
  return null;
}

// ═══ API KEY AUTH ═══

const API_WRITE_KEY = process.env.API_WRITE_KEY;

export function requireWriteAuth(request: Request): NextResponse | null {
  if (!API_WRITE_KEY) return null;
  const provided = request.headers.get("x-api-key") ?? new URL(request.url).searchParams.get("key");
  if (provided !== API_WRITE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
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
    log("warn", "rate-limit", `${type} limit exceeded`, { ip, type });
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
