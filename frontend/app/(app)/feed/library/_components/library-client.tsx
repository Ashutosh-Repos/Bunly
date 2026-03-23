"use client";

import { trpc } from "@/lib/trpc-client";
import { VideoGrid } from "@/components/custom/video-grid";
import { Button } from "@/components/ui/button";
import { IconHistory, IconThumbUp, IconPlaylist } from "@tabler/icons-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { getMediaUrl } from "@/lib/utils";

export function LibraryClient() {
    const historyQuery = trpc.history.getHistory.useInfiniteQuery({}, {
        getNextPageParam: (l) => l.nextCursor,
    });
    
    const likedQuery = trpc.feed.getLikedVideos.useInfiniteQuery({}, {
        getNextPageParam: (l) => l.nextCursor,
    });
    
    const playlistsQuery = trpc.playlist.getUserPlaylists.useQuery({});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const historyVideos = historyQuery.data?.pages.flatMap(p => p.items.map((i: any) => i.video)) || [];
    const likedVideos = likedQuery.data?.pages.flatMap(p => p.videos) || [];
    const playlists = playlistsQuery.data?.playlists || [];

    const isLoading = historyQuery.isLoading || likedQuery.isLoading || playlistsQuery.isLoading;

    if (isLoading) {
        return (
            <div className="w-full p-4 sm:p-8 space-y-12">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-muted rounded w-48 mb-6" />
                    <VideoGrid isLoading={true} />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-8 pb-24 space-y-12 flex flex-col">
            
            {/* History Section */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xl font-bold tracking-tight">
                        <IconHistory className="w-6 h-6" />
                        <h2>History</h2>
                    </div>
                    {historyVideos.length > 0 && (
                        <Link href="/me/watch-history">
                            <Button variant="ghost" className="text-primary font-semibold rounded-full hover:bg-primary/10">
                                View all
                            </Button>
                        </Link>
                    )}
                </div>
                {historyVideos.length === 0 ? (
                    <p className="text-muted-foreground border-b border-border/40 pb-6 max-w-sm">Videos you watch will show up here.</p>
                ) : (
                    <div className="border-b border-border/40 pb-6">
                        <VideoGrid videos={historyVideos.slice(0, 10)} />
                    </div>
                )}
            </section>

            {/* Liked Videos Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-xl font-bold tracking-tight mb-2">
                    <IconThumbUp className="w-6 h-6" />
                    <h2>Liked videos</h2>
                </div>
                {likedVideos.length === 0 ? (
                    <p className="text-muted-foreground border-b border-border/40 pb-6 max-w-sm">Videos you like will show up here.</p>
                ) : (
                    <div className="border-b border-border/40 pb-6">
                        <VideoGrid videos={likedVideos.slice(0, 10)} />
                    </div>
                )}
            </section>

            {/* Playlists Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-xl font-bold tracking-tight mb-4">
                    <IconPlaylist className="w-6 h-6" />
                    <h2>Playlists</h2>
                </div>
                {playlists.length === 0 ? (
                    <p className="text-muted-foreground">Playlists you create will show up here.</p>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {playlists.map((playlist) => (
                            <Link key={playlist.id} href={`/playlist/${playlist.id}`} className="group cursor-pointer">
                                <Card className="p-0 overflow-hidden bg-muted/20 border-border/40 hover:border-primary/50 transition-colors shadow-none hover:shadow-sm">
                                    <div className="aspect-video relative bg-muted flex items-center justify-center isolate border-b border-border/30">
                                        <div className="absolute inset-x-0 bottom-0 h-[30%] bg-linear-to-t from-black/80 to-transparent z-10 flex flex-col justify-end p-2 px-3 tracking-tight transition-colors">
                                            <span className="text-white font-semibold flex items-center justify-end gap-1.5 text-xs drop-shadow-sm">
                                                <IconPlaylist size={14} />
                                                {playlist.videoCount} videos
                                            </span>
                                        </div>
                                        {playlist.thumbnailUrl ? (
                                            <Image 
                                                src={getMediaUrl(playlist.thumbnailUrl)}
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
                                        <p className="text-[13px] text-muted-foreground mt-1 capitalize">
                                            {playlist.visibility.toLowerCase()}
                                        </p>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

        </div>
    );
}
