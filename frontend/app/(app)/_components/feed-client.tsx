"use client";

import { useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc-client";
import { useInView } from "react-intersection-observer";
import { VideoGrid, type VideoGridVideo } from "@/components/custom/video-grid";
import { CommunityCard } from "@/components/custom/community-card";
import { ShortsShelf } from "@/components/custom/shorts-shelf";
import { SubscribedChannelBar } from "@/components/custom/subscribed-channel-bar";
import { IconFlame, IconVideo } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import type { RouterOutputs } from "@/lib/trpc-client";

type FeedOutput = RouterOutputs["feed"]["getHomeFeed"];

interface FeedClientProps {
    initialData: FeedOutput;
    type: "home" | "trending";
}

// Number of videos between each community post insertion
const POST_INTERVAL = 10;
// After how many videos to start inserting posts (0-indexed row count)
const FIRST_POST_AT = 5;

export function FeedClient({ initialData, type }: FeedClientProps) {
    // Home feed infinite query
    const homeFeed = trpc.feed.getHomeFeed.useInfiniteQuery(
        {},
        {
            initialData: type === "home" ? {
                pages: [initialData],
                pageParams: [undefined],
            } : undefined,
            getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
            staleTime: 1000 * 60 * 5, // 5 min
            enabled: type === "home",
        }
    );

    // Trending feed infinite query
    const trendingFeed = trpc.feed.getTrendingFeed.useInfiniteQuery(
        {},
        {
            initialData: type === "trending" ? {
                pages: [initialData],
                pageParams: [undefined],
            } : undefined,
            getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
            staleTime: 1000 * 60 * 5, // 5 min
            enabled: type === "trending",
        }
    );

    // Fetch community posts for interleaving (only on home feed)
    const communityPosts = trpc.feed.getCommunityPostsForFeed.useQuery(
        { limit: 4 },
        {
            enabled: type === "home",
            staleTime: 1000 * 60 * 10, // 10 min — posts don't change as fast as videos
        }
    );

    // Fetch shorts for the shelf (only on home feed)
    const shortsQuery = trpc.feed.getHomeShorts.useInfiniteQuery(
        {},
        {
            enabled: type === "home",
            staleTime: 1000 * 60 * 5,
            getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        }
    );
    const shortsVideos = useMemo(() => shortsQuery.data?.pages[0]?.videos || [], [shortsQuery.data]);

    const query = type === "home" ? homeFeed : trendingFeed;

    const { ref, inView } = useInView({ threshold: 0, rootMargin: "400px" });

    useEffect(() => {
        if (inView && query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inView, query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

    const videos = useMemo(() => query.data?.pages.flatMap((p) => p.videos) || [], [query.data]);
    const posts = useMemo(() => communityPosts.data || [], [communityPosts.data]);

    // Build a mixed feed: interleave community posts and shorts shelf between chunks of videos
    type FeedChunk =
        | { type: "videos"; videos: VideoGridVideo[] }
        | { type: "post"; post: (typeof posts)[number] }
        | { type: "shorts"; shorts: VideoGridVideo[] };

    const feedChunks = useMemo(() => {
        if (type !== "home" || (posts.length === 0 && shortsVideos.length === 0)) {
            return [{ type: "videos" as const, videos }];
        }

        const chunks: FeedChunk[] = [];
        let postIdx = 0;
        let shortsInserted = false;

        let i = 0;
        while (i < videos.length) {
            const isFirstChunk = i === 0;
            const chunkEnd = isFirstChunk ? FIRST_POST_AT : i + POST_INTERVAL;
            const videoSlice = videos.slice(i, Math.min(chunkEnd, videos.length));

            if (videoSlice.length > 0) {
                chunks.push({ type: "videos", videos: videoSlice });
            }

            // Insert a community post after this chunk
            if (postIdx < posts.length && videoSlice.length > 0) {
                chunks.push({ type: "post", post: posts[postIdx] });
                postIdx++;

                // Insert shorts shelf after the first community post
                if (!shortsInserted && shortsVideos.length >= 4) {
                    chunks.push({ type: "shorts", shorts: shortsVideos });
                    shortsInserted = true;
                }
            }

            // Move pointer
            if (isFirstChunk) {
                i = FIRST_POST_AT;
            } else {
                i += POST_INTERVAL;
            }
        }

        // If no community posts but we have shorts, still insert after first video chunk
        if (!shortsInserted && shortsVideos.length >= 4 && chunks.length > 0) {
            chunks.splice(1, 0, { type: "shorts", shorts: shortsVideos });
        }

        return chunks;
    }, [videos, posts, shortsVideos, type]);

    return (
        <div className="flex flex-col w-full pb-20">
            {type === "home" && (
                <div className="mb-2">
                    <SubscribedChannelBar />
                </div>
            )}
            
            <div className="pt-4 px-4 sm:px-8">
                {query.isLoading && videos.length === 0 ? (
                    <VideoGrid isLoading={true} />
                ) : query.isError ? (
                    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                        <p className="text-destructive font-bold text-lg tracking-tight">Failed to load feed</p>
                        <Button variant="outline" className="mt-4 rounded-full" onClick={() => query.refetch()}>Retry</Button>
                    </div>
                ) : videos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/10 min-h-[50vh] mt-4">
                        <IconFlame className="w-16 h-16 text-muted-foreground/30 mb-6" />
                        <h2 className="text-2xl font-bold mb-2 tracking-tight">No videos found</h2>
                        <p className="text-muted-foreground font-medium">Check back later for new content.</p>
                    </div>
                ) : (
                    <>
                        {feedChunks.map((chunk, idx) => {
                            if (chunk.type === "videos") {
                                return <VideoGrid key={`vg-${idx}`} videos={chunk.videos} />;
                            }
                            if (chunk.type === "shorts") {
                                return <ShortsShelf key="shorts-shelf" shorts={chunk.shorts} />;
                            }
                            // Community post — spans the full width as a "break" between video rows
                            return (
                                <div key={`cp-${chunk.post.id}`} className="max-w-3xl mx-auto my-8">
                                    <CommunityCard post={chunk.post} />
                                </div>
                            );
                        })}
                        
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
