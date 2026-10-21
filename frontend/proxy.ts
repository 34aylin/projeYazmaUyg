import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "proje_asistan_v2";
const PUBLIC_PATHS = ["/giris"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static files, api routes, _next
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/public") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Logged in → redirect away from login page
  if (token && isPublic) {
    return NextResponse.redirect(new URL("/panel", req.url));
  }

  // Not logged in → send to login
  if (!token && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/giris";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
