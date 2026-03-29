"use client";

import { useStudio } from "./_components/studio-provider";
import { trpc } from "@/lib/trpc-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    IconEye,
    IconUsers,
    IconVideo,
    IconMessageCircle,
    IconHeart,
    IconLoader2,
    IconTrendingUp,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { getMediaUrl, formatDuration } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

/* ─── Stat Card ─── */
function StatCard({
    label,
    value,
    icon: Icon,
    accent,
}: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    accent?: string;
}) {
    return (
        <Card className="relative overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
                <div
                    className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${accent ?? "bg-primary/10 text-primary"}`}
                >
                    <Icon size={22} />
                </div>
                <div>
                    <p className="text-2xl font-black tracking-tight leading-none">
                        {typeof value === "number" ? value.toLocaleString() : value}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wider">
                        {label}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

/* ─── Latest Video Widget ─── */
function LatestVideoWidget({ channelId }: { channelId: string }) {
    const { data, isLoading } = trpc.video.getChannelContent.useInfiniteQuery(
        { channelId, limit: 1 },
        { getNextPageParam: (l) => l.nextCursor }
    );

    const video = data?.pages[0]?.items[0];

    if (isLoading) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <IconTrendingUp size={18} /> Latest video performance
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-48">
                    <IconLoader2 className="animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (!video) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <IconTrendingUp size={18} /> Latest video performance
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <IconVideo size={32} className="opacity-30 mb-2" />
                    <p className="text-sm font-medium">No videos yet</p>
                    <p className="text-xs">Upload your first video to see stats here.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <IconTrendingUp size={18} /> Latest video performance
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-4">
                    {/* Thumbnail */}
                    <Link href={`/watch/${video.id}`} className="shrink-0">
                        <div className="relative aspect-video w-40 rounded-lg overflow-hidden bg-muted">
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
                            {(video.duration || 0) > 0 && (
                                <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded font-medium">
                                    {formatDuration(video.duration)}
                                </span>
                            )}
                        </div>
                    </Link>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <Link
                            href={`/watch/${video.id}`}
                            className="font-semibold text-sm line-clamp-2 hover:underline"
                        >
                            {video.title}
                        </Link>
                        <div className="flex items-center gap-2 mt-1.5">
                            <Badge
                                variant={video.visibility === "PUBLIC" ? "default" : "secondary"}
                                className="text-[10px] h-5"
                            >
                                {video.visibility}
                            </Badge>
                            {video.publishedAt && (
                                <span className="text-[11px] text-muted-foreground">
                                    {formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <p className="text-lg font-bold">{video.viewCount.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Views</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold">{video.likeCount.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Likes</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold">{video.commentCount.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Comments</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/* ─── Recent Comments Widget ─── */
function RecentCommentsWidget({ channelId }: { channelId: string }) {
    const { data, isLoading } = trpc.comment.getChannelComments.useInfiniteQuery(
        { channelId, limit: 3 },
        { getNextPageParam: (l) => l.nextCursor }
    );

    const comments = data?.pages[0]?.items?.slice(0, 3) || [];

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <IconMessageCircle size={18} /> Recent comments
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <IconLoader2 className="animate-spin text-muted-foreground" />
                    </div>
                ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                        <IconMessageCircle size={28} className="opacity-30 mb-2" />
                        <p className="text-sm font-medium">No comments yet</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {comments.map((comment) => (
                            <div key={comment.id} className="flex gap-3 items-start">
                                <Avatar className="w-8 h-8 shrink-0">
                                    <AvatarImage
                                        src={comment.author.image ? getMediaUrl(comment.author.image) : undefined}
                                    />
                                    <AvatarFallback className="text-xs font-bold">
                                        {(comment.author.name || "U")[0].toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold truncate">
                                            {comment.author.name}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground shrink-0">
                                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                        {comment.content}
                                    </p>
                                </div>
                                {comment.likeCount > 0 && (
                                    <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                                        <IconHeart size={12} /> {comment.likeCount}
                                    </div>
                                )}
                            </div>
                        ))}
                        <Link
                            href={`/studio/${channelId}/comments`}
                            className="block text-xs text-primary font-semibold hover:underline mt-2"
                        >
                            View all comments →
                        </Link>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/* ─── Page ─── */
export default function StudioDashboardPage() {
    const { channel } = useStudio();

    return (
        <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">Channel Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                    Welcome back, <span className="font-semibold text-foreground">{channel.name}</span>
                </p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    label="Subscribers"
                    value={channel.subscriberCount}
                    icon={IconUsers}
                    accent="bg-blue-500/10 text-blue-500"
                />
                <StatCard
                    label="Videos"
                    value={channel.videoCount}
                    icon={IconVideo}
                    accent="bg-green-500/10 text-green-500"
                />
                <StatCard
                    label="Total Views"
                    value={channel.totalViews}
                    icon={IconEye}
                    accent="bg-purple-500/10 text-purple-500"
                />
            </div>

            {/* Widgets Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LatestVideoWidget channelId={channel.id} />
                <RecentCommentsWidget channelId={channel.id} />
            </div>
        </div>
    );
}
