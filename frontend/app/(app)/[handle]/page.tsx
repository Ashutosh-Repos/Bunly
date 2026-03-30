"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc-client";
import { VideoGrid } from "@/components/custom/video-grid";
import { IconVideo, IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ChannelHomePage({ params }: { params: Promise<{ handle: string }> }) {
    const { handle } = use(params);
    const decodedHandle = decodeURIComponent(handle);
    const cleanHandle = decodedHandle.slice(1);

    const { data: channelData } = trpc.channel.getChannelByHandle.useQuery({ handle: cleanHandle });
    const channelId = channelData?.channel.id;

    // Fetch latest 10 videos (not paginated)
    const { data: videosData, isLoading: videosLoading } = trpc.feed.getChannelVideos.useInfiniteQuery(
        { channelId: channelId! },
        { 
            enabled: !!channelId,
            getNextPageParam: (lastPage) => lastPage.nextCursor
        }
    );
    
    // Fetch latest 5 Shorts
    const { data: shortsData, isLoading: shortsLoading } = trpc.feed.getChannelShorts.useInfiniteQuery(
        { channelId: channelId! },
        { 
            enabled: !!channelId,
            getNextPageParam: (lastPage) => lastPage.nextCursor
        }
    );

    if (!channelId || videosLoading || shortsLoading) return <div className="animate-pulse h-64 bg-muted/20 rounded-xl" />;

    const videos = videosData?.pages[0]?.videos || [];
    const shorts = shortsData?.pages[0]?.videos || [];

    if (videos.length === 0 && shorts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground mt-8">
                <IconVideo className="w-12 h-12 mb-4 opacity-20" />
                <h3 className="text-lg font-bold text-foreground">Welcome to {channelData.channel.name}</h3>
                <p>This channel doesn&apos;t have any content yet.</p>
            </div>
        );
    }

    return (
        <div className="w-full pb-24 space-y-12">
            
            {/* Latest Videos Row */}
            {videos.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center gap-1 group w-max">
                        <Link href={`/${decodedHandle}/videos`} className="text-[17px] font-bold tracking-tight hover:text-primary transition-colors flex items-center gap-1">
                            Videos
                            <IconChevronRight size={18} className="opacity-70 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                    
                    <VideoGrid videos={videos.slice(0, 10)} />
                </section>
            )}

            {/* Latest Shorts Row */}
            {shorts.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center gap-1 group w-max">
                        <Link href={`/${decodedHandle}/shorts`} className="text-[17px] font-bold tracking-tight hover:text-primary transition-colors flex items-center gap-1">
                            Shorts
                            <IconChevronRight size={18} className="opacity-70 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                    
                    <style jsx global>{`
                        .home-shorts-grid .aspect-video {
                            aspect-ratio: 9 / 16 !important;
                            height: auto !important;
                        }
                    `}</style>
                    <div className="home-shorts-grid">
                        <VideoGrid videos={shorts.slice(0, 10)} />
                    </div>
                </section>
            )}

            {/* View Full Channel Profile Link */}
            <div className="w-full flex justify-center pt-8 border-t border-border/40">
                <Link href={`/${decodedHandle}/videos`}>
                    <Button variant="outline" className="rounded-full px-8">
                        View all videos
                    </Button>
                </Link>
            </div>

        </div>
    );
}
