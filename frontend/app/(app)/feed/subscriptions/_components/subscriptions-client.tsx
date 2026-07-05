"use client";

import { useEffect } from "react";
import { trpc } from "@/lib/trpc-client";
import { useInView } from "react-intersection-observer";
import { VideoGrid } from "@/components/custom/video-grid";
import { IconBellOff, IconVideo } from "@tabler/icons-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SubscriptionsClient() {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = trpc.feed.getSubscriptionsFeed.useInfiniteQuery(
        {},
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        }
    );

    const { ref, inView } = useInView({ threshold: 0, rootMargin: "400px" });

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const videos = data?.pages.flatMap((p) => p.videos) || [];

    if (isLoading) {
         return (
             <div className="w-full">
                 <VideoGrid isLoading={true} />
             </div>
         );
    }

    if (videos.length === 0) {
         return (
             <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/10 min-h-[50vh]">
                 <IconBellOff className="w-16 h-16 text-muted-foreground/30 mb-6" />
                 <h2 className="text-2xl font-bold mb-2">Your feed is empty</h2>
                 <p className="text-muted-foreground mb-8 max-w-sm">
                     You aren&apos;t subscribed to any active channels, or the channels you&apos;ve subbed to haven&apos;t posted any videos yet.
                 </p>
                 <Link href="/">
                     <Button className="rounded-full font-bold px-8">Explore Videos</Button>
                 </Link>
             </div>
         );
    }

    return (
        <div className="flex flex-col w-full pb-20">
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
            
            {!hasNextPage && videos.length > 0 && (
                <div className="text-center mt-16 pb-8 text-muted-foreground font-medium flex items-center justify-center gap-2">
                    <IconVideo size={20} className="opacity-50" />
                    You&apos;ve reached the end of your feed
                </div>
            )}
        </div>
    );
}
