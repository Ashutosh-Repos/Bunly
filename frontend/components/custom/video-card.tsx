import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { formatDuration } from "@/lib/utils";
import { IconVideo, IconClock } from "@tabler/icons-react";
import { VideoHoverPreview } from "@/components/custom/video-hover-preview";
import { AuthorAvatar, AuthorName } from "@/components/custom/author-display";
import type { VideoGridVideo } from "./video-grid";

interface VideoCardProps {
    video: VideoGridVideo;
    index: number;
    priority?: boolean;
}

export function VideoCard({ video, index, priority = false }: VideoCardProps) {
    const displayDate = video.publishedAt ?? video.createdAt;
    
    return (
        <div className="flex flex-col gap-3 group cursor-pointer transition-transform duration-200 hover:scale-[1.02]">
            <Link 
                href={`/watch/${video.id}`} 
                className="relative w-full aspect-video bg-muted/20 rounded-xl overflow-hidden ring-1 ring-border/10 group-hover:ring-primary/30 group-hover:shadow-lg group-hover:shadow-primary/5 transition-all"
            >
                <VideoHoverPreview
                    thumbnailUrl={video.thumbnailUrl}
                    previewSprite={video.previewSprite}
                    duration={video.duration}
                    priority={priority || index < 4}
                >
                    {!video.thumbnailUrl && !video.previewSprite && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <IconVideo size={32} className="text-muted-foreground/30" />
                        </div>
                    )}
                    {(video.duration ?? 0) > 0 && (
                        <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded shadow-sm z-10">
                            {formatDuration(video.duration)}
                        </span>
                    )}
                    <button
                        className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 bg-black/70 hover:bg-black/90 text-white p-1.5 rounded-md transition-opacity duration-200"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        aria-label="Watch later"
                        title="Watch later"
                    >
                        <IconClock size={15} />
                    </button>
                </VideoHoverPreview>
            </Link>

            <div className="flex gap-3 px-1">
                <AuthorAvatar author={video.author} className="w-9 h-9" />
                <div className="flex flex-col min-w-0">
                    <Link href={`/watch/${video.id}`} className="font-semibold text-[15px] leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                        {video.title}
                    </Link>
                    <AuthorName author={video.author} className="text-sm text-muted-foreground mt-1 line-clamp-1" />
                    <span className="text-xs text-muted-foreground/80 mt-0.5">
                        {video.viewCount.toLocaleString()} views • {formatDistanceToNow(new Date(displayDate), { addSuffix: true })}
                    </span>
                </div>
            </div>
        </div>
    );
}

export function VideoCardSkeleton() {
    return (
        <div className="flex flex-col gap-3 animate-pulse">
            <div className="w-full aspect-video bg-muted/40 rounded-xl" />
            <div className="flex gap-3 px-1">
                <div className="w-9 h-9 rounded-full bg-muted/40 shrink-0" />
                <div className="flex flex-col gap-2 flex-1">
                    <div className="h-4 bg-muted rounded w-5/6" />
                    <div className="h-3 bg-muted rounded w-3/4" />
                </div>
            </div>
        </div>
    );
}
