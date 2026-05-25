"use client";

import { useState } from "react";
import { useStudio } from "../_components/studio-provider";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import {
    IconHeart,
    IconTrash,
    IconMessageCircle,
    IconVideo,
    IconLoader2,
    IconSend,
    IconCornerDownRight,
    IconX,
    IconVideoPlus,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { getMediaUrl } from "@/lib/utils";
import { useUpload } from "@/components/providers/upload-provider";
import { SwitchChannelButton } from "../_components/switch-channel-button";
import Link from "next/link";
import Image from "next/image";

export default function StudioCommentsPage() {
    const { channel } = useStudio();
    const utils = trpc.useUtils();
    const { openModal } = useUpload();

    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");

    const { data, isLoading, refetch } = trpc.comment.getChannelComments.useInfiniteQuery(
        { channelId: channel.id, limit: 20 },
        { getNextPageParam: (l) => l.nextCursor }
    );

    const deleteMutation = trpc.comment.delete.useMutation({
        onSuccess: () => {
            toast.success("Comment deleted.");
            refetch();
        },
    });

    const heartMutation = trpc.comment.heart.useMutation({
        onMutate: async () => {
            await utils.comment.getChannelComments.cancel();
            toast.success("Heart toggled!");
        },
        onSettled: () => refetch(),
    });

    const replyMutation = trpc.comment.create.useMutation({
        onSuccess: () => {
            toast.success("Reply posted!");
            setReplyingTo(null);
            setReplyContent("");
            refetch();
        },
        onError: (err) => toast.error(err.message),
    });

    const handleReply = (commentId: string, videoId: string) => {
        if (!replyContent.trim()) return;
        replyMutation.mutate({
            videoId,
            parentId: commentId,
            content: replyContent.trim(),
        });
    };

    const comments = data?.pages.flatMap((p) => p.items) || [];

    return (
        <div className="flex flex-col h-full bg-background p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Channel Comments</h1>
                    <p className="text-muted-foreground">
                        Review and engage with comments across all your videos.
                    </p>
                </div>
            </div>

            <Card className="overflow-hidden">
                <div className="p-4 border-b border-border/20 bg-muted/30 font-bold flex items-center gap-2">
                    <IconMessageCircle className="text-primary" size={18} /> Inbox
                    {comments.length > 0 && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                            {comments.length} comment{comments.length !== 1 ? "s" : ""}
                        </Badge>
                    )}
                </div>

                <div className="divide-y divide-border/20">
                    {isLoading ? (
                        <div className="p-12 text-center text-muted-foreground">
                            <IconLoader2 className="animate-spin mx-auto mb-2" size={24} />
                            Loading comments...
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center">
                            <IconMessageCircle size={48} className="text-muted-foreground/30 mb-4" />
                            <p className="font-bold text-lg">No comments yet</p>
                            <p className="text-sm">
                                When viewers comment on your videos, they&apos;ll appear here.
                            </p>
                        </div>
                    ) : (
                        comments.map((comment) => (
                            <div
                                key={comment.id}
                                className="p-6 flex flex-col md:flex-row gap-6 hover:bg-muted/10 transition-colors group"
                            >
                                {/* Author Avatar */}
                                <Avatar className="w-10 h-10 border shrink-0">
                                    <AvatarImage
                                        src={
                                            comment.author.image
                                                ? getMediaUrl(comment.author.image)
                                                : undefined
                                        }
                                    />
                                    <AvatarFallback className="font-bold">
                                        {(comment.author.name || "U")[0].toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm">
                                            {comment.author.name}
                                        </span>
                                        {comment.author.handle && (
                                            <span className="text-xs text-muted-foreground">
                                                @{comment.author.handle}
                                            </span>
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(comment.createdAt), {
                                                addSuffix: true,
                                            })}
                                        </span>
                                    </div>

                                    <p className="text-[15px] whitespace-pre-wrap">{comment.content}</p>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 mt-2 pt-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                            onClick={() =>
                                                heartMutation.mutate({
                                                    commentId: comment.id,
                                                    videoId: comment.videoId,
                                                })
                                            }
                                        >
                                            <IconHeart size={16} className="mr-1.5" /> Heart
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10"
                                            onClick={() => {
                                                if (replyingTo === comment.id) {
                                                    setReplyingTo(null);
                                                    setReplyContent("");
                                                } else {
                                                    setReplyingTo(comment.id);
                                                    setReplyContent("");
                                                }
                                            }}
                                        >
                                            {replyingTo === comment.id ? (
                                                <>
                                                    <IconX size={16} className="mr-1.5" /> Cancel
                                                </>
                                            ) : (
                                                <>
                                                    <IconCornerDownRight size={16} className="mr-1.5" /> Reply
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => {
                                                if (confirm("Remove this comment?")) {
                                                    deleteMutation.mutate({ commentId: comment.id });
                                                }
                                            }}
                                        >
                                            <IconTrash size={16} className="mr-1.5" /> Remove
                                        </Button>
                                    </div>

                                    {/* Inline Reply Composer */}
                                    {replyingTo === comment.id && (
                                        <div className="mt-3 flex gap-2 items-start bg-muted/30 p-3 rounded-lg border border-border/30">
                                            <Avatar className="w-7 h-7 shrink-0">
                                                <AvatarImage
                                                    src={channel.image ? getMediaUrl(channel.image) : undefined}
                                                />
                                                <AvatarFallback className="text-[10px] font-bold">
                                                    {channel.name[0].toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 space-y-2">
                                                <Textarea
                                                    placeholder={`Reply as ${channel.name}...`}
                                                    className="resize-none min-h-[60px] bg-background text-sm"
                                                    value={replyContent}
                                                    onChange={(e) => setReplyContent(e.target.value)}
                                                    autoFocus
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setReplyingTo(null);
                                                            setReplyContent("");
                                                        }}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        disabled={
                                                            !replyContent.trim() || replyMutation.isPending
                                                        }
                                                        onClick={() =>
                                                            handleReply(comment.id, comment.videoId)
                                                        }
                                                    >
                                                        {replyMutation.isPending ? (
                                                            <IconLoader2 className="animate-spin mr-1 h-3 w-3" />
                                                        ) : (
                                                            <IconSend size={14} className="mr-1" />
                                                        )}
                                                        Reply
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Video Target Reference */}
                                <Link
                                    href={`/watch/${comment.videoId}`}
                                    target="_blank"
                                    className="shrink-0 w-32 group-hover:opacity-100 opacity-80 transition-opacity"
                                >
                                    <div className="aspect-video bg-muted rounded border border-border/20 overflow-hidden relative flex items-center justify-center">
                                        {comment.videos.thumbnailUrl ? (
                                            <Image
                                                src={getMediaUrl(comment.videos.thumbnailUrl)}
                                                alt={comment.videos.title}
                                                fill
                                                unoptimized
                                                className="object-cover"
                                            />
                                        ) : (
                                            <IconVideo
                                                size={16}
                                                className="text-muted-foreground/30"
                                            />
                                        )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 font-semibold leading-tight">
                                        {comment.videos.title}
                                    </p>
                                </Link>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
}
