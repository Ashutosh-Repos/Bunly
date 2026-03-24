"use client";

import { trpc } from "@/lib/trpc-client";
import { IconPlaylist } from "@tabler/icons-react";
import { PlaylistCard } from "@/components/custom/playlist-card";

import { useChannelContext } from "../layout";

export default function ChannelPlaylistsPage() {
    const { channel } = useChannelContext();
    const channelId = channel?.id;

    const { data, isLoading } = trpc.playlist.getPublicChannelPlaylists.useQuery(
        { channelId: channelId! },
        { enabled: !!channelId }
    );

    if (!channelId || isLoading) return <div className="animate-pulse h-64 bg-muted/20 rounded-xl" />;

    const playlists = data?.playlists || [];

    if (playlists.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground mt-8">
                <IconPlaylist className="w-12 h-12 mb-4 opacity-20" />
                <h3 className="text-lg font-bold text-foreground">No playlists</h3>
                <p>This channel hasn&apos;t created any public playlists.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
            {playlists.map((playlist) => (
                <PlaylistCard
                    key={playlist.id}
                    id={playlist.id}
                    title={playlist.title}
                    videoCount={playlist._count.playlist_videos}
                    firstVideoThumbnail={playlist.firstVideoThumbnail}
                />
            ))}
        </div>
    );
}
