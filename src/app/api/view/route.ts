import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, validateHex, errorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/view
 * Increment view count for a post. Fire-and-forget from the frontend.
 * Body: { contentHash: string }
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  let body: { contentHash?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const result = validateHex(body.contentHash, "contentHash", 64);
  if (!result.ok) return errorResponse(result.error);

  try {
    await prisma.post.update({
      where: { contentHash: result.value },
      data: { viewCount: { increment: 1 } },
    });
  } catch {
    // Post may not exist (ephemeral, etc.) — ignore silently
  }

  return NextResponse.json({ ok: true });
}
