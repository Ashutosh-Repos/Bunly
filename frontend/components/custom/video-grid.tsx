import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { getMediaUrl, formatDuration } from "@/lib/utils";
import { IconVideo } from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Video {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    duration: number | null;
    viewCount: number;
    publishedAt?: string | Date | null;
    createdAt: string | Date;
    channels?: {
        name: string | null;
        image?: string | null;
    } | null;
}

interface VideoGridProps {
    videos?: Video[];
    isLoading?: boolean;
}

export function VideoGrid({ videos = [], isLoading = false }: VideoGridProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-3 animate-pulse">
                        <div className="w-full aspect-video bg-muted/40 rounded-xl" />
                        <div className="flex gap-3 px-1">
                            <div className="w-9 h-9 rounded-full bg-muted/40 shrink-0" />
                            <div className="flex flex-col gap-2 flex-1">
                                <div className="h-4 bg-muted rounded w-5/6" />
                                <div className="h-3 bg-muted rounded w-3/4" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
            {videos.map((video) => {
                const displayDate = video.publishedAt ?? video.createdAt;
                return (
                    <div key={video.id} className="flex flex-col gap-3 group cursor-pointer">
                        <Link href={`/watch/${video.id}`} className="relative w-full aspect-video bg-muted/20 rounded-xl overflow-hidden ring-1 ring-border/10 group-hover:ring-primary/30 transition-all">
                            {video.thumbnailUrl ? (
                                <Image
                                    src={getMediaUrl(video.thumbnailUrl)}
                                    alt={video.title}
                                    fill
                                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <IconVideo size={32} className="text-muted-foreground/30" />
                                </div>
                            )}
                            {(video.duration ?? 0) > 0 && (
                                <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded shadow-sm">
                                    {formatDuration(video.duration)}
                                </span>
                            )}
                        </Link>

                        <div className="flex gap-3 px-1">
                            {video.channels?.image ? (
                                <Avatar className="w-9 h-9 border shadow-sm shrink-0">
                                    <AvatarImage src={getMediaUrl(video.channels.image)} />
                                    <AvatarFallback className="text-[10px] font-bold">
                                        {(video.channels.name || "C").slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <span className="text-primary text-[10px] font-bold">
                                        {video.channels?.name?.slice(0, 2).toUpperCase() || "C"}
                                    </span>
                                </div>
                            )}
                            <div className="flex flex-col min-w-0">
                                <Link href={`/watch/${video.id}`} className="font-semibold text-[15px] leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                                    {video.title}
                                </Link>
                                <span className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                    {video.channels?.name || "Unknown channel"}
                                </span>
                                <span className="text-xs text-muted-foreground/80 mt-0.5">
                                    {video.viewCount.toLocaleString()} views • {formatDistanceToNow(new Date(displayDate), { addSuffix: true })}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
