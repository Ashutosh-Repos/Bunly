import { requireOnboarded } from "@/lib/auth-server";
import { SessionProvider } from "@/components/providers/session-provider";
import { HomeIcon } from "@/components/ui/home";
import { FlameIcon } from "@/components/ui/flame";
import { ClapIcon } from "@/components/ui/clap";
import { UserIcon } from "@/components/ui/user";
import { NotificationBell } from "@/components/notification-bell";
import { TopBar } from "@/components/custom/top-bar";
import { SearchForm } from "@/components/custom/search-form";
import { NavigationDock } from "@/components/custom/navigation-dock";
import { ThemeToggle } from "@/components/custom/theme-toggle";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireOnboarded();
  const navItems = [
        { icon: HomeIcon, title: "Home", href: "/" },
        { icon: FlameIcon, title: "Trending", href: "/trending" },
        { icon: ClapIcon, title: "Studio", href: "/studio" },
        { icon: UserIcon, title: "Me", href: "/me" },
    ];

  return <SessionProvider initialSession={session}>
    <main
            id="home-layout-wrapper"
            className="w-full h-screen flex flex-col overflow-hidden px-2 sm:px-1"
        >
            <TopBar>
                <SearchForm />
                <div className="flex items-center gap-2">
                    <NotificationBell />
                    <ThemeToggle />
                </div>
            </TopBar>
            <div className="w-full h-full flex flex-col-reverse sm:flex-row items-center justify-center overflow-hidden">
                <NavigationDock navLinks={navItems} />
                <div
                    id="main-scroll-container"
                    className="w-full h-full overflow-y-auto p-2 sm:p-1"
                >
                    {children}
                </div>
            </div>
        </main>
  </SessionProvider>;
}
