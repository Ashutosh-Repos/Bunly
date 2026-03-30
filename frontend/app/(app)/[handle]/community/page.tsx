"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc-client";
import { IconMessageCircle } from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";
import { useEffect } from "react";
import { CommunityCard } from "@/components/custom/community-card";

export default function ChannelCommunityPage({ params }: { params: Promise<{ handle: string }> }) {
    const { handle } = use(params);
    const cleanHandle = decodeURIComponent(handle).slice(1);

    const channelData = trpc.channel.getChannelByHandle.useQuery({ handle: cleanHandle }).data;
    const channel = channelData?.channel;
    const channelId = channel?.id;

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = trpc.community.getChannelPosts.useInfiniteQuery(
        { channelId: channelId! },
        { 
            enabled: !!channelId,
            getNextPageParam: (l) => l.nextCursor,
        }
    );

    const { ref, inView } = useInView({ threshold: 0, rootMargin: "400px" });

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    if (!channel || isLoading) return <div className="animate-pulse h-64 bg-muted/20 rounded-xl max-w-3xl mx-auto mt-8" />;

    const posts = data?.pages.flatMap(p => p.items) || [];

    if (posts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground mt-8">
                <IconMessageCircle className="w-12 h-12 mb-4 opacity-20" />
                <h3 className="text-lg font-bold text-foreground">No posts yet</h3>
                <p>This channel hasn&apos;t posted to their Community tab.</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto pb-24 space-y-6">
            {posts.map((post) => (
                <CommunityCard key={post.id} post={post} />
            ))}
            
            {hasNextPage && (
                <div ref={ref} className="h-24 w-full flex items-center justify-center mt-8">
                    {isFetchingNextPage ? (
                        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <div className="h-2 w-2 bg-foreground/20 rounded-full animate-pulse" />
                    )}
                </div>
            )}
        </div>
    );
}
