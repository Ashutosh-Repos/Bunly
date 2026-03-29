import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { getMediaUrl, formatDuration } from "@/lib/utils";
import { IconVideo } from "@tabler/icons-react";

export interface CompactVideoProp {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    duration: number | null;
    viewCount: number;
    publishedAt?: string | Date | null;
    createdAt?: string | Date | null;
    author?: {
        name: string;
    } | null;
    channelName?: string | null;
}

export function CompactVideoCard({ video }: { video: CompactVideoProp }) {
    const displayDate = video.publishedAt ?? video.createdAt;
    const authorName = video.author?.name || video.channelName;
    
    return (
        <Link href={`/watch/${video.id}`} className="flex gap-2 group cursor-pointer w-full">
            <div className="w-[160px] aspect-video bg-muted/40 rounded-lg shrink-0 relative overflow-hidden ring-1 ring-border/10 group-hover:ring-primary/50 transition-all">
                {video.thumbnailUrl ? (
                    <Image
                        src={getMediaUrl(video.thumbnailUrl)}
                        alt={video.title}
                        fill
                        className="object-cover"
                        sizes="160px"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <IconVideo size={20} className="text-muted-foreground/30" />
                    </div>
                )}
                {(video.duration ?? 0) > 0 && (
                    <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded font-medium">
                        {formatDuration(video.duration)}
                    </span>
                )}
            </div>
            <div className="flex flex-col py-1 min-w-0">
                <span className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {video.title}
                </span>
                <span className="text-xs text-muted-foreground mt-1 truncate">{authorName}</span>
                <span className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">
                    {video.viewCount.toLocaleString()} views
                    {displayDate && ` • ${formatDistanceToNow(new Date(displayDate), { addSuffix: true })}`}
                </span>
            </div>
        </Link>
    );
}

export function CompactVideoCardSkeleton() {
    return (
        <div className="flex gap-2 animate-pulse w-full mb-2">
            <div className="w-[160px] aspect-video bg-muted/40 rounded-lg shrink-0" />
            <div className="flex flex-col py-1 gap-2 flex-1">
                <div className="h-3 bg-muted rounded w-5/6" />
                <div className="h-2 bg-muted rounded w-3/6" />
                <div className="h-2 bg-muted rounded w-2/6" />
            </div>
        </div>
    );
}
