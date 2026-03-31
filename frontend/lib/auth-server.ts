import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { SessionData } from "@/lib/types";

const AUTH_URL =
  process.env.API_ORIGIN ||
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
  "http://localhost:4000";

/**
 * Server-side session fetcher — calls better-auth's native get-session endpoint.
 *
 * Uses React.cache() to deduplicate within a single request lifecycle,
 * so layout + page + component can all call getSession() with only 1 HTTP call.
 *
 * Returns the full session object { session, user } or null if unauthenticated.
 * Throws on server errors (5xx) so they hit the error boundary, NOT the login page.
 */
export const getSession = cache(async (): Promise<SessionData | null> => {
  const heads = await headers();
  const cookie = heads.get("cookie") || "";

  // No cookie at all — skip the API call entirely
  if (!cookie) return null;

  try {
    // Reconstruct critical headers for strict SSR validation
    const fetchHeaders = new Headers();
    fetchHeaders.set("cookie", cookie);

    // Forward origin headers so Better-Auth's CSRF/Origin check succeeds
    if (heads.get("x-forwarded-for")) fetchHeaders.set("x-forwarded-for", heads.get("x-forwarded-for") as string);
    if (heads.get("user-agent")) fetchHeaders.set("user-agent", heads.get("user-agent") as string);
    if (heads.get("host")) fetchHeaders.set("host", heads.get("host") as string);
    fetchHeaders.set("origin", process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000");

    const res = await fetch(`${AUTH_URL}/api/auth/get-session`, {
      headers: fetchHeaders,
      cache: "no-store", // Auth must never be stale
    });

    // Unauthenticated — session expired, revoked, or invalid
    if (res.status === 401 || res.status === 403) return null;

    // Server error — don't redirect to login, let error boundary handle it
    if (!res.ok) {
      throw new Error(`Auth service unavailable (${res.status})`);
    }

    const data = await res.json();

    // better-auth returns { session: {...}, user: {...} } or null body
    if (!data?.user) return null;

    return data as SessionData;
  } catch (error) {
    // Network error or JSON parse failure
    if (error instanceof Error && error.message.startsWith("Auth service")) {
      throw error; // Re-throw our own error
    }
    // For network failures, also throw (don't silently redirect to login)
    throw new Error("Unable to reach auth service");
  }
});

/**
 * Requires a valid authenticated session.
 * Redirects to /auth/login if not authenticated.
 * Returns the validated session + user.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirect("/auth/login");
  }
  return session;
}

/**
 * Requires auth + completed onboarding (user has DOB set).
 * Redirects to /auth/onboarding if DOB is missing.
 * Returns the validated session + user.
 */
export async function requireOnboarded() {
  const session = await requireAuth();
  if (!session.user.dob) {
    redirect("/auth/onboarding");
  }
  return session;
}
