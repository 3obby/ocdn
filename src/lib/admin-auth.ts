import { NextRequest, NextResponse } from "next/server";

/**
 * Simple admin auth guard using Bearer token.
 * Set ADMIN_TOKEN in .env. If not set, admin routes are disabled.
 */
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

export function requireAdmin(req: NextRequest): NextResponse | null {
  if (!ADMIN_TOKEN) {
    return NextResponse.json(
      { error: "Admin routes not configured (ADMIN_TOKEN not set)" },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization");
  if (!auth || auth !== `Bearer ${ADMIN_TOKEN}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  return null; // Authorized
}
