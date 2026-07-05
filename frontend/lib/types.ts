/**
 * Shared session types — single source of truth.
 *
 * Used by both server-side `getSession()` (auth-server.ts)
 * and client-side `SessionProvider` (session-provider.tsx).
 */

export interface SessionData {
  session: {
    id: string;
    token: string;
    expiresAt: string;
    userId: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    dob: string | null;
    role: string | null;
    emailVerified: boolean;
  };
}
