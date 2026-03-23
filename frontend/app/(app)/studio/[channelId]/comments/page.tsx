"use client";

import { useStudio } from "../_components/studio-provider";
import { trpc } from "@/lib/trpc-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { IconHeart, IconTrash, IconMessageCircle, IconVideo } from "@tabler/icons-react";
import { toast } from "sonner";
import { getMediaUrl } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";

export default function StudioCommentsPage() {
    const { channel } = useStudio();
    const utils = trpc.useUtils();

    const { data, isLoading, refetch } = trpc.comment.getChannelComments.useInfiniteQuery(
        { channelId: channel.id, limit: 20 },
        { getNextPageParam: (l) => l.nextCursor }
    );

    const deleteMutation = trpc.comment.delete.useMutation({
        onSuccess: () => {
            toast.success("Comment deleted.");
            refetch();
        }
    });

    const heartMutation = trpc.comment.heart.useMutation({
        onMutate: async () => {
            await utils.comment.getChannelComments.cancel();
            toast.success("Heart toggled!");
            // In a real app we'd optimistically update the infinite query 
        },
        onSettled: () => refetch()
    });

    const comments = data?.pages.flatMap(p => p.items) || [];

    return (
        <div className="flex flex-col h-full bg-background p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Channel Comments</h1>
                <p className="text-muted-foreground">Review and engage with comments across all your videos.</p>
            </div>

            <div className="bg-surface-1 rounded-2xl border border-border/40 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border/20 bg-muted/30 font-bold flex items-center gap-2">
                    <IconMessageCircle className="text-primary" size={18} /> Inbox
                </div>

                <div className="divide-y divide-border/20">
                    {isLoading ? (
                        <div className="p-12 text-center text-muted-foreground animate-pulse">Loading comments...</div>
                    ) : comments.length === 0 ? (
                        <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center">
                            <IconMessageCircle size={48} className="text-muted-foreground/30 mb-4" />
                            <p className="font-bold text-lg">No comments yet</p>
                            <p className="text-sm">When viewers comment on your videos, they&apos;ll appear here.</p>
                        </div>
                    ) : (
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        comments.map((comment: any) => (
                            <div key={comment.id} className="p-6 flex flex-col md:flex-row gap-6 hover:bg-muted/10 transition-colors group">
                                
                                {/* User Avatar */}
                                <Avatar className="w-10 h-10 border shrink-0">
                                    <AvatarImage src={comment.user?.channels[0]?.image || comment.user?.image ? getMediaUrl(comment.user.channels[0]?.image || comment.user.image) : undefined} />
                                    <AvatarFallback className="font-bold">
                                        {(comment.user?.name || "U")[0].toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm">
                                            {comment.user?.channels[0]?.name || comment.user?.name || "Unknown User"}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                    
                                    <p className="text-[15px] whitespace-pre-wrap">{comment.content}</p>

                                    <div className="flex items-center gap-2 mt-2 pt-2">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                            onClick={() => heartMutation.mutate({ commentId: comment.id, videoId: comment.videoId })}
                                        >
                                            <IconHeart size={16} className="mr-1.5" /> Heart
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => {
                                                if(confirm("Remove this comment?")) {
                                                    deleteMutation.mutate({ commentId: comment.id });
                                                }
                                            }}
                                        >
                                            <IconTrash size={16} className="mr-1.5" /> Remove
                                        </Button>
                                    </div>
                                </div>

                                {/* Video Target Reference */}
                                <Link href={`/watch/${comment.videos.id}`} target="_blank" className="shrink-0 w-32 group-hover:opacity-100 opacity-80 transition-opacity">
                                    <div className="aspect-video bg-muted rounded border border-border/20 overflow-hidden relative flex items-center justify-center">
                                        {comment.videos.thumbnailUrl ? (
                                            <Image src={getMediaUrl(comment.videos.thumbnailUrl)} alt={comment.videos.title} fill className="object-cover" />
                                        ) : (
                                            <IconVideo size={16} className="text-muted-foreground/30" />
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
            </div>
        </div>
    );
}
