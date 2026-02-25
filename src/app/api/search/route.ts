import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mapPost, getTipHeight, rateLimit, parsePageSize, parseProtocolFilter, errorResponse, log } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=<query>&cursor=<contentHash>&limit=<number>
 *
 * Full-text search over indexed post content.
 * Uses PostgreSQL ts_vector/ts_query with ILIKE fallback.
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const cursor = searchParams.get("cursor");
  const limit = parsePageSize(searchParams.get("limit"));
  const protocolFilter = parseProtocolFilter(searchParams.get("protocol"));

  if (!q || q.length < 2) {
    return errorResponse("query parameter 'q' must be at least 2 characters");
  }
  if (q.length > 200) {
    return errorResponse("query parameter 'q' must not exceed 200 characters");
  }

  try {
    const tipHeight = await getTipHeight(prisma);

    // Use PostgreSQL full-text search with plainto_tsquery for robustness
    const tsQuery = q.replace(/[^\w\s]/g, " ").trim().split(/\s+/).join(" & ");

    const posts = await prisma.$queryRawUnsafe<
      Array<{
        content_hash: string;
        txid: string;
        block_hash: string;
        block_height: number;
        protocol: string;
        author_pubkey: string;
        nonce: Buffer | null;
        signature: Buffer | null;
        type: number;
        topic: string | null;
        topic_hash: string | null;
        parent_hash: string | null;
        content: string;
        created_at: Date;
        indexed_at: Date;
        burn_total: bigint;
        rank: number;
      }>
    >(
      `SELECT p.*,
              COALESCE(SUM(b.amount), 0) AS burn_total,
              ts_rank(to_tsvector('english', p.content), to_tsquery('english', $1)) AS rank
       FROM posts p
       LEFT JOIN burns b ON b.target_hash = p.content_hash AND b.target_type = 'content'
       WHERE (to_tsvector('english', p.content) @@ to_tsquery('english', $1)
          OR p.content ILIKE $2
          OR p.topic ILIKE $2)
          ${protocolFilter ? "AND p.protocol = $5" : ""}
       GROUP BY p.content_hash
       ORDER BY rank DESC, p.block_height DESC
       LIMIT $3
       OFFSET $4`,
      tsQuery || q,
      `%${q}%`,
      limit + 1,
      0,
      ...(protocolFilter ? [protocolFilter] : [])
    );

    // For cursor-based: skip until we pass the cursor
    let startIdx = 0;
    if (cursor) {
      const idx = posts.findIndex((p) => p.content_hash === cursor);
      if (idx >= 0) startIdx = idx + 1;
    }

    const slice = posts.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + limit < posts.length;

    const mapped = slice.map((p) => ({
      id: p.content_hash,
      contentHash: p.content_hash,
      protocol: p.protocol ?? "ocdn",
      authorPubkey: p.author_pubkey,
      text: p.content,
      topicHash: p.topic_hash,
      topicName: p.topic,
      parentId: p.parent_hash,
      burnTotal: Number(p.burn_total),
      timestamp: new Date(p.created_at).getTime(),
      blockHeight: p.block_height,
      confirmations: Math.max(0, tipHeight - p.block_height + 1),
    }));

    return NextResponse.json({
      posts: mapped,
      nextCursor: hasMore ? slice[slice.length - 1]?.content_hash ?? null : null,
      query: q,
    });
  } catch (err) {
    log("error", "api/search", "search failed", { query: q, error: String(err) });
    return errorResponse("Internal server error", 500);
  }
}
