import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * POST /api/admin/review — Approve or reject content.
 * Body: { hash, action: "approve" | "reject" }
 *
 * Requires: Authorization: Bearer <ADMIN_TOKEN>
 */
export async function POST(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const body = await req.json();
  const { hash, action } = body;

  if (!hash || !action || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "Required: hash, action (approve|reject)" },
      { status: 400 }
    );
  }

  const meta = await prisma.contentMeta.findUnique({ where: { hash } });
  if (!meta) {
    return NextResponse.json(
      { error: "Content not found" },
      { status: 404 }
    );
  }

  const newStatus = action === "approve" ? "live" : "rejected";

  await prisma.contentMeta.update({
    where: { hash },
    data: { status: newStatus },
  });

  return NextResponse.json({
    success: true,
    hash,
    status: newStatus,
  });
}
