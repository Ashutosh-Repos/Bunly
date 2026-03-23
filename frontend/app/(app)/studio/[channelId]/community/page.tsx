"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { useStudio } from "../_components/studio-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { IconSend, IconPhoto, IconChartBar } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";

export default function StudioCommunityPage() {
    const { channel } = useStudio();
    const [content, setContent] = useState("");
    const [postType, setPostType] = useState<"TEXT" | "IMAGE" | "POLL">("TEXT");

    const utils = trpc.useUtils();

    const { data, isLoading } = trpc.community.getChannelPosts.useQuery({ channelId: channel.id });

    const createMutation = trpc.community.createPost.useMutation({
        onSuccess: () => {
            setContent("");
            toast.success("Community post published!");
            utils.community.getChannelPosts.invalidate({ channelId: channel.id });
        },
        onError: (err) => {
            toast.error("Failed to post: " + err.message);
        }
    });

    const deleteMutation = trpc.community.deletePost.useMutation({
        onSuccess: () => {
            toast.success("Post deleted");
            utils.community.getChannelPosts.invalidate({ channelId: channel.id });
        }
    });

    const handlePost = () => {
        if (!content.trim()) return;
        createMutation.mutate({
            channelId: channel.id,
            type: postType,
            content: content.trim()
        });
    };

    const posts = data?.items || [];

    return (
        <div className="flex flex-col h-full bg-background p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Community</h1>
                <p className="text-muted-foreground">Engage with your fans through text posts, images, and polls.</p>
            </div>

            {/* Composer */}
            <Card className="p-6 border-border/40 shadow-none bg-surface-1">
                <Textarea 
                    placeholder="What's on your mind?"
                    className="resize-none min-h-[120px] mb-4 bg-background border-border/50 focus-visible:ring-1 text-[15px]"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button 
                            variant={postType === "TEXT" ? "secondary" : "ghost"} 
                            size="sm" 
                            onClick={() => setPostType("TEXT")}
                            className="rounded-full font-semibold"
                        >
                            Text
                        </Button>
                        <Button 
                            variant={postType === "IMAGE" ? "secondary" : "ghost"} 
                            size="sm" 
                            onClick={() => setPostType("IMAGE")}
                            className="rounded-full font-semibold"
                        >
                            <IconPhoto size={16} className="mr-2" /> Image
                        </Button>
                        <Button 
                            variant={postType === "POLL" ? "secondary" : "ghost"} 
                            size="sm" 
                            onClick={() => setPostType("POLL")}
                            className="rounded-full font-semibold"
                        >
                            <IconChartBar size={16} className="mr-2" /> Poll
                        </Button>
                    </div>

                    <Button 
                        onClick={handlePost} 
                        disabled={!content.trim() || createMutation.isPending}
                        className="rounded-full font-bold px-6"
                    >
                        {createMutation.isPending ? "Posting..." : "Post"} <IconSend size={16} className="ml-2" />
                    </Button>
                </div>
            </Card>

            {/* Published Posts */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold tracking-tight mt-8 mb-4 border-b border-border/40 pb-2">Your Posts</h2>
                
                {isLoading ? (
                    <div className="animate-pulse h-32 bg-muted/20 rounded-xl" />
                ) : posts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 border border-border/20 border-dashed rounded-xl">
                        <p className="text-muted-foreground font-medium">You haven&apos;t published any posts yet.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {posts.map((post) => (
                            <Card key={post.id} className="p-5 flex flex-col gap-3 border-border/40 shadow-none">
                                <div className="flex justify-between items-start">
                                    <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase tracking-wider">
                                        {post.type}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                                    </span>
                                </div>
                                
                                <p className="text-[15px] whitespace-pre-wrap">{post.content}</p>
                                
                                <div className="mt-2 flex items-center justify-between">
                                    <div className="text-sm font-semibold text-muted-foreground flex items-center gap-4">
                                        <span>{post.likeCount} Likes</span>
                                    </div>
                                    <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30"
                                        onClick={() => {
                                            if (confirm("Delete this post?")) {
                                                deleteMutation.mutate({ channelId: channel.id, postId: post.id });
                                            }
                                        }}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
