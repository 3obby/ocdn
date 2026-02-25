import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mapPost, getTipHeight, rateLimit, notFound, errorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/post/:hash — single post with full metadata
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  const { hash } = await params;

  try {
    const tipHeight = await getTipHeight(prisma);

    const post = await prisma.post.findUnique({
      where: { contentHash: hash },
      include: { burns: { select: { amount: true } } },
    });

    if (!post) return notFound("Post not found");

    return NextResponse.json({ post: mapPost(post, tipHeight) });
  } catch (err) {
    console.error("GET /api/post error:", err);
    return errorResponse("Internal server error", 500);
  }
}
