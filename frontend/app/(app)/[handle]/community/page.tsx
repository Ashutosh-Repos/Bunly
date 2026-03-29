"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc-client";
import { IconMessageCircle, IconThumbUp, IconChartBar } from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RouterOutputs } from "@/lib/trpc-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useInView } from "react-intersection-observer";
import { useEffect, useState } from "react";
import { getMediaUrl } from "@/lib/utils";
import { toast } from "sonner";

export default function ChannelCommunityPage({ params }: { params: Promise<{ handle: string }> }) {
    const { handle } = use(params);
    const cleanHandle = decodeURIComponent(handle).slice(1);
    console.log(handle);

    const channelData = trpc.channel.getChannelByHandle.useQuery({ handle: cleanHandle }).data;
    const channel = channelData?.channel;
    const channelId = channel?.id;
    const utils = trpc.useUtils();

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = trpc.community.getChannelPosts.useInfiniteQuery(
        { channelId: channelId! },
        { 
            enabled: !!channelId,
            getNextPageParam: (l) => l.nextCursor,
        }
    );

    const toggleLike = trpc.community.togglePostLike.useMutation();

    const { ref, inView } = useInView({ threshold: 0 });

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    if (!channel || isLoading) return <div className="animate-pulse h-64 bg-muted/20 rounded-xl max-w-3xl mx-auto mt-8" />;

    const posts = data?.pages.flatMap(p => p.items) || [];

    if (posts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground mt-8">
                <IconMessageCircle className="w-12 h-12 mb-4 opacity-20" />
                <h3 className="text-lg font-bold text-foreground">No posts yet</h3>
                <p>This channel hasn&apos;t posted to their Community tab.</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto pb-24 space-y-6">
            {posts.map((post) => (
                <CommunityPostCard 
                    key={post.id} 
                    post={post} 
                    channel={channel} 
                    onLike={() => {
                        toggleLike.mutate({ postId: post.id }, {
                            onSuccess: (res) => {
                                // Optimistic UI could be handled here in the real world
                                // For now we just let react-query refetch or rely on toast
                                toast.success(res.status === "LIKED" ? "Liked post" : "Removed like");
                                utils.community.getChannelPosts.invalidate({ channelId });
                            }
                        });
                    }} 
                />
            ))}
            
            {hasNextPage && (
                <div ref={ref} className="h-24 w-full flex items-center justify-center mt-8">
                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    );
}

type Post = RouterOutputs["community"]["getChannelPosts"]["items"][0];
type ChannelInfo = NonNullable<RouterOutputs["channel"]["getChannelByHandle"]>["channel"];

function CommunityPostCard({ post, channel, onLike }: { post: Post, channel: ChannelInfo, onLike: () => void }) {
    // Basic local state for optimistic like toggle
    const [liked, setLiked] = useState(post.isLiked ?? false);
    const [likesCount, setLikesCount] = useState(post.likeCount);

    const handleLikeClick = () => {
        setLiked(!liked);
        setLikesCount(liked ? Math.max(0, likesCount - 1) : likesCount + 1);
        onLike();
    };

    return (
        <Card className="p-4 sm:p-6 bg-transparent border-border/40 shadow-none hover:bg-muted/10 transition-colors">
            <div className="flex gap-4">
                <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border cursor-pointer hover:opacity-90 shrink-0">
                    <AvatarImage src={channel.image ? getMediaUrl(channel.image) : ""} />
                    <AvatarFallback className="font-bold">
                        {(channel.name || "C").charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-[15px] cursor-pointer hover:text-primary transition-colors">
                            {channel.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                        </span>
                    </div>

                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground/90">
                        {post.content}
                    </p>

                    {/* IMAGE POST */}
                    {post.type === "IMAGE" && post.imageUrls && Array.isArray(post.imageUrls) && post.imageUrls.length > 0 && (
                        <div className="mt-4 rounded-xl overflow-hidden border border-border/50 max-h-[500px] flex items-center justify-center bg-muted/30">
                            {/* Assuming imageUrls[0] is an image url */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={getMediaUrl(post.imageUrls[0])} alt="Post attachment" className="object-contain max-h-[500px] w-full" style={{ height: "auto" }} />
                        </div>
                    )}

                    {/* POLL POST */}
                    {post.type === "POLL" && post.pollOptions && Array.isArray(post.pollOptions) && (
                        <div className="mt-4 space-y-2 border border-border/50 rounded-xl p-4 bg-muted/10">
                            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-muted-foreground">
                                <IconChartBar size={16} /> Poll
                            </div>
                            {post.pollOptions.map((optValue, idx: number) => {
                                const opt = String(optValue);
                                // Simplified poll UI for viewing
                                const resultCount = post.pollResults ? parseInt((post.pollResults as Record<string, string>)[idx.toString()] || "0") : 0;
                                return (
                                    <div key={idx} className="relative w-full h-10 border border-border/60 hover:bg-muted/40 cursor-pointer transition-colors rounded-md overflow-hidden flex items-center px-4">
                                        <span className="relative z-10 text-sm font-medium">{opt}</span>
                                        {Object.keys(post.pollResults || {}).length > 0 && (
                                            <span className="relative z-10 ml-auto text-xs font-bold opacity-60">{resultCount} votes</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Actions Menu */}
                    <div className="mt-4 flex items-center gap-6 text-muted-foreground">
                        <Button variant="ghost" size="sm" className={`rounded-full px-3 h-9 ${liked ? "text-primary" : ""}`} onClick={handleLikeClick}>
                            <IconThumbUp size={18} className={`mr-1.5 ${liked ? "fill-primary" : ""}`} />
                            <span className="text-xs font-bold">{likesCount > 0 ? likesCount : ""}</span>
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
