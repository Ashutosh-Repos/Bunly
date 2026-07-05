import { TRPCClientError } from "@trpc/client";
import { getTrpcServer } from "@/lib/trpc-server";
import { redirect } from "next/navigation";
import { StudioProvider, type Channel } from "./_components/studio-provider";
import { UploadModal } from "./_components/upload/upload-modal";
import { MinimizedUploadWidget } from "./_components/upload/minimized-upload-widget";
import { NavigationDock } from "@/components/custom/navigation-dock";
import UploadBtn from "./_components/upload/uploadBtn";
import { SwitchChannelButton } from "./_components/switch-channel-button";
import { NotificationBell } from "@/components/notification-bell";
import { TopBar } from "@/components/custom/top-bar";
import { ThemeToggle } from "@/components/custom/theme-toggle";

export default async function StudioLayout(props: {
    children: React.ReactNode;
    params: Promise<{ channelId: string }>;
}) {
    const { children } = props;
    const params = await props.params;
    const { channelId } = params;

    const trpcServer = await getTrpcServer();
    
    let channels: Channel[] = [];
    let isUnauthorized = false;

    try {
        const result = await trpcServer.channel.getUserChannels.query();
        channels = result.channels;
    } catch (error) {
        if (error instanceof TRPCClientError) {
            if (error.data?.code === "UNAUTHORIZED" || error.message.includes("UNAUTHORIZED")) {
                isUnauthorized = true;
            } else {
                throw error;
            }
        } else if (error instanceof Error) {
            if (error.message.includes("UNAUTHORIZED")) {
                isUnauthorized = true;
            } else {
                throw error;
            }
        } else {
            throw error;
        }
    }

    if (isUnauthorized) {
        redirect("/auth/login");
    }

    // 2. Ownership Guard (403 equivalence via redirection fallback)
    const activeChannel = channels.find((c) => c.id === channelId);
    if (!activeChannel) {
        redirect("/studio");
    }

    const studioNavItems = [
        { icon: "dashboard", title: "Dashboard", href: `/studio/${channelId}` },
        { icon: "content", title: "Content", href: `/studio/${channelId}/content` },
        { icon: "comments", title: "Comments", href: `/studio/${channelId}/comments` },
        { icon: "community", title: "Community", href: `/studio/${channelId}/community` },
        { icon: "settings", title: "Settings", href: `/studio/${channelId}/settings` },
    ];

    return (
        <StudioProvider channel={activeChannel} allChannels={channels}>
            <TopBar>
                <div className="flex-1 flex justify-center max-w-xl mx-auto">
            
                </div>
                <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                    <UploadBtn/>
                    <SwitchChannelButton/>
                    <NotificationBell />
                    <ThemeToggle />
                </div>
            </TopBar>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="w-full flex-1 flex flex-col-reverse sm:flex-row items-stretch overflow-hidden">
                    <NavigationDock navLinks={studioNavItems} />
                    <div
                        id="main-scroll-container"
                        className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6"
                    >
                        <div className="flex flex-col min-h-screen bg-background min-w-0">
                            
                            <main className="flex-1">
                                {children}
                            </main>
                            <UploadModal />
                            <MinimizedUploadWidget />
                        </div>
                    </div>
                </div>
            </div>
        </StudioProvider>
    );
}
