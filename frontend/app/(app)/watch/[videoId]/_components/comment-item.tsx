"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IconThumbUp, IconThumbDown, IconMessageCircle, IconPinFilled } from "@tabler/icons-react";
import { getMediaUrl } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

// Assuming type based on CommentService
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CommentItem({ comment, videoId, depth = 0, isVideoOwner = false }: { comment: any; videoId: string; depth?: number; isVideoOwner?: boolean }) {
    const utils = trpc.useUtils();
    const [isReplying, setIsReplying] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [showReplies, setShowReplies] = useState(false);

    const { data: repliesData, fetchNextPage, hasNextPage, isFetchingNextPage } = trpc.comment.replies.useInfiniteQuery(
        { parentId: comment.id, limit: 10 },
        { 
            enabled: showReplies,
            getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined 
        }
    );

    const toggleLike = trpc.comment.toggleLike.useMutation({
        onSuccess: () => {
            // Invalidate the specific queries to refresh data
            utils.comment.list.invalidate({ videoId });
            if (comment.parentId) utils.comment.replies.invalidate({ parentId: comment.parentId });
            else utils.comment.replies.invalidate({ parentId: comment.id }); // invalidate own replies if top-level
        }
    });

    const toggleDislike = trpc.comment.toggleDislike.useMutation({
        onSuccess: () => {
            utils.comment.list.invalidate({ videoId });
            if (comment.parentId) utils.comment.replies.invalidate({ parentId: comment.parentId });
        }
    });

    const createReply = trpc.comment.create.useMutation({
        onSuccess: () => {
            setReplyText("");
            setIsReplying(false);
            setShowReplies(true);
            utils.comment.replies.invalidate({ parentId: comment.id });
            utils.comment.list.invalidate({ videoId }); // To update replyCount
            toast.success("Reply added");
        },
        onError: (err) => {
            toast.error(err.message || "Failed to add reply");
        }
    });

    const handleReaction = (type: "LIKE" | "DISLIKE") => {
        if (type === "LIKE") {
            toggleLike.mutate({ commentId: comment.id, videoId });
        } else {
            toggleDislike.mutate({ commentId: comment.id, videoId });
        }
    };

    const submitReply = () => {
        if (!replyText.trim()) return;
        createReply.mutate({
            videoId,
            content: replyText,
            parentId: comment.id
        });
    };

    const channel = comment.user.channels?.[0];
    const authorName = channel?.name || comment.user.name || "User";
    const authorHandle = channel?.handle ? `@${channel.handle}` : "";
    const authorImage = channel?.image || comment.user.image;

    const allReplies = repliesData?.pages.flatMap((p) => p.items) || [];

    return (
        <div className={`flex gap-3 mb-5 ${depth > 0 ? "mt-4" : ""}`}>
            <Link href={channel?.handle ? `/@${channel.handle}` : "#"}>
                <Avatar className={depth > 0 ? "w-8 h-8" : "w-10 h-10"}>
                    <AvatarImage src={authorImage ? getMediaUrl(authorImage) : undefined} />
                    <AvatarFallback>{authorName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
            </Link>

            <div className="flex flex-col w-full min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <Link href={channel?.handle ? `/@${channel.handle}` : "#"} className="font-semibold text-[13px] hover:underline decoration-foreground/30">
                        {authorHandle || authorName}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                    {comment.isEdited && <span className="text-[10px] text-muted-foreground mr-2">(edited)</span>}
                    {comment.isPinned && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            <IconPinFilled size={10} /> Pinned
                        </span>
                    )}
                </div>

                <p className="text-sm text-foreground/90 whitespace-pre-wrap wrap-break-word">
                    {comment.content}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-2">
                    <button 
                        onClick={() => handleReaction("LIKE")}
                        className={`flex items-center gap-1.5 p-1.5 rounded-full hover:bg-muted transition-colors ${comment.userReaction === "LIKE" ? "text-primary" : "text-muted-foreground"}`}
                    >
                        <IconThumbUp size={16} className={comment.userReaction === "LIKE" ? "fill-current" : ""} />
                        <span className="text-xs font-medium">{comment.likeCount > 0 ? comment.likeCount : ""}</span>
                    </button>
                    <button 
                        onClick={() => handleReaction("DISLIKE")}
                        className={`flex items-center p-1.5 rounded-full hover:bg-muted transition-colors ${comment.userReaction === "DISLIKE" ? "text-primary" : "text-muted-foreground"}`}
                    >
                        <IconThumbDown size={16} className={comment.userReaction === "DISLIKE" ? "fill-current" : ""} />
                    </button>
                    
                    {depth === 0 && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-3 ml-2 rounded-full" onClick={() => setIsReplying(!isReplying)}>
                            Reply
                        </Button>
                    )}
                </div>

                {isReplying && (
                    <div className="mt-3 flex gap-3 pr-4">
                        <Avatar className="w-6 h-6 shrink-0 mt-1">
                            <AvatarFallback>Me</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col w-full gap-2">
                            <Textarea 
                                placeholder="Add a reply..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                className="min-h-[30px] h-[30px] resize-none border-b-2 border-t-0 border-l-0 border-r-0 border-muted focus-visible:ring-0 focus-visible:border-foreground rounded-none px-0 py-1"
                                rows={1}
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setIsReplying(false)}>Cancel</Button>
                                <Button size="sm" className="rounded-full" onClick={submitReply} disabled={!replyText.trim() || createReply.isPending}>
                                    Reply
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Show/Hide Replies Toggle */}
                {comment.replyCount > 0 && depth === 0 && (
                    <div className="mt-2">
                        <button 
                            onClick={() => setShowReplies(!showReplies)}
                            className="flex items-center gap-2 text-sm font-semibold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-full transition-colors"
                        >
                            <IconMessageCircle size={16} />
                            {showReplies ? "Hide replies" : `View ${comment.replyCount} replies`}
                        </button>
                    </div>
                )}

                {/* Recursive Replies Rendering */}
                {showReplies && allReplies.length > 0 && (
                    <div className="mt-2">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {comment.replies.map((reply: any) => (
                            <CommentItem key={reply.id} comment={reply} videoId={videoId} depth={depth + 1} isVideoOwner={isVideoOwner} />
                        ))}
                        {hasNextPage && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-xs font-semibold rounded-full mt-1" 
                                onClick={() => fetchNextPage()}
                                disabled={isFetchingNextPage}
                            >
                                {isFetchingNextPage ? "Loading..." : "Show more replies"}
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
