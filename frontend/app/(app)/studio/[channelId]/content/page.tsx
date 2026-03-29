"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
import { useParams } from "next/navigation";
import { ProcessingStatusIndicator } from "@/components/custom/processing-status";
import { getMediaUrl } from "@/lib/utils";
import Image from "next/image";
import { format } from "date-fns";
import { formatDuration } from "@/lib/utils";
import { IconFilter, IconVideo } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUpload } from "@/components/providers/upload-provider";
import { useRouter } from "next/navigation";
import { IconDotsVertical, IconTrash, IconEdit, IconLoader2, IconPlaylist } from "@tabler/icons-react";
import { toast } from "sonner";
import { StudioPlaylistsTab } from "./_components/studio-playlists-tab";
import { SaveToPlaylistModal } from "@/components/custom/save-to-playlist-modal";

export default function StudioContentPage() {
    const params = useParams();
    const channelId = params.channelId as string;
    const { openModal } = useUpload();
    
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState<"videos" | "playlists">("videos");

    const router = useRouter();

    const { data, isLoading, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = trpc.video.getChannelContent.useInfiniteQuery(
        { channelId, limit: 20, search: search || undefined },
        { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );

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
        if (!el) return;
        const observer = new IntersectionObserver(handleIntersect, { rootMargin: "200px" });
        observer.observe(el);
        return () => observer.disconnect();
    }, [handleIntersect]);

    const deleteMutation = trpc.video.deleteVideos.useMutation({
        onSuccess: () => {
            toast.success("Video deleted forever");
            refetch();
        },
        onError: (err) => {
            toast.error("Failed to delete: " + err.message);
        }
    });

    const handleDelete = (e: React.MouseEvent, videoId: string) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to permanently delete this video?")) {
            deleteMutation.mutate({ channelId, videoIds: [videoId] });
        }
    };

    const videos = data?.pages.flatMap(p => p.items) || [];

    return (
        <div className="flex flex-col h-full bg-background p-6 lg:p-10 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Channel content</h1>
            </div>

            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-sm">
                    <IconFilter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Filter videos..." 
                        className="pl-9 bg-muted/50"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex gap-6 border-b border-border/40 mb-6 font-medium text-sm">
                <button 
                    onClick={() => setActiveTab("videos")}
                    className={`pb-3 relative transition-colors ${activeTab === "videos" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                    Videos
                    {activeTab === "videos" && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary rounded-t-sm" />}
                </button>
                <button 
                    onClick={() => setActiveTab("playlists")}
                    className={`pb-3 relative transition-colors ${activeTab === "playlists" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                    Playlists
                    {activeTab === "playlists" && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary rounded-t-sm" />}
                </button>
            </div>

            {activeTab === "videos" && (
                <div className="border rounded-lg overflow-hidden bg-card">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[400px]">Video</TableHead>
                            <TableHead>Visibility</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Views</TableHead>
                            <TableHead className="text-right">Comments</TableHead>
                            <TableHead className="text-right">Likes (vs)</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center h-32 text-muted-foreground">
                                    <IconLoader2 className="animate-spin mx-auto mb-2" />
                                    Loading your videos...
                                </TableCell>
                            </TableRow>
                        ) : videos.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <IconVideo size={32} className="opacity-20 mb-2" />
                                        <p>No videos found</p>
                                        <Button variant="outline" size="sm" onClick={() => openModal()} className="mt-2">
                                            Upload Video
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            videos.map((video) => (
                                <TableRow 
                                    key={video.id} 
                                    className={`group cursor-pointer transition-colors ${
                                        video.processingStatus === "FAILED"
                                            ? "bg-destructive/5 hover:bg-destructive/10"
                                            : "hover:bg-muted/30"
                                    }`}
                                    onClick={() => router.push(`/studio/${channelId}/content/${video.id}`)}
                                >
                                    <TableCell className="font-medium">
                                        <div className="flex gap-4 items-center">
                                            <div className="relative aspect-video w-28 bg-muted rounded overflow-hidden shrink-0 flex items-center justify-center">
                                                {video.thumbnailUrl ? (
                                                    <Image 
                                                        src={getMediaUrl(video.thumbnailUrl)} 
                                                        alt={video.title} 
                                                        fill
                                                        className="object-cover"
                                                        sizes="(max-width: 768px) 112px, 112px"
                                                    />
                                                ) : (
                                                    <IconVideo size={20} className="text-muted-foreground/30" />
                                                )}
                                                
                                                {/* Overlay duration */}
                                                {(video.duration || 0) > 0 && (
                                                    <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded font-medium">
                                                        {formatDuration(video.duration)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="truncate block font-semibold text-sm mb-0.5" title={video.title}>
                                                    {video.title}
                                                </span>
                                                <span className="truncate block text-xs text-muted-foreground max-w-[200px]" title={video.description || ""}>
                                                    {video.description || "Add description"}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-xs capitalize font-medium ${video.visibility === "PUBLIC" ? "text-green-500" : "text-muted-foreground"}`}>
                                            {video.visibility.toLowerCase()}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {/* Injecting the WebSocket Processing Status Tracker */}
                                        <ProcessingStatusIndicator 
                                            videoId={video.id} 
                                            initialStatus={video.processingStatus as "PENDING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED"} 
                                        />
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        <div className="flex flex-col text-xs">
                                            {video.publishedAt ? (
                                                <>
                                                    <span>{format(new Date(video.publishedAt), "MMM d, yyyy")}</span>
                                                    <span className="text-green-500">Published</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>{format(new Date(video.createdAt), "MMM d, yyyy")}</span>
                                                    <span className="text-muted-foreground">Uploaded</span>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-sm">{video.viewCount.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-sm">{video.commentCount.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-sm">
                                        {video.likeCount > 0 ? (
                                            <div className="flex flex-col items-end">
                                                <span>{video.likeCount}</span>
                                                <div className="h-1 w-full bg-muted mt-1 rounded-full overflow-hidden max-w-[60px]">
                                                    {/* We don't have dislikes counted directly in this DTO, so we handle UI accordingly */}
                                                    <div 
                                                        className="h-full bg-foreground w-full" 
                                                    />
                                                </div>
                                            </div>
                                        ) : "-"}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <IconDotsVertical size={16} />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/studio/${channelId}/content/${video.id}`);
                                                }}>
                                                    <IconEdit size={16} className="mr-2" /> Edit Video
                                                </DropdownMenuItem>
                                                <SaveToPlaylistModal 
                                                    videoId={video.id} 
                                                    trigger={
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                            <IconPlaylist size={16} className="mr-2" /> Add to playlist
                                                        </DropdownMenuItem>
                                                    }
                                                />
                                                <DropdownMenuItem 
                                                    className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                                                    onClick={(e) => handleDelete(e, video.id)}
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    <IconTrash size={16} className="mr-2" /> Delete Forever
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            )}

            {/* Infinite scroll sentinel */}
            {activeTab === "videos" && hasNextPage && (
                <div ref={sentinelRef} className="flex justify-center py-4">
                    {isFetchingNextPage && <IconLoader2 className="animate-spin text-muted-foreground" />}
                </div>
            )}

            {activeTab === "playlists" && (
                <StudioPlaylistsTab channelId={channelId} search={search} />
            )}
        </div>
    );
}
