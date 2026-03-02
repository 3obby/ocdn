import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, requireWriteAuth, errorResponse, log } from "@/lib/api-utils";
import { mapEphemeralPost } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/ephemeral/[nostrEventId]
 * Returns a single ephemeral post with its boosts and direct children.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ nostrEventId: string }> },
) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  const { nostrEventId } = await params;

  try {
    const post = await prisma.ephemeralPost.findUnique({
      where: { nostrEventId },
      include: {
        children: { orderBy: { upvoteWeight: "desc" }, take: 20 },
      },
    });

    if (!post) return errorResponse("Not found", 404);

    const boosts = await prisma.nostrBoost.findMany({
      where: { targetNostrId: nostrEventId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { nostrEventId: true, nostrPubkey: true, powDifficulty: true, createdAt: true },
    });

    return NextResponse.json({
      post: mapEphemeralPost(post),
      children: post.children.map(mapEphemeralPost),
      boosts: boosts.map((b) => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    log("error", "api/ephemeral/[id]", String(err));
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/ephemeral/[nostrEventId]
 * Internal: prune a single expired post. Requires API_WRITE_KEY.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ nostrEventId: string }> },
) {
  const authError = requireWriteAuth(request);
  if (authError) return authError;

  const { nostrEventId } = await params;

  try {
    await prisma.ephemeralPost.delete({ where: { nostrEventId } });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    log("error", "api/ephemeral/[id] DELETE", String(err));
    return errorResponse("Internal server error", 500);
  }
}
