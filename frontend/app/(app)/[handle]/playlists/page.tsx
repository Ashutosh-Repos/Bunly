"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc-client";
import { IconPlaylist } from "@tabler/icons-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { getMediaUrl } from "@/lib/utils";

export default function ChannelPlaylistsPage({ params }: { params: Promise<{ handle: string }> }) {
    const { handle } = use(params);
    const cleanHandle = decodeURIComponent(handle).slice(1);

    const { data: channelData } = trpc.channel.getChannelByHandle.useQuery({ handle: cleanHandle });
    const channelId = channelData?.channel.id;

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
                <Link key={playlist.id} href={`/playlist/${playlist.id}`} className="group cursor-pointer">
                    <Card className="p-0 overflow-hidden bg-muted/20 border-border/40 hover:border-primary/50 transition-colors shadow-none hover:shadow-sm">
                        <div className="aspect-video relative bg-muted flex items-center justify-center isolate border-b border-border/30">
                            <div className="absolute inset-x-0 bottom-0 h-[30%] bg-linear-to-t from-black/80 to-transparent z-10 flex flex-col justify-end p-2 px-3 tracking-tight transition-colors">
                                <span className="text-white font-semibold flex items-center justify-end gap-1.5 text-xs drop-shadow-sm">
                                    <IconPlaylist size={14} />
                                    {playlist._count.playlist_videos} videos
                                </span>
                            </div>
                            {playlist.firstVideoThumbnail ? (
                                <Image 
                                    src={getMediaUrl(playlist.firstVideoThumbnail)}
                                    alt={playlist.title}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                            ) : (
                                <IconPlaylist className="w-8 h-8 text-muted-foreground/30 group-hover:scale-110 transition-transform" />
                            )}
                        </div>
                        <div className="p-3">
                            <h3 className="font-semibold text-[15px] line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                                {playlist.title}
                            </h3>
                            <p className="text-[13px] text-muted-foreground mt-1">
                                View full playlist
                            </p>
                        </div>
                    </Card>
                </Link>
            ))}
        </div>
    );
}
