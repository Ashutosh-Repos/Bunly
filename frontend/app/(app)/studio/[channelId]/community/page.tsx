"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { useStudio } from "../_components/studio-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
    IconSend,
    IconPhoto,
    IconChartBar,
    IconPlus,
    IconX,
    IconLoader2,
    IconUpload,
    IconHeart,
    IconTrash,
} from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import { getMediaUrl } from "@/lib/utils";

export default function StudioCommunityPage() {
    const { channel } = useStudio();
    const [content, setContent] = useState("");
    const [postType, setPostType] = useState<"TEXT" | "IMAGE" | "POLL">("TEXT");

    // Poll state
    const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

    // Image state
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const utils = trpc.useUtils();

    const { data, isLoading } = trpc.community.getChannelPosts.useQuery({
        channelId: channel.id,
    });

    const createMutation = trpc.community.createPost.useMutation({
        onSuccess: () => {
            setContent("");
            setPollOptions(["", ""]);
            setImageFile(null);
            setImagePreview(null);
            setPostType("TEXT");
            toast.success("Community post published!");
            utils.community.getChannelPosts.invalidate({ channelId: channel.id });
        },
        onError: (err) => {
            toast.error("Failed to post: " + err.message);
        },
    });

    const deleteMutation = trpc.community.deletePost.useMutation({
        onSuccess: () => {
            toast.success("Post deleted");
            utils.community.getChannelPosts.invalidate({ channelId: channel.id });
        },
    });

    const uploadPresignedUrl = trpc.upload.getPresignedUrl.useMutation();

    const addPollOption = () => {
        if (pollOptions.length >= 5) return;
        setPollOptions([...pollOptions, ""]);
    };

    const removePollOption = (index: number) => {
        if (pollOptions.length <= 2) return;
        setPollOptions(pollOptions.filter((_, i) => i !== index));
    };

    const updatePollOption = (index: number, value: string) => {
        const updated = [...pollOptions];
        updated[index] = value;
        setPollOptions(updated);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be under 5MB");
            return;
        }
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const uploadImage = async (): Promise<string | null> => {
        if (!imageFile) return null;
        setIsUploading(true);
        try {
            const { url, fields, key } = await uploadPresignedUrl.mutateAsync({
                filename: imageFile.name,
                contentType: imageFile.type,
                type: "community-post",
            });

            // Upload via presigned POST
            const formData = new FormData();
            Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
            formData.append("file", imageFile);

            await fetch(url, { method: "POST", body: formData });

            return key;
        } catch {
            toast.error("Failed to upload image");
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    const handlePost = async () => {
        if (postType === "TEXT" && !content.trim()) return;

        if (postType === "POLL") {
            const validOptions = pollOptions.filter((o) => o.trim());
            if (validOptions.length < 2) {
                toast.error("Please provide at least 2 poll options");
                return;
            }
            createMutation.mutate({
                channelId: channel.id,
                type: "POLL",
                content: content.trim(),
                pollOptions: validOptions,
            });
            return;
        }

        if (postType === "IMAGE") {
            if (!imageFile && !content.trim()) {
                toast.error("Please select an image or write some text");
                return;
            }

            let attachments: string[] | undefined;
            if (imageFile) {
                const key = await uploadImage();
                if (key) {
                    attachments = [getMediaUrl(key)];
                }
            }
            createMutation.mutate({
                channelId: channel.id,
                type: "IMAGE",
                content: content.trim() || undefined,
                attachments,
            });
            return;
        }

        // TEXT
        createMutation.mutate({
            channelId: channel.id,
            type: postType,
            content: content.trim(),
        });
    };

    const posts = data?.items || [];

    return (
        <div className="flex flex-col h-full bg-background p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Community</h1>
                <p className="text-muted-foreground">
                    Engage with your fans through text posts, images, and polls.
                </p>
            </div>

            {/* Composer */}
            <Card>
                <CardContent className="p-6 space-y-4">
                    <Textarea
                        placeholder={
                            postType === "POLL"
                                ? "Add a question for your poll..."
                                : "What's on your mind?"
                        }
                        className="resize-none min-h-[100px] bg-background border-border/50 focus-visible:ring-1 text-[15px]"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />

                    {/* Poll Options */}
                    {postType === "POLL" && (
                        <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/30">
                            <p className="text-sm font-semibold text-muted-foreground">Poll Options</p>
                            {pollOptions.map((option, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-muted-foreground w-5">
                                        {index + 1}.
                                    </span>
                                    <Input
                                        placeholder={`Option ${index + 1}`}
                                        value={option}
                                        onChange={(e) => updatePollOption(index, e.target.value)}
                                        maxLength={200}
                                        className="flex-1"
                                    />
                                    {pollOptions.length > 2 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => removePollOption(index)}
                                        >
                                            <IconX size={14} />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            {pollOptions.length < 5 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addPollOption}
                                    className="gap-1.5"
                                >
                                    <IconPlus size={14} /> Add option
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Image Upload */}
                    {postType === "IMAGE" && (
                        <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/30">
                            {imagePreview ? (
                                <div className="relative">
                                    <Image
                                        src={imagePreview}
                                        alt="Preview"
                                        width={400}
                                        height={300}
                                        unoptimized
                                        className="rounded-lg object-cover max-h-64 w-auto"
                                    />
                                    <Button
                                        variant="secondary"
                                        size="icon"
                                        className="absolute top-2 right-2 h-7 w-7"
                                        onClick={() => {
                                            setImageFile(null);
                                            setImagePreview(null);
                                        }}
                                    >
                                        <IconX size={14} />
                                    </Button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                                    <IconUpload size={24} className="text-muted-foreground mb-2" />
                                    <span className="text-sm text-muted-foreground font-medium">
                                        Click to upload an image
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                        Max 5MB • JPG, PNG, GIF, WebP
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageSelect}
                                    />
                                </label>
                            )}
                        </div>
                    )}

                    <Separator />

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
                            disabled={createMutation.isPending || isUploading}
                            className="rounded-full font-bold px-6"
                        >
                            {createMutation.isPending || isUploading ? (
                                <>
                                    <IconLoader2 className="animate-spin mr-2 h-4 w-4" />
                                    {isUploading ? "Uploading..." : "Posting..."}
                                </>
                            ) : (
                                <>
                                    Post <IconSend size={16} className="ml-2" />
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Published Posts */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold tracking-tight mt-8 mb-4 border-b border-border/40 pb-2">
                    Your Posts
                </h2>

                {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <IconLoader2 className="animate-spin text-muted-foreground" />
                    </div>
                ) : posts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 border border-border/20 border-dashed rounded-xl">
                        <p className="text-muted-foreground font-medium">
                            You haven&apos;t published any posts yet.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {posts.map((post) => (
                            <Card key={post.id}>
                                <CardContent className="p-5 flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="secondary" className="uppercase tracking-wider text-[10px]">
                                            {post.type}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(post.createdAt), {
                                                addSuffix: true,
                                            })}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    {post.content && (
                                        <p className="text-[15px] whitespace-pre-wrap">{post.content}</p>
                                    )}

                                    {/* Render Images */}
                                    {post.type === "IMAGE" &&
                                        post.imageUrls &&
                                        (post.imageUrls as string[]).length > 0 && (
                                            <div className="flex gap-2 flex-wrap">
                                                {(post.imageUrls as string[]).map((url, i) => (
                                                    <Image
                                                        key={i}
                                                        src={getMediaUrl(url)}
                                                        alt={`Post image ${i + 1}`}
                                                        width={300}
                                                        height={200}
                                                        unoptimized
                                                        className="rounded-lg object-cover max-h-48"
                                                    />
                                                ))}
                                            </div>
                                        )}

                                    {/* Render Poll */}
                                    {post.type === "POLL" &&
                                        post.pollOptions &&
                                        (post.pollOptions as string[]).length > 0 && (
                                            <div className="space-y-2 p-3 bg-muted/20 rounded-lg">
                                                {(post.pollOptions as string[]).map((option, i) => {
                                                    const results = (post.pollResults || {}) as Record<string, number>;
                                                    const votes = results[i.toString()] || 0;
                                                    const totalVotes = Object.values(results).reduce(
                                                        (sum, v) => sum + (v as number),
                                                        0
                                                    );
                                                    const percentage =
                                                        totalVotes > 0
                                                            ? Math.round((votes / totalVotes) * 100)
                                                            : 0;

                                                    return (
                                                        <div key={i} className="space-y-1">
                                                            <div className="flex items-center justify-between text-sm">
                                                                <span className="font-medium">{option}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {percentage}% ({votes})
                                                                </span>
                                                            </div>
                                                            <Progress value={percentage} className="h-2" />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                    <div className="mt-2 flex items-center justify-between">
                                        <div className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                                            <IconHeart size={14} /> {post.likeCount} Likes
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30"
                                            onClick={() => {
                                                if (confirm("Delete this post?")) {
                                                    deleteMutation.mutate({
                                                        channelId: channel.id,
                                                        postId: post.id,
                                                    });
                                                }
                                            }}
                                        >
                                            <IconTrash size={14} className="mr-1.5" /> Delete
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
