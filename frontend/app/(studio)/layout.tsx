import { requireOnboarded } from "@/lib/auth-server";
import { SessionProvider } from "@/components/providers/session-provider";
import { TopBar } from "@/components/custom/top-bar";
import { SearchForm } from "@/components/custom/search-form";
import { ThemeToggle } from "@/components/custom/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";

export default async function StudioRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireOnboarded();

  return (
    <SessionProvider initialSession={session}>
      <main
        id="studio-root-layout-wrapper"
        className="w-full h-screen flex flex-col overflow-hidden bg-background"
      >
        <TopBar>
          <div className="flex-1 flex justify-center max-w-xl mx-auto">
            <SearchForm />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </TopBar>
        
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {children}
        </div>
      </main>
    </SessionProvider>
  );
}
