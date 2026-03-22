import { requireOnboarded } from "@/lib/auth-server";
import { SessionProvider } from "@/components/providers/session-provider";

/**
 * Layout for protected routes — requires auth + completed onboarding.
 *
 * - Unauthenticated users → redirected to /auth/login
 * - Users without DOB → redirected to /auth/onboarding
 * - Onboarded users → session available via SessionProvider
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireOnboarded();

  return <SessionProvider initialSession={session}>{children}</SessionProvider>;
}
