import { NextResponse, type NextRequest } from "next/server";

const SIGNER_URL = process.env.SIGNER_URL;
const PROXIED_PATHS = new Set([
  "/api/post",
  "/api/reply",
  "/api/burn",
  "/api/signal",
  "/api/costs",
  "/api/health",
  "/api/payment",
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (SIGNER_URL && PROXIED_PATHS.has(pathname)) {
    return NextResponse.rewrite(new URL(pathname, SIGNER_URL));
  }

  if (
    pathname === "/" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/";
  return NextResponse.rewrite(url);
}
