import { requireOnboarded } from "@/lib/auth-server";
import { SessionProvider } from "@/components/providers/session-provider";
import { NotificationBell } from "@/components/notification-bell";
import { TopBar } from "@/components/custom/top-bar";
import { SearchForm } from "@/components/custom/search-form";
import { NavigationDock } from "@/components/custom/navigation-dock";
import { ThemeToggle } from "@/components/custom/theme-toggle";

export default async function MeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireOnboarded();
  const navItems = [
        { icon: "profile", title: "Profile", href: "/me" },
        { icon: "history", title: "Watch History", href: "/me/watch-history" },
        { icon: "bell", title: "Notifications", href: "/me/notifications" },
        { icon: "settings", title: "Settings", href: "/me/settings" },
    ];

  return (
    <SessionProvider initialSession={session}>
      <main
        id="me-layout-wrapper"
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
        
        <div className="w-full flex-1 flex flex-col-reverse sm:flex-row items-stretch overflow-hidden">
          <NavigationDock navLinks={navItems} />
          <div
            id="main-scroll-container"
            className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6"
          >
            {children}
          </div>
        </div>
      </main>
    </SessionProvider>
  );
}
