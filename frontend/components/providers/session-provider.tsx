"use client";

import { createContext, useContext, useMemo } from "react";
import { authClient } from "@/lib/auth";
import type { SessionData } from "@/lib/types";

/**
 * Re-export for convenience — consumers can import SessionData from here or from lib/types.
 */
export type { SessionData };

/**
 * Context that holds the server-fetched session to avoid a loading flash.
 * Once better-auth's useSession resolves on the client, it takes over.
 */
const ServerSessionContext = createContext<SessionData | null>(null);

/**
 * Hybrid session provider.
 *
 * - On first render: instantly returns `initialSession` (from server RSC fetch)
 * - After hydration: better-auth's `useSession` takes over with reactive updates
 *
 * This means:
 * - No loading flash on initial page load
 * - Session updates (login, logout, profile changes) are reflected without full page reload
 */
export function SessionProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: SessionData | null;
}) {
  return (
    <ServerSessionContext.Provider value={initialSession}>
      {children}
    </ServerSessionContext.Provider>
  );
}

/**
 * Hybrid useSession hook.
 *
 * Returns better-auth's reactive session once loaded,
 * falls back to the server-fetched session during the initial render.
 *
 * Usage:
 * ```tsx
 * const { session, user, isPending } = useSession();
 * ```
 */
export function useSession() {
  const serverSession = useContext(ServerSessionContext);
  const betterAuth = authClient.useSession();

  // Once better-auth has loaded, use its data (reactive)
  // During initial render / loading, fall back to server-fetched session
  const session = useMemo(() => {
    if (betterAuth.data) {
      return betterAuth.data;
    }
    // Still loading — use server-prefetched data
    if (betterAuth.isPending && serverSession) {
      return serverSession;
    }
    return null;
  }, [betterAuth.data, betterAuth.isPending, serverSession]);

  return {
    session: session?.session ?? null,
    user: session?.user ?? null,
    isPending: betterAuth.isPending && !serverSession,
    error: betterAuth.error,
    refetch: betterAuth.refetch,
  };
}
