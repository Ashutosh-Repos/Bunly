"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { useInView } from "react-intersection-observer";
import { VideoGrid } from "@/components/custom/video-grid";
import { IconFlame, IconVideo } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEED_TABS = [
    { id: "home", label: "All" },
    { id: "trending", label: "Trending" },
] as const;

export function HomeClient() {
    const [activeTab, setActiveTab] = useState<"home" | "trending">("home");
    
    // Call both hooks unconditionally to satisfy Rules of Hooks
    const homeFeed = trpc.feed.getHomeFeed.useInfiniteQuery(
        {},
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
            staleTime: 1000 * 60 * 5, // 5 min
            enabled: activeTab === "home", // Only fetch when active
        }
    );

    const trendingFeed = trpc.feed.getTrendingFeed.useInfiniteQuery(
        {},
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
            staleTime: 1000 * 60 * 5, // 5 min
            enabled: activeTab === "trending", // Only fetch when active
        }
    );

    const query = activeTab === "home" ? homeFeed : trendingFeed;

    const { ref, inView } = useInView({ threshold: 0, rootMargin: "400px" });

    useEffect(() => {
        if (inView && query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage();
        }
    }, [inView, query]);

    const videos = query.data?.pages.flatMap((p) => p.videos) || [];

    return (
        <div className="flex flex-col w-full pb-20">
            {/* Filter Tabs */}
            <div className="sticky top-14 z-20 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 w-full px-4 sm:px-8 py-3 flex gap-2 border-b border-border/40">
                {FEED_TABS.map((tab) => (
                    <Button
                        key={tab.id}
                        variant={activeTab === tab.id ? "default" : "secondary"}
                        size="sm"
                        className={cn(
                            "rounded-lg font-semibold px-4 transition-all tracking-tight",
                            activeTab === tab.id
                                ? "shadow-sm"
                                : "hover:bg-muted text-muted-foreground",
                        )}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </Button>
                ))}
            </div>

            <div className="pt-4 px-4 sm:px-8">
                {query.isLoading ? (
                    <VideoGrid isLoading={true} />
                ) : query.isError ? (
                    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                        <p className="text-destructive font-bold text-lg tracking-tight">Failed to load feed</p>
                        <Button variant="outline" className="mt-4 rounded-full" onClick={() => query.fetchNextPage()}>Retry</Button>
                    </div>
                ) : videos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/10 min-h-[50vh] mt-4">
                        <IconFlame className="w-16 h-16 text-muted-foreground/30 mb-6" />
                        <h2 className="text-2xl font-bold mb-2 tracking-tight">No videos found</h2>
                        <p className="text-muted-foreground font-medium">Check back later for new content.</p>
                    </div>
                ) : (
                    <>
                        <VideoGrid videos={videos} />
                        
                        {query.hasNextPage && (
                            <div ref={ref} className="h-24 w-full flex items-center justify-center mt-8">
                                {query.isFetchingNextPage ? (
                                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <div className="h-2 w-2 bg-foreground/20 rounded-full animate-pulse" />
                                )}
                            </div>
                        )}
                        
                        {!query.hasNextPage && videos.length > 0 && (
                            <div className="text-center mt-16 pb-8 text-muted-foreground font-medium flex flex-col items-center justify-center gap-2">
                                <IconVideo size={24} className="opacity-20 mb-2" stroke={1.5} />
                                You&apos;ve reached the end!
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
