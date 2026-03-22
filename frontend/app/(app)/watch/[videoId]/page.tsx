"use client";

import { use, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc-client";
import { VideoPlayer } from "@/components/custom/video-player";
import { getMediaUrl, formatDuration } from "@/lib/utils";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    IconThumbUp,
    IconThumbDown,
    IconShare,
    IconVideo,
} from "@tabler/icons-react";
import { formatDistanceToNow, format } from "date-fns";
import Image from "next/image";
import { toast } from "sonner";
import { CommentsSection } from "./_components/comments-section";
import { SaveToPlaylistModal } from "./_components/save-to-playlist-modal";

export default function WatchPage({ params }: { params: Promise<{ videoId: string }> }) {
    const { videoId } = use(params);
    const utils = trpc.useUtils();

    const { data, isLoading, error } = trpc.video.getPublicVideo.useQuery(
        { videoId },
        { retry: false, refetchOnWindowFocus: false }
    );

    // L4: Register a view once the video data loads
    const registerView = trpc.video.registerView.useMutation();
    const viewRegisteredRef = useRef(false);
    useEffect(() => {
        if (data && !viewRegisteredRef.current) {
            viewRegisteredRef.current = true;
            registerView.mutate({ videoId });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.id]);

    // L5: Watch progress heartbeat every 15s
    const updateProgress = trpc.video.updateWatchProgress.useMutation();
    const lastReportedRef = useRef(0);
    const handleTimeUpdate = (seconds: number) => {
        if (Math.abs(seconds - lastReportedRef.current) >= 15) {
            lastReportedRef.current = seconds;
            updateProgress.mutate({ videoId, seconds: Math.floor(seconds) });
        }
    };

    // Sidebar: real recommendations (L2)
    const { data: recommendationsData, isLoading: recsLoading } = trpc.feed.getRecommendations.useQuery(
        { videoId },
        { enabled: !!data?.id }
    );
    const relatedVideos = recommendationsData?.videos || [];

    // L3: Like/dislike/subscribe mutations with Optimistic Updates
    const toggleLike = trpc.engagement.toggleLike.useMutation({
        onMutate: async () => {
            await utils.video.getPublicVideo.cancel({ videoId });
            const previousData = utils.video.getPublicVideo.getData({ videoId });
            if (previousData) {
                const wasLiked = previousData.engagement?.liked;
                const wasDisliked = previousData.engagement?.disliked;
                utils.video.getPublicVideo.setData({ videoId }, {
                    ...previousData,
                    likeCount: Math.max(0, previousData.likeCount + (wasLiked ? -1 : 1)),
                    dislikeCount: Math.max(0, previousData.dislikeCount + (wasDisliked ? -1 : 0)),
                    engagement: {
                        liked: !wasLiked,
                        disliked: false,
                        subscribed: previousData.engagement?.subscribed ?? false
                    }
                });
            }
            return { previousData };
        },
        onError: (err, newTodo, context) => {
            if (context?.previousData) utils.video.getPublicVideo.setData({ videoId }, context.previousData);
        },
        onSettled: () => {
            utils.video.getPublicVideo.invalidate({ videoId });
        }
    });

    const toggleDislike = trpc.engagement.toggleDislike.useMutation({
        onMutate: async () => {
            await utils.video.getPublicVideo.cancel({ videoId });
            const previousData = utils.video.getPublicVideo.getData({ videoId });
            if (previousData) {
                const wasLiked = previousData.engagement?.liked;
                const wasDisliked = previousData.engagement?.disliked;
                utils.video.getPublicVideo.setData({ videoId }, {
                    ...previousData,
                    likeCount: Math.max(0, previousData.likeCount + (wasLiked ? -1 : 0)),
                    dislikeCount: Math.max(0, previousData.dislikeCount + (wasDisliked ? -1 : 1)),
                    engagement: {
                        liked: false,
                        disliked: !wasDisliked,
                        subscribed: previousData.engagement?.subscribed ?? false
                    }
                });
            }
            return { previousData };
        },
        onError: (err, newTodo, context) => {
            if (context?.previousData) utils.video.getPublicVideo.setData({ videoId }, context.previousData);
        },
        onSettled: () => {
            utils.video.getPublicVideo.invalidate({ videoId });
        }
    });

    const toggleSubscription = trpc.channel.toggleSubscription.useMutation({
        onMutate: async () => {
            await utils.video.getPublicVideo.cancel({ videoId });
            const previousData = utils.video.getPublicVideo.getData({ videoId });
            if (previousData && previousData.channels) {
                const wasSubscribed = previousData.engagement?.subscribed ?? false;
                utils.video.getPublicVideo.setData({ videoId }, {
                    ...previousData,
                    channels: {
                        ...previousData.channels,
                        subscriberCount: Math.max(0, (previousData.channels.subscriberCount ?? 0) + (wasSubscribed ? -1 : 1))
                    },
                    engagement: {
                        liked: previousData.engagement?.liked ?? false,
                        disliked: previousData.engagement?.disliked ?? false,
                        subscribed: !wasSubscribed
                    }
                });
            }
            return { previousData };
        },
        onError: (err, newTodo, context) => {
            if (context?.previousData) utils.video.getPublicVideo.setData({ videoId }, context.previousData);
        },
        onSettled: () => {
            utils.video.getPublicVideo.invalidate({ videoId });
        }
    });

    const handleReaction = (type: "LIKE" | "DISLIKE" | "REMOVE") => {
        if (!data) return;
        if (type === "LIKE") {
            toggleLike.mutate({ videoId });
        } else if (type === "DISLIKE") {
            toggleDislike.mutate({ videoId });
        } else if (type === "REMOVE") {
            // Depending on current state, toggle again to remove
            if (data.engagement?.liked) toggleLike.mutate({ videoId });
            else if (data.engagement?.disliked) toggleDislike.mutate({ videoId });
        }
    };

    const handleSubscribe = () => {
        if (!data?.channelId) return;
        toggleSubscription.mutate({ channelId: data.channelId });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground font-medium animate-pulse">Loading video...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 max-w-md mx-auto text-center">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center text-3xl font-black text-muted-foreground decoration-primary line-through decoration-4">
                    404
                </div>
                <h1 className="text-2xl font-bold">Video unavailable</h1>
                <p className="text-muted-foreground">
                    {error?.message || "This video isn't available anymore or it may be blocked in your region."}
                </p>
            </div>
        );
    }

    const video = data;
    const channel = video.channels;
    const engagement = video.engagement;

    // L1: Use publishedAt if available, otherwise createdAt
    const displayDate = video.publishedAt ?? video.createdAt;

    return (
        <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row gap-6 p-4 lg:p-6 pb-24">
            {/* Main Content Column */}
            <div className="flex-1 min-w-0">

                {/* HLS Video Player — passes onTimeUpdate for L5 heartbeat */}
                <div className="w-full shadow-2xl rounded-2xl overflow-hidden bg-black/5 ring-1 ring-border/5">
                    <VideoPlayer
                        videoId={video.id}
                        thumbnailUrl={video.thumbnailUrl}
                        previewSpriteVtt={video.previewSpriteVtt}
                        autoPlay={true}
                        onTimeUpdate={handleTimeUpdate}
                        // Resume from watch history if available
                        {...(video.history?.watchedSeconds && video.history.watchedSeconds > 10
                            ? { startAt: video.history.watchedSeconds }
                            : {})}
                    />
                </div>

                {/* Title */}
                <h1 className="text-xl sm:text-2xl font-bold mt-4 mb-2 line-clamp-2 leading-tight">
                    {video.title}
                </h1>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2 mb-6 pb-4 border-b border-border/40">

                    {/* Channel Info */}
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Avatar className="w-10 h-10 border shadow-sm">
                            <AvatarImage src={channel?.image ? getMediaUrl(channel.image) : undefined} />
                            <AvatarFallback className="font-bold text-primary bg-primary/10 tracking-widest uppercase text-xs">
                                {channel?.name?.slice(0, 2) || "U"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col -gap-1">
                            <span className="font-semibold text-sm leading-tight">{channel?.name}</span>
                            <span className="text-xs text-muted-foreground tracking-wide">
                                {channel?.subscriberCount?.toLocaleString() || 0} subscribers
                            </span>
                        </div>
                        {/* L3: Subscribe button — active state from engagement */}
                        <Button
                            className="rounded-full px-6 ml-2 font-bold tracking-wide active:scale-95 transition-transform"
                            variant={engagement?.subscribed ? "outline" : "default"}
                            onClick={handleSubscribe}
                        >
                            {engagement?.subscribed ? "Subscribed" : "Subscribe"}
                        </Button>
                    </div>

                    {/* Engagement Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* L3: Like/Dislike — active state from engagement */}
                        <div className="flex items-center bg-muted/40 hover:bg-muted/80 transition-colors rounded-full border border-border/10 overflow-hidden shadow-sm">
                            <button
                                onClick={() => handleReaction(engagement?.liked ? "REMOVE" : "LIKE")}
                                className={`flex items-center gap-2 px-4 py-2 transition-colors group ${engagement?.liked ? "text-primary" : "hover:bg-muted"}`}
                            >
                                <IconThumbUp size={18} className={`group-active:scale-90 transition-transform ${engagement?.liked ? "fill-current" : ""}`} />
                                <span className="text-sm font-semibold">
                                    {video.likeCount > 0 ? video.likeCount.toLocaleString() : "Like"}
                                </span>
                            </button>
                            <div className="w-px h-5 bg-border/40" />
                            <button
                                onClick={() => handleReaction(engagement?.disliked ? "REMOVE" : "DISLIKE")}
                                className={`flex items-center px-4 py-2 transition-colors group ${engagement?.disliked ? "text-primary" : "hover:bg-muted"}`}
                            >
                                <IconThumbDown size={18} className={`group-active:scale-90 transition-transform ${engagement?.disliked ? "fill-current" : ""}`} />
                            </button>
                        </div>

                        <SaveToPlaylistModal videoId={video.id} />

                        <Button
                            variant="secondary"
                            className="rounded-full gap-2 shadow-sm border border-border/10 hover:bg-muted/80 px-4"
                            onClick={() => {
                                navigator.clipboard.writeText(window.location.href);
                                toast.success("Link copied!");
                            }}
                        >
                            <IconShare size={18} />
                            <span className="max-sm:hidden font-medium">Share</span>
                        </Button>
                    </div>
                </div>

                {/* Description Box */}
                <div className="bg-muted/30 hover:bg-muted/50 transition-colors p-4 rounded-xl cursor-default border border-border/5">
                    <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                        <span>{video.viewCount.toLocaleString()} views</span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                        {/* L1: Use publishedAt if available */}
                        <span>{formatDistanceToNow(new Date(displayDate), { addSuffix: true })}</span>
                        <span className="text-xs text-muted-foreground font-normal ml-1">
                            ({format(new Date(displayDate), "MMM d, yyyy")})
                        </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap wrap-break-word leading-relaxed text-foreground/90">
                        {video.description || "No description available."}
                    </p>
                </div>

                {/* Comments Section */}
                <CommentsSection videoId={video.id} commentCount={video.commentCount} />
            </div>

            {/* Sidebar — L2: Real related videos */}
            <div className="w-full xl:w-[400px] shrink-0 flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Up Next</span>
                </div>
                {recsLoading ? (
                    /* Skeleton while loading */
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-2 animate-pulse">
                            <div className="w-[160px] aspect-video bg-muted/40 rounded-lg shrink-0" />
                            <div className="flex flex-col py-1 gap-2 flex-1">
                                <div className="h-3 bg-muted rounded w-5/6" />
                                <div className="h-2 bg-muted rounded w-3/6" />
                                <div className="h-2 bg-muted rounded w-2/6" />
                            </div>
                        </div>
                    ))
                ) : relatedVideos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-border/10 rounded-xl">
                        <span className="text-sm font-medium text-muted-foreground">No related videos found</span>
                    </div>
                ) : (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    relatedVideos.map((v: any) => (
                        <Link key={v.id} href={`/watch/${v.id}`} className="flex gap-2 group cursor-pointer">
                            <div className="w-[160px] aspect-video bg-muted/40 rounded-lg shrink-0 relative overflow-hidden ring-1 ring-border/10 group-hover:ring-primary/50 transition-all">
                                {v.thumbnailUrl ? (
                                    <Image
                                        src={getMediaUrl(v.thumbnailUrl)}
                                        alt={v.title}
                                        fill
                                        className="object-cover"
                                        sizes="160px"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <IconVideo size={20} className="text-muted-foreground/30" />
                                    </div>
                                )}
                                {(v.duration ?? 0) > 0 && (
                                    <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded font-medium">
                                        {formatDuration(v.duration)}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col py-1">
                                <span className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                                    {v.title}
                                </span>
                                <span className="text-xs text-muted-foreground mt-1">{v.channels?.name}</span>
                                <span className="text-[10px] text-muted-foreground/80 mt-0.5">
                                    {v.viewCount.toLocaleString()} views
                                    {v.publishedAt && ` • ${formatDistanceToNow(new Date(v.publishedAt), { addSuffix: true })}`}
                                </span>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
