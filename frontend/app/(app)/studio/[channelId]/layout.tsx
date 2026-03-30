import { TRPCClientError } from "@trpc/client";
import { getTrpcServer } from "@/lib/trpc-server";
import { redirect } from "next/navigation";
import { StudioProvider, type Channel } from "./_components/studio-provider";
import { StudioNavbar } from "./_components/studio-navbar";
import { UploadModal } from "./_components/upload/upload-modal";
import { MinimizedUploadWidget } from "./_components/upload/minimized-upload-widget";

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
                throw error; // Trigger nearest error.tsx boundary
            }
        } else if (error instanceof Error) {
            if (error.message.includes("UNAUTHORIZED")) {
                isUnauthorized = true;
            } else {
                throw error; // Trigger nearest error.tsx boundary
            }
        } else {
            throw error; // Trigger nearest error.tsx boundary
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

    return (
        <StudioProvider channel={activeChannel} allChannels={channels}>
            <div className="flex flex-col min-h-screen bg-background min-w-0">
                <StudioNavbar />
                <main className="flex-1">
                    {children}
                </main>
                <UploadModal />
                <MinimizedUploadWidget />
            </div>
        </StudioProvider>
    );
}
