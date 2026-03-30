"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { VideoGrid } from "@/components/custom/video-grid";
import { IconSearch, IconUser, IconPlaylist } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { AuthorAvatar, AuthorName } from "@/components/custom/author-display";
import Link from "next/link";
import { PlaylistCard } from "@/components/custom/playlist-card";
import { Card } from "@/components/ui/card";
import { getMediaUrl } from "@/lib/utils";
import { useEffect, useCallback } from "react";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";
import {
    SearchFilters,
    type SearchFilterValues,
    type SortBy,
    type UploadDate,
    type Duration,
} from "@/components/custom/search-filters";

import type { RouterOutputs } from "@/lib/trpc-client";

type SearchOutput = RouterOutputs["search"]["globalSearch"];

interface SearchClientProps {
    initialSearchData: SearchOutput | null;
}

export function SearchClient({ initialSearchData }: SearchClientProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const rawQuery = searchParams.get("q") || "";
    // Remove characters that might break Postgres tsquery parsing before we send it to trpc
    const query = rawQuery.replace(/[&|!():*<>\\]/g, " ").replace(/\s+/g, " ").trim();

    // Read filter state from URL params
    const sortBy = (searchParams.get("sort") as SortBy) || "relevance";
    const uploadDate = (searchParams.get("date") as UploadDate) || undefined;
    const duration = (searchParams.get("dur") as Duration) || undefined;

    const filterValues: SearchFilterValues = { sortBy, uploadDate, duration };

    // Sync filter changes to URL
    const handleFilterChange = useCallback((newValues: SearchFilterValues) => {
        const params = new URLSearchParams(searchParams.toString());

        if (newValues.sortBy !== "relevance") {
            params.set("sort", newValues.sortBy);
        } else {
            params.delete("sort");
        }

        if (newValues.uploadDate) {
            params.set("date", newValues.uploadDate);
        } else {
            params.delete("date");
        }

        if (newValues.duration) {
            params.set("dur", newValues.duration);
        } else {
            params.delete("dur");
        }

        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, router, pathname]);

    const hasFilters = sortBy !== "relevance" || uploadDate !== undefined || duration !== undefined;

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = trpc.search.globalSearch.useInfiniteQuery(
        { query, filter: "ALL", sortBy, uploadDate, duration },
        {
            initialData: initialSearchData && !hasFilters ? {
                pages: [initialSearchData],
                pageParams: [undefined],
            } : undefined,
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

    // Only show loading if we don't have initial data for the current query
    const showLoading = isLoading && !data;

    if (showLoading) {
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

    const noResults = channels.length === 0 && playlists.length === 0 && videos.length === 0 && !isLoading;

    if (noResults) {
        return (
            <div className="w-full max-w-[1400px] mx-auto p-4 sm:p-8 pb-24 space-y-6">
                <SearchFilters values={filterValues} onChange={handleFilterChange} />
                <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
                    <IconSearch className="w-12 h-12 text-muted-foreground/30 mb-4" />
                    <h2 className="text-xl font-bold tracking-tight">No results found for &quot;{rawQuery}&quot;</h2>
                    <p className="text-muted-foreground mt-2">
                        {hasFilters ? "Try removing some filters or using different keywords." : "Try different or shorter keywords."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1400px] mx-auto p-4 sm:p-8 pb-24 space-y-8">
            <div className="space-y-4">
                <h1 className="text-xl font-bold tracking-tight text-muted-foreground">
                    Search results for <span className="text-foreground">&quot;{rawQuery}&quot;</span>
                </h1>
                <SearchFilters values={filterValues} onChange={handleFilterChange} />
            </div>

            {/* Channels Section — Featured Top Match (only when no filters active) */}
            {channels.length > 0 && !hasFilters && (
                <section className="space-y-4">
                    <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 mb-4">
                        <IconUser className="w-5 h-5 text-primary" /> Channels
                    </h2>
                    <div className="flex flex-col gap-4">
                        {channels.map((channel, idx) => (
                            <Link key={channel.id} href={`/@${channel.handle}`} className="group cursor-pointer">
                                <Card className={cn(
                                    "flex flex-col sm:flex-row items-center gap-6 p-6 transition-all border-border/40",
                                    idx === 0 
                                        ? "bg-primary/5 border-primary/20 hover:bg-primary/10 shadow-sm" 
                                        : "bg-transparent border-none shadow-none hover:bg-muted/30"
                                )}>
                                    <AuthorAvatar 
                                        author={channel} 
                                        disableLink 
                                        className={cn(
                                            "border group-hover:scale-105 transition-transform",
                                            idx === 0 ? "w-32 h-32" : "w-20 h-20"
                                        )} 
                                    />
                                    <div className="flex flex-col items-center sm:items-start text-center sm:text-left overflow-hidden flex-1">
                                        {idx === 0 && (
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Top Match</span>
                                        )}
                                        <AuthorName 
                                            author={channel} 
                                            disableLink
                                            className={cn(
                                                "font-bold leading-none mb-1 group-hover:text-primary transition-colors truncate w-full",
                                                idx === 0 ? "text-2xl" : "text-lg"
                                            )} 
                                        />
                                        <p className="text-muted-foreground text-sm font-medium mb-2 truncate w-full">
                                            @{channel.handle}
                                        </p>
                                        <p className="text-sm text-muted-foreground/80">
                                            <span className="font-bold text-foreground/80">{channel.subscriberCount.toLocaleString()}</span> subscribers • <span className="font-bold text-foreground/80">{channel.videoCount}</span> videos
                                        </p>
                                    </div>
                                    <div className={cn(
                                        "sm:ml-auto transition-opacity",
                                        idx === 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                    )}>
                                        <Button variant={channel.isSubscribed ? "secondary" : "default"} size="sm" className="rounded-full font-bold shadow-none px-6">
                                            {channel.isSubscribed ? "Subscribed" : "Subscribe"}
                                        </Button>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Playlists Section (only when no filters active) */}
            {playlists.length > 0 && !hasFilters && (
                <section className="space-y-4">
                    <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 border-b border-border/40 pb-2">
                        <IconPlaylist className="w-5 h-5 text-primary" /> Playlists
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pt-2">
                        {playlists.map((playlist) => (
                            <PlaylistCard
                                key={playlist.id}
                                id={playlist.id}
                                title={playlist.title}
                                videoCount={playlist.videoCount}
                                firstVideoThumbnail={playlist.firstVideoThumbnail}
                                author={playlist.author}
                            />
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
                    <div className="pt-2">
                        <VideoGrid videos={videos} />
                    </div>
                    
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
