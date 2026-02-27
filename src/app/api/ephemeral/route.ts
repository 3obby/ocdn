import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  rateLimit,
  validateContent,
  validateTopic,
  validateHex,
  errorResponse,
  log,
  PAYMENT_EXPIRY_MS,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

function getIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

/**
 * POST /api/ephemeral
 *
 * Cache content immediately for display as a preview. Returns an ephemeral post
 * that the frontend can show in the feed while the user pays.
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

  const contentResult = validateContent(body.content);
  if (!contentResult.ok) return errorResponse(contentResult.error);

  const topicResult = validateTopic(body.topic);
  if (!topicResult.ok) return errorResponse(topicResult.error);

  let parentHash: string | null = null;
  if (body.parentHash) {
    const r = validateHex(body.parentHash, "parentHash", 64);
    if (!r.ok) return errorResponse(r.error);
    parentHash = r.value;
  }

  try {
    const ip = getIp(request);
    const expiresAt = new Date(Date.now() + PAYMENT_EXPIRY_MS);

    const ephemeral = await prisma.ephemeralPost.create({
      data: {
        content: contentResult.value,
        topic: topicResult.value || null,
        parentHash,
        authorIp: ip,
        status: "cached",
        expiresAt,
      },
    });

    log("info", "api/ephemeral", "ephemeral post cached", { id: ephemeral.id });

    return NextResponse.json(
      {
        id: ephemeral.id,
        content: ephemeral.content,
        topic: ephemeral.topic,
        parentHash: ephemeral.parentHash,
        status: "cached",
        expiresAt: expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    log("error", "api/ephemeral", message, {
      stack: err instanceof Error ? err.stack : String(err),
    });
    return errorResponse(message, 500);
  }
}

/**
 * GET /api/ephemeral
 *
 * Returns all non-expired ephemeral posts for display in the feed.
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  try {
    const ephemerals = await prisma.ephemeralPost.findMany({
      where: {
        status: { in: ["cached", "paying", "upgraded"] },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Deduplicate by content (keep newest)
    const seen = new Set<string>();
    const unique = ephemerals.filter((e) => {
      if (seen.has(e.content)) return false;
      seen.add(e.content);
      return true;
    });

    return NextResponse.json({
      posts: unique.map((e) => ({
        id: e.id,
        content: e.content,
        topic: e.topic,
        parentHash: e.parentHash,
        status: e.status,
        expiresAt: e.expiresAt.toISOString(),
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    log("error", "api/ephemeral", message);
    return errorResponse(message, 500);
  }
}
