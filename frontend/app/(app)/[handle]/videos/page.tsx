"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc-client";
import { VideoGrid } from "@/components/custom/video-grid";
import { IconVideo } from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";
import { useEffect } from "react";

export default function ChannelVideosPage({ params }: { params: Promise<{ handle: string }> }) {
    const { handle } = use(params);
    const cleanHandle = decodeURIComponent(handle).slice(1);

    const { data: channelData } = trpc.channel.getChannelByHandle.useQuery({ handle: cleanHandle });
    const channelId = channelData?.channel.id;

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = trpc.feed.getChannelVideos.useInfiniteQuery(
        { channelId: channelId! },
        { 
            enabled: !!channelId,
            getNextPageParam: (l) => l.nextCursor,
        }
    );

    const { ref, inView } = useInView({ threshold: 0 });

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    if (!channelId || isLoading) return <div className="animate-pulse h-64 bg-muted/20 rounded-xl" />;

    const videos = data?.pages.flatMap(p => p.videos) || [];

    if (videos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground mt-8">
                <IconVideo className="w-12 h-12 mb-4 opacity-20" />
                <h3 className="text-lg font-bold text-foreground">No videos</h3>
                <p>This channel has no public videos yet.</p>
            </div>
        );
    }

    return (
        <div className="w-full pb-20">
            <VideoGrid videos={videos} />
            
            {hasNextPage && (
                <div ref={ref} className="h-24 w-full flex items-center justify-center mt-8">
                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    );
}
