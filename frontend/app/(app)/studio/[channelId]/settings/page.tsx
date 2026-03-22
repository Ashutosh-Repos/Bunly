"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc-client";
import { useStudio } from "../_components/studio-provider";

import { GeneralSettings } from "./_components/general-settings";
import { MediaSettings } from "./_components/media-settings";
import { DiscoverySettings } from "./_components/discovery-settings";
import { ContactSettings } from "./_components/contact-settings";
import { DangerZone } from "./_components/danger-zone";

export default function SettingsPage() {
    const { channel } = useStudio();

    const { data, isLoading } = trpc.channel.getChannelById.useQuery(
        { channelId: channel.id },
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!data?.channel) return null;

    const channelData = data.channel;

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 lg:px-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Channel Settings</h1>
                <p className="text-muted-foreground mt-2">
                    Manage your channel&apos;s public profile, discovery metadata, and lifecycle.
                </p>
            </div>

            <Separator />

            <GeneralSettings initialData={channelData} />
            <MediaSettings initialData={channelData} />
            <DiscoverySettings initialData={channelData} />
            <ContactSettings initialData={channelData} />
            <DangerZone channelId={channel.id} />
        </div>
    );
}
