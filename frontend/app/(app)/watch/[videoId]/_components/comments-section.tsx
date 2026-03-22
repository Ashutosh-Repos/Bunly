"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc-client";
import { useInView } from "react-intersection-observer";
import { CommentItem } from "./comment-item";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { IconFilter } from "@tabler/icons-react";

export function CommentsSection({ videoId, commentCount }: { videoId: string; commentCount: number }) {
    const utils = trpc.useUtils();
    const [sortBy, setSortBy] = useState<"TOP" | "NEWEST">("TOP");
    const [newCommentText, setNewCommentText] = useState("");
    const [showCommentButtons, setShowCommentButtons] = useState(false);

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = trpc.comment.list.useInfiniteQuery(
        { videoId, sortBy, limit: 20 },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        }
    );

    const { ref, inView } = useInView({ threshold: 0, rootMargin: "200px" });

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, fetchNextPage, isFetchingNextPage]);

    const createComment = trpc.comment.create.useMutation({
        onSuccess: () => {
            setNewCommentText("");
            setShowCommentButtons(false);
            utils.comment.list.invalidate({ videoId });
            toast.success("Comment added");
        },
        onError: (err) => {
            toast.error(err.message || "Failed to add comment");
        }
    });

    const submitComment = () => {
        if (!newCommentText.trim()) return;
        createComment.mutate({
            videoId,
            content: newCommentText
        });
    };

    const comments = data?.pages.flatMap((p) => p.items) || [];

    // Simple auth check via TRPC
    const { data: session } = trpc.auth.getSession.useQuery(undefined, {
        staleTime: Infinity,
    });

    return (
        <div className="mt-6 flex flex-col w-full max-w-[1000px]">
            {/* Header */}
            <div className="flex items-center gap-6 mb-6">
                <h2 className="text-xl font-bold tracking-tight">
                    {commentCount > 0 ? `${commentCount.toLocaleString()} Comments` : "Comments"}
                </h2>
                
                <div className="flex items-center gap-2">
                    <button 
                        className={`flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-md hover:bg-muted transition-colors ${sortBy === "TOP" ? "bg-muted" : ""}`}
                        onClick={() => setSortBy("TOP")}
                    >
                        <IconFilter size={18} /> Top comments
                    </button>
                    <button 
                         className={`text-sm font-semibold px-3 py-1.5 rounded-md hover:bg-muted transition-colors ${sortBy === "NEWEST" ? "bg-muted" : ""}`}
                         onClick={() => setSortBy("NEWEST")}
                    >
                        Newest first
                    </button>
                </div>
            </div>

            {/* Create Comment Input */}
            <div className="flex gap-4 mb-8">
                <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={session?.user?.image || undefined} />
                    <AvatarFallback>{session?.user?.name?.slice(0, 2).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                
                <div className="flex flex-col w-full">
                    <Textarea 
                        placeholder={session ? "Add a comment..." : "Log in to comment"}
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        onFocus={() => setShowCommentButtons(true)}
                        disabled={!session || createComment.isPending}
                        className="min-h-[40px] resize-none border-b border-t-0 border-l-0 border-r-0 border-muted focus-visible:ring-0 focus-visible:border-foreground rounded-none px-0 py-2 shadow-none text-[15px]"
                        rows={1}
                    />
                    
                    {showCommentButtons && session && (
                        <div className="flex justify-between items-center mt-3">
                            <span className="text-xs text-muted-foreground/50"></span>
                            <div className="flex gap-2">
                                <Button 
                                    variant="ghost" 
                                    className="rounded-full font-semibold" 
                                    onClick={() => {
                                        setShowCommentButtons(false);
                                        setNewCommentText("");
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    className="rounded-full font-semibold" 
                                    onClick={submitComment} 
                                    disabled={!newCommentText.trim() || createComment.isPending}
                                >
                                    Comment
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Comment List */}
            {isLoading ? (
                <div className="flex flex-col gap-6 w-full animate-pulse">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-4 w-full">
                            <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
                            <div className="flex flex-col gap-2 w-full pt-1">
                                <div className="h-3 bg-muted rounded w-1/4" />
                                <div className="h-3 bg-muted rounded w-3/4" />
                                <div className="h-3 bg-muted rounded w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : comments.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                    <p>No comments yet. Be the first to start the conversation!</p>
                </div>
            ) : (
                <div className="flex flex-col w-full">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {comments.map((comment: any) => (
                        <CommentItem 
                            key={comment.id} 
                            comment={comment} 
                            videoId={videoId} 
                        />
                    ))}
                    
                    {/* Infinite Scroll trigger sentinel */}
                    {hasNextPage && (
                        <div ref={ref} className="h-20 w-full flex items-center justify-center -mt-4">
                            {isFetchingNextPage ? (
                                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <div className="h-2 w-2 bg-foreground/20 rounded-full animate-pulse" />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
