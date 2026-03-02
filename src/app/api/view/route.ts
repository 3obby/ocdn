import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const HEX_64 = /^[0-9a-f]{64}$/i;

/**
 * POST /api/view
 * Increment view count for one or more posts. Fire-and-forget from the frontend.
 * Body: { contentHash: string } or { contentHashes: string[] }
 */
export async function POST(request: Request) {
  let body: { contentHash?: unknown; contentHashes?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  let hashes: string[];
  if (Array.isArray(body.contentHashes)) {
    hashes = body.contentHashes.filter((h): h is string => typeof h === "string" && HEX_64.test(h)).slice(0, 50);
  } else if (typeof body.contentHash === "string" && HEX_64.test(body.contentHash)) {
    hashes = [body.contentHash];
  } else {
    return errorResponse("contentHash or contentHashes required");
  }

  if (hashes.length === 0) return NextResponse.json({ ok: true });

  try {
    await prisma.post.updateMany({
      where: { contentHash: { in: hashes } },
      data: { viewCount: { increment: 1 } },
    });
  } catch {
    // Posts may not exist — ignore silently
  }

  return NextResponse.json({ ok: true });
}
