import { requireOnboarded } from "@/lib/auth-server";
import { SessionProvider } from "@/components/providers/session-provider";
import { TopBar } from "@/components/custom/top-bar";
import { ThemeToggle } from "@/components/custom/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import UploadBtn from "./studio/[channelId]/_components/upload/uploadBtn";
import { SwitchChannelButton } from "./studio/[channelId]/_components/switch-channel-button";

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
        {children}
      </main>
    </SessionProvider>
  );
}
