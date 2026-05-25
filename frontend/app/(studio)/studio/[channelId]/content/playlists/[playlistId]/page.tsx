"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { useStudio } from "@/app/(studio)/studio/[channelId]/_components/studio-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
    IconArrowUp,
    IconArrowDown,
    IconTrash,
    IconLoader2,
    IconPlaylist,
    IconArrowLeft,
    IconVideo,
    IconCheck,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { getMediaUrl, formatDuration } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { AddVideosModal } from "./_components/add-videos-modal";

type Visibility = "PUBLIC" | "PRIVATE" | "UNLISTED";

export default function PlaylistManagerPage() {
    const params = useParams();
    const playlistId = params.playlistId as string;
    const { channel } = useStudio();

    const utils = trpc.useUtils();

    // Inline editing states
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editDescription, setEditDescription] = useState("");

    // Fetch playlist metadata
    const { data: playlistMeta } = trpc.playlist.getPlaylistById.useQuery(
        { playlistId },
        { enabled: !!playlistId }
    );

    // Fetch playlist videos
    const { data: videosData, isLoading } = trpc.playlist.getPlaylistVideos.useQuery(
        { playlistId, limit: 100 },
        { enabled: !!playlistId }
    );

    const videos = videosData?.videos || [];

    const reorderMutation = trpc.playlist.reorderPlaylistVideos.useMutation({
        onSuccess: () => {
            utils.playlist.getPlaylistVideos.invalidate({ playlistId });
        },
        onError: (err) => toast.error(err.message),
    });

    const removeMutation = trpc.playlist.removeVideoFromPlaylist.useMutation({
        onSuccess: () => {
            toast.success("Video removed from playlist");
            utils.playlist.getPlaylistVideos.invalidate({ playlistId });
            utils.playlist.getPublicChannelPlaylists.invalidate({ channelId: channel.id });
            utils.playlist.getChannelPlaylists.invalidate({ channelId: channel.id });
        },
        onError: (err) => toast.error(err.message),
    });

    const updateDetailsMutation = trpc.playlist.updatePlaylist.useMutation({
        onSuccess: () => {
            toast.success("Playlist updated");
            utils.playlist.getPlaylistById.invalidate({ playlistId });
            utils.playlist.getPublicPlaylist.invalidate({ playlistId });
            utils.playlist.getPublicChannelPlaylists.invalidate({ channelId: channel.id });
            utils.playlist.getChannelPlaylists.invalidate({ channelId: channel.id });
            setIsEditingTitle(false);
            setIsEditingDescription(false);
        },
        onError: (err) => toast.error(err.message),
    });

    const handleMoveUp = (videoId: string, currentPosition: number) => {
        if (currentPosition <= 0) return;
        reorderMutation.mutate({ playlistId, videoId, newPosition: currentPosition - 1 });
    };

    const handleMoveDown = (videoId: string, currentPosition: number) => {
        if (currentPosition >= videos.length - 1) return;
        reorderMutation.mutate({ playlistId, videoId, newPosition: currentPosition + 1 });
    };

    const handleRemove = (videoId: string) => {
        if (confirm("Remove this video from the playlist?")) {
            removeMutation.mutate({ playlistId, videoId });
        }
    };

    const handleVisibilityChange = (v: Visibility) => {
        if (!playlistMeta?.playlist) return;
        updateDetailsMutation.mutate({
            playlistId,
            title: playlistMeta.playlist.title,
            description: playlistMeta.playlist.description || "",
            visibility: v,
            channelId: channel.id,
        });
    };

    const startTitleEdit = () => {
        if (!playlistMeta?.playlist) return;
        setEditTitle(playlistMeta.playlist.title);
        setIsEditingTitle(true);
    };

    const submitTitleEdit = () => {
        if (!editTitle.trim() || !playlistMeta?.playlist) return;
        updateDetailsMutation.mutate({
            playlistId,
            title: editTitle.trim(),
            description: playlistMeta.playlist.description || "",
            visibility: playlistMeta.playlist.visibility as Visibility,
            channelId: channel.id,
        });
    };

    const startDescriptionEdit = () => {
        if (!playlistMeta?.playlist) return;
        setEditDescription(playlistMeta.playlist.description || "");
        setIsEditingDescription(true);
    };

    const submitDescriptionEdit = () => {
        if (!playlistMeta?.playlist) return;
        updateDetailsMutation.mutate({
            playlistId,
            title: playlistMeta.playlist.title,
            description: editDescription.trim(),
            visibility: playlistMeta.playlist.visibility as Visibility,
            channelId: channel.id,
        });
    };

    const playlist = playlistMeta?.playlist;

    return (
        <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
            {/* Back Link */}
            <Link
                href={`/studio/${channel.id}/content`}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
                <IconArrowLeft size={16} /> Back to Content
            </Link>

            {/* Playlist Header */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            {isEditingTitle ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="text-lg font-bold"
                                        maxLength={150}
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") submitTitleEdit();
                                            if (e.key === "Escape") setIsEditingTitle(false);
                                        }}
                                    />
                                    <Button
                                        size="sm"
                                        onClick={submitTitleEdit}
                                        disabled={updateDetailsMutation.isPending}
                                    >
                                        <IconCheck size={16} />
                                    </Button>
                                </div>
                            ) : (
                                <CardTitle
                                    className="text-xl cursor-pointer hover:text-primary transition-colors"
                                    onClick={startTitleEdit}
                                    title="Click to edit title"
                                >
                                    <IconPlaylist size={20} className="inline mr-2 -mt-0.5" />
                                    {playlist?.title || "Loading..."}
                                </CardTitle>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {playlist && (
                                <AddVideosModal 
                                    playlistId={playlistId} 
                                    channelId={channel.id} 
                                />
                            )}
                            {playlist && (
                                <Select
                                    value={playlist.visibility}
                                    onValueChange={(v) => handleVisibilityChange(v as Visibility)}
                                >
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PUBLIC">Public</SelectItem>
                                        <SelectItem value="PRIVATE">Private</SelectItem>
                                        <SelectItem value="UNLISTED">Unlisted</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                    <p className="text-sm text-muted-foreground">
                        {videos.length} video{videos.length !== 1 ? "s" : ""} in this playlist
                    </p>
                    
                    {isEditingDescription ? (
                        <div className="space-y-2">
                            <Textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                placeholder="Add a description..."
                                className="text-sm min-h-[80px] resize-none"
                                maxLength={5000}
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setIsEditingDescription(false)}>Cancel</Button>
                                <Button size="sm" onClick={submitDescriptionEdit} disabled={updateDetailsMutation.isPending}>Save</Button>
                            </div>
                        </div>
                    ) : (
                        <p 
                            className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors line-clamp-3"
                            onClick={startDescriptionEdit}
                            title="Click to edit description"
                        >
                            {playlist?.description || "No description. Click to add one."}
                        </p>
                    )}
                </CardContent>
            </Card>

            <Separator />

            {/* Videos List */}
            {isLoading ? (
                <div className="flex items-center justify-center h-48">
                    <IconLoader2 className="animate-spin text-muted-foreground" size={28} />
                </div>
            ) : videos.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                        <IconVideo size={36} className="opacity-30 mb-3" />
                        <p className="font-medium">This playlist is empty</p>
                        <p className="text-xs mt-1">Add videos using the &quot;Add videos&quot; button above.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {videos.map((video, index) => (
                        <Card key={video.id} className="group">
                            <CardContent className="p-3 flex items-center gap-4">
                                {/* Position Number */}
                                <span className="text-xs font-bold text-muted-foreground w-6 text-center shrink-0">
                                    {index + 1}
                                </span>

                                {/* Reorder Controls */}
                                <div className="flex flex-col gap-0.5 shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        disabled={index === 0 || reorderMutation.isPending}
                                        onClick={() => handleMoveUp(video.id, video.position)}
                                    >
                                        <IconArrowUp size={14} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        disabled={index === videos.length - 1 || reorderMutation.isPending}
                                        onClick={() => handleMoveDown(video.id, video.position)}
                                    >
                                        <IconArrowDown size={14} />
                                    </Button>
                                </div>

                                {/* Thumbnail */}
                                <Link href={`/watch/${video.id}`} className="shrink-0">
                                    <div className="relative aspect-video w-28 bg-muted rounded overflow-hidden">
                                        {video.thumbnailUrl ? (
                                            <Image
                                                src={getMediaUrl(video.thumbnailUrl)}
                                                alt={video.title}
                                                fill
                                                unoptimized
                                                className="object-cover"
                                                sizes="112px"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <IconVideo size={16} className="text-muted-foreground/30" />
                                            </div>
                                        )}
                                        {(video.duration || 0) > 0 && (
                                            <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[9px] px-1 rounded font-medium">
                                                {formatDuration(video.duration)}
                                            </span>
                                        )}
                                    </div>
                                </Link>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <Link
                                        href={`/watch/${video.id}`}
                                        className="font-semibold text-sm line-clamp-1 hover:underline"
                                    >
                                        {video.title}
                                    </Link>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-muted-foreground">
                                            {video.author?.name}
                                        </span>
                                        <Badge variant="secondary" className="text-[10px] h-4">
                                            {video.viewCount?.toLocaleString() || 0} views
                                        </Badge>
                                    </div>
                                </div>

                                {/* Remove */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                    disabled={removeMutation.isPending}
                                    onClick={() => handleRemove(video.id)}
                                >
                                    <IconTrash size={16} />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
