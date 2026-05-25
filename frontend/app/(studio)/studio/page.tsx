import { TRPCClientError } from "@trpc/client";
import { getTrpcServer } from "@/lib/trpc-server";
import { redirect } from "next/navigation";
import { ChannelSelectionClient } from "./_components/channel-selection-client";
import type { Channel } from "./[channelId]/_components/studio-provider";
import { IconAlertCircle } from "@tabler/icons-react";

export const dynamic = "force-dynamic";

export default async function StudioEntryPage() {
    let channels: Channel[] = [];
    let isError = false;
    let isUnauthorized = false;

    try {
        const trpcServer = await getTrpcServer();
        const result = await trpcServer.channel.getUserChannels.query();
        channels = result.channels;
    } catch (error) {
        if (error instanceof TRPCClientError) {
            if (error.data?.code === "UNAUTHORIZED" || error.message.includes("UNAUTHORIZED")) {
                isUnauthorized = true;
            } else {
                isError = true;
            }
        } else if (error instanceof Error) {
            if (error.message.includes("UNAUTHORIZED")) {
                isUnauthorized = true;
            } else {
                isError = true;
            }
        } else {
            isError = true;
        }
    }

    if (isUnauthorized) {
        redirect("/auth/login");
    }

    if (isError) {
        return (
            <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-6 text-center p-8">
                <div className="p-5 rounded-full bg-destructive/10 text-destructive mb-2 shadow-sm border border-destructive/20">
                    <IconAlertCircle className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black tracking-tighter uppercase text-foreground/90">
                    Connection Error
                </h2>
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/40 max-w-sm leading-relaxed">
                    Failed to load your creator profiles. Please verify your network connection and try again.
                </p>
            </div>
        );
    }

    // [UX FIX] Auto route appropriately without disjointed screens
    if (!channels || channels.length === 0) {
        redirect("/studio/create");
    }

    if (channels.length === 1) {
        redirect(`/studio/${channels[0].id}`);
    }

    // Multiple Channels: Present native selection grid
    return (
        <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 relative max-w-7xl mx-auto w-full">
            {/* Background glow for aesthetics */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-[100%] pointer-events-none -z-10" />
            
            <div className="max-w-4xl w-full space-y-16">
                 <div className="space-y-3 text-center">
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase text-foreground/90 leading-[1.1]">
                        Select a channel
                    </h1>
                    <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.4em] text-primary">
                        Creator Studio Hub
                    </p>
                </div>
                <ChannelSelectionClient channels={channels} />
            </div>
        </div>
    );
}
