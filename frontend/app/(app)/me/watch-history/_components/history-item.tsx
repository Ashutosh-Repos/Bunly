"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { IconDotsVertical, IconTrash, IconUser } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMediaUrl, formatDuration } from "@/lib/utils";

// Matches the exact shape returned by HistoryService.fetchHistoryFromDatabase
export interface HistoryItemData {
    id: string;
    videoId: string;
    watchedSeconds?: number | null;
    lastWatchedAt: Date | string;
    videos: {
        id: string;
        duration?: number | null;
        thumbnailUrl: string | null;
        title: string;
        viewCount: number;
        createdAt: Date | string;
        description?: string | null;
        isShort?: boolean | null;
        channels: {
            id: string;
            handle?: string | null;
            name: string;
            image?: string | null;
        };
    };
}

interface HistoryItemProps {
    item: HistoryItemData;
    onRemove: (videoId: string) => void;
}

export const HistoryItem = memo(function HistoryItem({
    item,
    onRemove,
}: HistoryItemProps) {
    const video = item.videos;
    const progressPercent =
        video.duration && item.watchedSeconds
            ? Math.min((item.watchedSeconds / video.duration) * 100, 100)
            : 0;

    const channelHref = `/channel/${video.channels.handle || video.channels.id}`;

    return (
        <article className="flex flex-col sm:flex-row gap-4 group p-3 rounded-xl hover:bg-secondary/40 transition-colors relative border border-transparent hover:border-border/40 hover:shadow-md transform-gpu">
            {/* Thumbnail */}
            <div className="relative aspect-video w-full sm:w-[240px] lg:w-[280px] shrink-0 rounded-xl overflow-hidden bg-muted">
                <Link href={`/watch/${video.id}`} className="block w-full h-full relative">
                    <Image
                        src={getMediaUrl(video.thumbnailUrl)}
                        alt={video.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 240px, 280px"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                        }}
                    />

                    {/* Duration Badge — positioned top-right to avoid clashing with progress bar */}
                    {video.duration && (
                        <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[11px] font-bold tracking-tight text-white/90 shadow-sm">
                            {formatDuration(video.duration)}
                        </div>
                    )}

                    {/* Progress Bar — sits at the very bottom on its own row, doesn't overlap badge */}
                    {progressPercent > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-background/20">
                            <div
                                className="h-full bg-primary"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    )}
                </Link>
            </div>

            {/* Content Info */}
            <div className="flex-1 min-w-0 flex flex-col pt-1">
                <div className="flex items-start gap-2 pr-8">
                    <Link href={`/watch/${video.id}`} className="block min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg font-bold leading-tight line-clamp-2 text-foreground/90 group-hover:text-primary transition-colors tracking-tight">
                            {video.title}
                        </h3>
                    </Link>
                </div>

                {/* Channel Row — avatar + name */}
                <div className="flex items-center gap-2 mt-2">
                    {/* [NEW] Channel avatar rendered from the `channels.image` field the backend actually returns */}
                    <Link href={channelHref} className="shrink-0">
                        {video.channels.image ? (
                            <Image
                                src={getMediaUrl(video.channels.image)}
                                alt={video.channels.name}
                                width={20}
                                height={20}
                                className="rounded-full object-cover"
                            />
                        ) : (
                            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                                <IconUser className="h-3 w-3 text-muted-foreground" stroke={2} />
                            </div>
                        )}
                    </Link>
                    <Link
                        href={channelHref}
                        className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors sm:text-sm truncate"
                    >
                        {video.channels.name}
                    </Link>
                </div>

                {/* View count + upload date */}
                <div className="flex items-center gap-1.5 mt-1 text-[13px] text-muted-foreground/70 font-medium">
                    <span>{video.viewCount.toLocaleString()} views</span>
                    <span className="text-[10px]">•</span>
                    <span>{format(new Date(video.createdAt), "PP")}</span>
                </div>

                {/* Description — desktop only */}
                {video.description && (
                    <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground/70 line-clamp-2 hidden sm:block pr-2">
                        {video.description}
                    </p>
                )}
            </div>

            {/* ⋮ Actions Menu — absolute positioned top-right of the card */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded-full hover:bg-secondary/80 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <IconDotsVertical className="h-4 w-4 text-muted-foreground" stroke={2} />
                        <span className="sr-only">Open actions for {video.title}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 font-sans">
                    <DropdownMenuItem
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(item.videoId);
                        }}
                        className="cursor-pointer font-semibold py-2.5 text-foreground/80 focus:bg-destructive/10 focus:text-destructive"
                    >
                        <IconTrash className="h-4 w-4 mr-2" stroke={2.5} />
                        Remove from watch history
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </article>
    );
});
