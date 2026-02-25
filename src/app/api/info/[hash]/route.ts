import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTipHeight, rateLimit, notFound, errorResponse, bigintToNumber } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/info/:hash
 *
 * Complete on-chain metadata: content_hash, txid, block hash, block height,
 * confirmations, total burns, author pubkey, topic.
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
      include: {
        burns: { select: { amount: true, txid: true, blockHeight: true } },
        block: { select: { hash: true, height: true, timestamp: true } },
      },
    });

    if (!post) return notFound("Post not found");

    const totalBurned = post.burns.reduce(
      (sum, b) => sum + bigintToNumber(b.amount),
      0,
    );

    return NextResponse.json({
      contentHash: post.contentHash,
      txid: post.txid,
      blockHash: post.block.hash,
      blockHeight: post.block.height,
      blockTimestamp: post.block.timestamp.toISOString(),
      confirmations: Math.max(0, tipHeight - post.block.height + 1),
      authorPubkey: post.authorPubkey,
      type: post.type,
      topic: post.topic,
      topicHash: post.topicHash,
      parentHash: post.parentHash,
      content: post.content,
      totalBurned,
      burns: post.burns.map((b) => ({
        txid: b.txid,
        amount: bigintToNumber(b.amount),
        blockHeight: b.blockHeight,
      })),
      createdAt: post.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("GET /api/info error:", err);
    return errorResponse("Internal server error", 500);
  }
}
