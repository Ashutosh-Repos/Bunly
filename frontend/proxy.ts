import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Layer 1: Fast cookie-based routing guard.
 *
 * This is the first line of defense — checks if the session cookie EXISTS.
 * It does NOT validate the session (that's Layer 2 in page RSC guards).
 *
 * Responsibilities:
 *  1. Redirect unauthenticated users to /auth/login for protected routes.
 *  2. Redirect authenticated users away from login/signup pages.
 *  3. Inject security headers on every response.
 */

const PUBLIC_AUTH_ROUTES = [
  "/auth/login",
  "/auth/signup",
  "/auth/verify-pending",
  "/auth/verify-email",
  "/auth/reset-password",
  "/auth/forgot-password",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = !!request.cookies.get("better-auth.session_token");
  const isPublicPath = PUBLIC_AUTH_ROUTES.some((p) => pathname.startsWith(p));

  // ── Authenticated user on auth pages → bounce home ──────────────────
  // Exception: verify-email must be accessible even when authenticated
  // (e.g., user clicks email link while already logged in from another device)
  if (hasSession && isPublicPath && !pathname.startsWith("/auth/verify-email")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ── Unauthenticated user on protected page → send to login ──────────
  if (!hasSession && !isPublicPath) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Security headers ────────────────────────────────────────────────
  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - api            (API routes)
     *  - _next/static   (static files)
     *  - _next/image    (image optimisation)
     *  - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
