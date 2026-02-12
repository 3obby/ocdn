import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/queue — List content pending operator review.
 * Query params: ?status=pending (default) | live | rejected | all
 *               ?limit=50 (default)
 *
 * Requires: Authorization: Bearer <ADMIN_TOKEN>
 */
export async function GET(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? "pending";
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

  const where = status === "all" ? {} : { status };

  const items = await prisma.contentMeta.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      pool: {
        select: {
          balance: true,
          funderCount: true,
        },
      },
    },
  });

  return NextResponse.json({
    count: items.length,
    items: items.map((item) => ({
      hash: item.hash,
      fileName: item.fileName,
      fileType: item.fileType,
      fileSize: item.fileSize,
      uploadedBy: item.uploadedBy,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      poolBalance: item.pool?.balance.toString() ?? "0",
      funderCount: item.pool?.funderCount ?? 0,
    })),
  });
}
