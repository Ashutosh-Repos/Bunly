import { VideoCard, VideoCardSkeleton } from "@/components/custom/video-card";
import type { RouterOutputs } from "@/lib/trpc-client";

export type VideoGridVideo = RouterOutputs["feed"]["getHomeFeed"]["videos"][number];

interface VideoGridProps {
    videos?: VideoGridVideo[];
    isLoading?: boolean;
}

export function VideoGrid({ videos = [], isLoading = false }: VideoGridProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array.from({ length: 15 }).map((_, i) => (
                    <VideoCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
            {videos.map((video, index) => (
                <VideoCard key={video.id} video={video} index={index} />
            ))}
        </div>
    );
}

