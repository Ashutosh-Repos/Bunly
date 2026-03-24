"use client";

import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { VideoGrid } from "@/components/custom/video-grid";
import { IconSearch, IconUser, IconPlaylist } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { getMediaUrl } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";

const SEARCH_FILTERS = [
    { id: "ALL" as const, label: "All" },
    { id: "VIDEOS" as const, label: "Videos" },
    { id: "CHANNELS" as const, label: "Channels" },
    { id: "PLAYLISTS" as const, label: "Playlists" },
];

export function SearchClient() {
    const searchParams = useSearchParams();
    const rawQuery = searchParams.get("q") || "";
    // Remove characters that might break Postgres tsquery parsing before we send it to trpc
    const query = rawQuery.replace(/[&|!():*<>\\]/g, " ").replace(/\s+/g, " ").trim();
    const [filter, setFilter] = useState<"ALL" | "VIDEOS" | "CHANNELS" | "PLAYLISTS">("ALL");

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = trpc.search.globalSearch.useInfiniteQuery(
        { query, filter },
        {
            getNextPageParam: (l) => l.nextCursor,
            enabled: query.length > 0,
            staleTime: 1000 * 60,
        }
    );

    const { ref, inView } = useInView({ threshold: 0, rootMargin: "200px" });

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    if (!query) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <IconSearch className="w-16 h-16 text-muted-foreground/30 mb-6" />
                <h2 className="text-2xl font-bold tracking-tight mb-2">Search Bunly</h2>
                <p className="text-muted-foreground max-w-sm">
                    Find channels, playlists, and videos across the platform.
                </p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="w-full max-w-[1400px] mx-auto p-4 sm:p-8 space-y-8 animate-pulse">
                <div className="h-8 bg-muted rounded w-64 mb-8" />
                <VideoGrid isLoading={true} />
            </div>
        );
    }

    const firstPage = data?.pages[0];
    const channels = firstPage?.channels || [];
    const playlists = firstPage?.playlists || [];
    const videos = data?.pages.flatMap((p) => p.items) || [];

    const noResults = channels.length === 0 && playlists.length === 0 && videos.length === 0;

    if (noResults) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
                <IconSearch className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h2 className="text-xl font-bold tracking-tight">No results found for &quot;{rawQuery}&quot;</h2>
                <p className="text-muted-foreground mt-2">Try different or shorter keywords.</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1400px] mx-auto p-4 sm:p-8 pb-24 space-y-12">
            <div className="mb-2">
                <h1 className="text-xl font-bold tracking-tight text-muted-foreground">
                    Search results for <span className="text-foreground">&quot;{rawQuery}&quot;</span>
                </h1>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
                {SEARCH_FILTERS.map((f) => (
                    <Button
                        key={f.id}
                        variant={filter === f.id ? "default" : "secondary"}
                        size="sm"
                        className={cn(
                            "rounded-lg font-semibold px-4 transition-all tracking-tight",
                            filter === f.id
                                ? "shadow-sm"
                                : "hover:bg-muted text-muted-foreground",
                        )}
                        onClick={() => setFilter(f.id)}
                    >
                        {f.label}
                    </Button>
                ))}
            </div>

            {/* Channels Section (Highest Priority Match) */}
            {channels.length > 0 && (
                <section className="space-y-4">
                    <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                        <IconUser className="w-5 h-5 text-primary" /> Channels
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {channels.map((channel) => (
                            <Link key={channel.id} href={`/@${channel.handle}`} className="group cursor-pointer">
                                <Card className="flex items-center gap-4 p-4 bg-transparent border-none shadow-none hover:bg-muted/30 transition-colors">
                                    <Avatar className="w-20 h-20 border group-hover:scale-105 transition-transform">
                                        <AvatarImage src={channel.image ? getMediaUrl(channel.image) : ""} />
                                        <AvatarFallback className="text-xl font-bold">
                                            {(channel.name || "C").charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col overflow-hidden">
                                        <h3 className="font-bold text-lg leading-none mb-1 group-hover:text-primary transition-colors truncate">
                                            {channel.name}
                                        </h3>
                                        <p className="text-muted-foreground text-sm font-medium mb-1 truncate">
                                            @{channel.handle}
                                        </p>
                                        <p className="text-xs text-muted-foreground/80">
                                            {channel.subscriberCount.toLocaleString()} subscribers • {channel.videoCount} videos
                                        </p>
                                    </div>
                                    <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant={channel.isSubscribed ? "secondary" : "default"} size="sm" className="rounded-full font-bold shadow-none">
                                            {channel.isSubscribed ? "Subscribed" : "Subscribe"}
                                        </Button>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Playlists Section */}
            {playlists.length > 0 && (
                <section className="space-y-4">
                    <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                        <IconPlaylist className="w-5 h-5 text-primary" /> Playlists
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {playlists.map((playlist) => (
                            <Link key={playlist.id} href={`/playlist/${playlist.id}`} className="group cursor-pointer">
                                <Card className="p-0 overflow-hidden bg-muted/20 border-border/40 hover:border-primary/50 transition-colors shadow-none">
                                    <div className="aspect-video relative bg-muted flex items-center justify-center isolate">
                                        <div className="absolute inset-x-0 bottom-0 h-10 bg-black/60 backdrop-blur-sm z-10 flex flex-col justify-center px-3 tracking-tight group-hover:bg-primary/90 transition-colors">
                                            <span className="text-white font-semibold flex items-center gap-2 text-sm">
                                                <IconPlaylist size={16} />
                                                {playlist.videoCount}
                                            </span>
                                        </div>
                                        {playlist.thumbnailUrl ? (
                                            <Image 
                                                src={getMediaUrl(playlist.thumbnailUrl)}
                                                alt={playlist.title}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform"
                                            />
                                        ) : (
                                            <IconPlaylist className="w-10 h-10 text-muted-foreground/30" />
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <h3 className="font-semibold text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                                            {playlist.title}
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-1 truncate">
                                            By {playlist.channels?.name || "Unknown"}
                                        </p>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Videos Section */}
            {videos.length > 0 && (
                <section className="space-y-4">
                    <h2 className="text-lg font-bold tracking-tight mb-4 border-b border-border/40 pb-2">
                        Videos
                    </h2>
                    <VideoGrid videos={videos} />
                    
                    {hasNextPage && (
                        <div ref={ref} className="h-24 w-full flex items-center justify-center mt-8">
                            {isFetchingNextPage ? (
                                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <div className="h-2 w-2 bg-foreground/20 rounded-full animate-pulse" />
                            )}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
