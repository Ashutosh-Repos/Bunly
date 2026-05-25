"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc-client";
import { IconPlus, IconCheck, IconSearch, IconVideo, IconLoader2 } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { getMediaUrl, formatDuration } from "@/lib/utils";

interface AddVideosModalProps {
    playlistId: string;
    channelId: string;
}

export function AddVideosModal({ playlistId, channelId }: AddVideosModalProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    
    const utils = trpc.useUtils();
    
    // 1. Fetch current playlist videos to know what's already added
    const { data: playlistVideosData } = trpc.playlist.getPlaylistVideos.useQuery(
        { playlistId, limit: 100 },
        { enabled: open }
    );
    const existingVideoIds = new Set(playlistVideosData?.videos.map(v => v.id) || []);

    // 2. Fetch all channel videos for selection
    const { 
        data: channelVideosData, 
        isLoading, 
        fetchNextPage, 
        hasNextPage, 
        isFetchingNextPage 
    } = trpc.video.getChannelContent.useInfiniteQuery(
        { channelId, limit: 20, search: search || undefined },
        { 
            enabled: open,
            getNextPageParam: (lastPage) => lastPage.nextCursor 
        }
    );

    const addMutation = trpc.playlist.addVideoToPlaylist.useMutation({
        onSuccess: () => {
            utils.playlist.getPlaylistVideos.invalidate({ playlistId });
            utils.playlist.getPublicPlaylist.invalidate({ playlistId });
        },
        onError: (err) => toast.error(err.message)
    });

    const removeMutation = trpc.playlist.removeVideoFromPlaylist.useMutation({
        onSuccess: () => {
            utils.playlist.getPlaylistVideos.invalidate({ playlistId });
            utils.playlist.getPublicPlaylist.invalidate({ playlistId });
        },
        onError: (err) => toast.error(err.message)
    });

    const toggleVideo = (videoId: string, isAdded: boolean) => {
        if (isAdded) {
            removeMutation.mutate({ playlistId, videoId });
        } else {
            addMutation.mutate({ playlistId, videoId });
        }
    };

    const videos = channelVideosData?.pages.flatMap(p => p.items) || [];

    // Infinite scroll sentinel
    const sentinelRef = useRef<HTMLDivElement>(null);
    const handleIntersect = useCallback(
        (entries: IntersectionObserverEntry[]) => {
            if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
            }
        },
        [fetchNextPage, hasNextPage, isFetchingNextPage]
    );

    useEffect(() => {
        const el = sentinelRef.current;
        if (!el || !open) return;
        const observer = new IntersectionObserver(handleIntersect, { rootMargin: "100px" });
        observer.observe(el);
        return () => observer.disconnect();
    }, [handleIntersect, open]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <IconPlus size={18} /> Add videos
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>Add videos to playlist</DialogTitle>
                    <div className="relative mt-4">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search your videos..." 
                            className="pl-9 bg-muted/50"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </DialogHeader>
                
                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="p-6 pt-2 space-y-2">
                            {isLoading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                                    <IconLoader2 className="animate-spin mb-4" size={32} />
                                    <p>Loading your videos...</p>
                                </div>
                            ) : videos.length === 0 ? (
                                <div className="py-20 text-center text-muted-foreground">
                                    <IconVideo size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>No videos found</p>
                                </div>
                            ) : (
                                <>
                                    {videos.map((video) => {
                                        const isAdded = existingVideoIds.has(video.id);
                                        const isMutating = 
                                            (addMutation.isPending && addMutation.variables?.videoId === video.id) ||
                                            (removeMutation.isPending && removeMutation.variables?.videoId === video.id);

                                        return (
                                            <div 
                                                key={video.id}
                                                className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50 transition-colors group border border-transparent hover:border-border/50"
                                            >
                                                <button 
                                                    onClick={() => toggleVideo(video.id, isAdded)}
                                                    disabled={isMutating}
                                                    className={`w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                                                        isAdded 
                                                            ? "bg-primary border-primary text-primary-foreground" 
                                                            : "border-input bg-background"
                                                    } ${isMutating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                                >
                                                    {isAdded && <IconCheck size={14} stroke={3} />}
                                                </button>

                                                <div className="relative aspect-video w-32 bg-muted rounded overflow-hidden shrink-0">
                                                    {video.thumbnailUrl ? (
                                                        <Image
                                                            src={getMediaUrl(video.thumbnailUrl)}
                                                            alt={video.title}
                                                            fill
                                                            unoptimized
                                                            className="object-cover"
                                                            sizes="128px"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <IconVideo size={20} className="text-muted-foreground/30" />
                                                        </div>
                                                    )}
                                                    {(video.duration || 0) > 0 && (
                                                        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] px-1 rounded font-medium">
                                                            {formatDuration(video.duration)}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0 pr-4">
                                                    <p className="font-semibold text-sm line-clamp-2 leading-snug">
                                                        {video.title}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {video.viewCount.toLocaleString()} views
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Sentinel */}
                                    {hasNextPage && (
                                        <div ref={sentinelRef} className="flex justify-center py-4">
                                            {isFetchingNextPage && <IconLoader2 className="animate-spin text-muted-foreground h-5 w-5" />}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                <div className="p-6 border-t bg-muted/30">
                    <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
