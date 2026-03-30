"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
    IconThumbUp,
    IconChartBar,
    IconPlayerPlay,
} from "@tabler/icons-react";
import { getMediaUrl, cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc-client";
import { AuthorAvatar, AuthorName } from "@/components/custom/author-display";
import { toast } from "sonner";
import type { RouterOutputs } from "@/lib/trpc-client";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommunityPost = RouterOutputs["community"]["getChannelPosts"]["items"][number];

interface CommunityCardProps {
    post: CommunityPost;
    /** If channel info is not embedded in the post (e.g. from home feed), pass it here */
    channelOverride?: {
        id: string;
        name: string | null;
        handle: string | null;
        image: string | null;
    };
}

// ---------------------------------------------------------------------------
// Content Parser – @mentions + URLs
// ---------------------------------------------------------------------------

function parseContent(content: string): React.ReactNode[] {
    if (!content) return [];

    // Match @handle or URLs
    const regex = /(@[\w.-]+)|(https?:\/\/[^\s]+)/g;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
        // Push text before match
        if (match.index > lastIdx) {
            parts.push(content.slice(lastIdx, match.index));
        }

        if (match[1]) {
            // @mention
            const handle = match[1].slice(1); // Remove @
            parts.push(
                <Link
                    key={`mention-${match.index}`}
                    href={`/@${handle}`}
                    className="text-primary font-semibold hover:underline"
                >
                    {match[1]}
                </Link>
            );
        } else if (match[2]) {
            // URL
            parts.push(
                <a
                    key={`url-${match.index}`}
                    href={match[2]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all"
                >
                    {match[2]}
                </a>
            );
        }

        lastIdx = match.index + match[0].length;
    }

    // Push remaining text
    if (lastIdx < content.length) {
        parts.push(content.slice(lastIdx));
    }

    return parts;
}

// ---------------------------------------------------------------------------
// Image Carousel
// ---------------------------------------------------------------------------

function ImageCarousel({ urls }: { urls: string[] }) {
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, dragFree: false });
    const [selectedIdx, setSelectedIdx] = useState(0);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIdx(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    // Attach select listener
    useState(() => {
        if (emblaApi) emblaApi.on("select", onSelect);
    });

    if (urls.length === 1) {
        return (
            <div className="mt-4 rounded-xl overflow-hidden border border-border/50 max-h-[500px] flex items-center justify-center bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={getMediaUrl(urls[0])}
                    alt="Post attachment"
                    className="object-contain max-h-[500px] w-full"
                    loading="lazy"
                />
            </div>
        );
    }

    return (
        <div className="mt-4 relative">
            <div className="overflow-hidden rounded-xl border border-border/50" ref={emblaRef}>
                <div className="flex">
                    {urls.map((url, i) => (
                        <div key={i} className="flex-[0_0_100%] min-w-0">
                            <div className="max-h-[500px] flex items-center justify-center bg-muted/30">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={getMediaUrl(url)}
                                    alt={`Attachment ${i + 1}`}
                                    className="object-contain max-h-[500px] w-full"
                                    loading="lazy"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {/* Dot indicators */}
            {urls.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-3">
                    {urls.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => emblaApi?.scrollTo(i)}
                            className={cn(
                                "w-2 h-2 rounded-full transition-all",
                                i === selectedIdx
                                    ? "bg-primary w-4"
                                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                            )}
                            aria-label={`Go to image ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Interactive Poll
// ---------------------------------------------------------------------------

function InteractivePoll({
    post,
}: {
    post: CommunityPost;
}) {
    const options = (post.pollOptions as string[]) || [];
    const [localResults, setLocalResults] = useState<Record<string, number>>(
        (post.pollResults as Record<string, string | number>) 
            ? Object.fromEntries(
                Object.entries(post.pollResults as Record<string, string | number>).map(
                    ([k, v]) => [k, typeof v === "string" ? parseInt(v, 10) : v]
                )
              )
            : {}
    );
    const [hasVoted, setHasVoted] = useState(post.hasVoted ?? false);
    const [votedIdx, setVotedIdx] = useState<number | null>(post.votedOptionIndex ?? null);

    const voteMutation = trpc.community.votePoll.useMutation({
        onSuccess: (data) => {
            setHasVoted(true);
            setVotedIdx(data.votedOptionIndex);
            // Update results from server
            if (data.pollResults) {
                setLocalResults(
                    Object.fromEntries(
                        Object.entries(data.pollResults as Record<string, string | number>).map(
                            ([k, v]) => [k, typeof v === "string" ? parseInt(v, 10) : v]
                        )
                    )
                );
            }
        },
        onError: (err) => {
            toast.error(err.message);
        },
    });

    const totalVotes = Object.values(localResults).reduce((sum, v) => sum + v, 0);
    const pollExpired = post.pollEndsAt ? new Date() > new Date(post.pollEndsAt) : false;
    const showResults = hasVoted || pollExpired;

    const handleVote = (idx: number) => {
        if (hasVoted || pollExpired || voteMutation.isPending) return;
        // Optimistic update
        setHasVoted(true);
        setVotedIdx(idx);
        setLocalResults((prev) => ({
            ...prev,
            [idx.toString()]: (prev[idx.toString()] || 0) + 1,
        }));
        voteMutation.mutate({ postId: post.id, optionIndex: idx });
    };

    return (
        <div className="mt-4 space-y-2 border border-border/50 rounded-xl p-4 bg-muted/10">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-muted-foreground">
                <IconChartBar size={16} /> Poll
                {pollExpired && (
                    <span className="text-xs text-destructive font-medium ml-auto">Ended</span>
                )}
            </div>
            {options.map((opt, idx) => {
                const count = localResults[idx.toString()] || 0;
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const isSelected = votedIdx === idx;

                return (
                    <button
                        key={idx}
                        onClick={() => handleVote(idx)}
                        disabled={showResults}
                        className={cn(
                            "relative w-full h-11 border rounded-lg overflow-hidden flex items-center px-4 transition-all text-left",
                            showResults
                                ? "cursor-default border-border/40"
                                : "cursor-pointer border-border/60 hover:bg-muted/40 hover:border-primary/30",
                            isSelected && "border-primary/50 ring-1 ring-primary/20"
                        )}
                    >
                        {/* Animated percentage bar */}
                        <AnimatePresence>
                            {showResults && (
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.6, ease: "easeOut" }}
                                    className={cn(
                                        "absolute inset-y-0 left-0 rounded-lg",
                                        isSelected
                                            ? "bg-primary/15"
                                            : "bg-muted/40"
                                    )}
                                />
                            )}
                        </AnimatePresence>
                        <span className="relative z-10 text-sm font-medium flex-1">
                            {String(opt)}
                        </span>
                        {showResults && (
                            <motion.span
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                className="relative z-10 text-xs font-bold text-muted-foreground ml-2"
                            >
                                {pct}%
                            </motion.span>
                        )}
                    </button>
                );
            })}
            {showResults && (
                <p className="text-xs text-muted-foreground/70 mt-2 pt-1">
                    {totalVotes.toLocaleString()} vote{totalVotes !== 1 ? "s" : ""}
                </p>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Video Teaser Card
// ---------------------------------------------------------------------------

function VideoTeaserCard({ content }: { content: string }) {
    // Try to extract a video ID from the content.
    // Supports: /watch/CUID, or just a raw CUID-like string
    const videoIdMatch = content.match(/\/watch\/([a-zA-Z0-9_-]+)/)?.[1]
        || content.match(/^([a-z][a-z0-9]{20,30})$/i)?.[1];

    if (!videoIdMatch) {
        // Fallback: render content as a link
        return (
            <div className="mt-4 p-4 rounded-xl border border-border/50 bg-muted/10">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <IconPlayerPlay size={16} /> Video
                </div>
                <p className="text-sm">{parseContent(content)}</p>
            </div>
        );
    }

    return (
        <Link
            href={`/watch/${videoIdMatch}`}
            className="mt-4 flex items-center gap-4 p-3 rounded-xl border border-border/50 bg-muted/10 hover:bg-muted/20 transition-colors group"
        >
            <div className="w-32 aspect-video bg-muted/40 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                <IconPlayerPlay size={24} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </div>
            <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-primary group-hover:underline truncate">
                    Watch this video →
                </span>
                <span className="text-xs text-muted-foreground mt-1 truncate">
                    /watch/{videoIdMatch}
                </span>
            </div>
        </Link>
    );
}

// ---------------------------------------------------------------------------
// Main Community Card
// ---------------------------------------------------------------------------

export function CommunityCard({ post, channelOverride }: CommunityCardProps) {
    const author = channelOverride || post.author;
    const [liked, setLiked] = useState(post.isLiked ?? false);
    const [likesCount, setLikesCount] = useState(post.likeCount);
    const [expanded, setExpanded] = useState(false);

    const toggleLike = trpc.community.togglePostLike.useMutation({
        onError: () => {
            setLiked(!liked);
            setLikesCount(liked ? likesCount + 1 : Math.max(0, likesCount - 1));
            toast.error("Failed to update like");
        },
    });

    const handleLikeClick = () => {
        const nextLiked = !liked;
        setLiked(nextLiked);
        setLikesCount(nextLiked ? likesCount + 1 : Math.max(0, likesCount - 1));
        toggleLike.mutate({ postId: post.id });
    };

    if (!author) return null;
    const channelHref = author.handle ? `/@${author.handle}` : "#";
    const contentIsLong = (post.content?.length ?? 0) > 300;

    return (
        <Card className="w-full bg-card overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 group border-border/40 backdrop-blur-sm">
            <div className="p-4 sm:p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Link href={channelHref} className="shrink-0">
                            <AuthorAvatar author={author} disableLink={true} className="w-10 h-10 sm:w-11 sm:h-11 border-2 border-background shadow-sm group-hover:border-primary/20 transition-all" />
                        </Link>
                        <div className="flex flex-col min-w-0">
                            <AuthorName author={author} className="font-bold text-[15px] sm:text-[16px] leading-tight hover:text-primary transition-colors truncate" />
                            <div className="flex items-center gap-1.5 text-[12px] sm:text-[13px] text-muted-foreground/80 mt-0.5">
                                <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                                {post.isEdited && (
                                    <>
                                        <span className="text-[10px] opacity-40">●</span>
                                        <span className="italic">Edited</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {post.content && (
                        <div className="mb-1">
                            <p className={cn(
                                "text-[15px] leading-relaxed whitespace-pre-wrap break-words text-foreground/90",
                                !expanded && contentIsLong && "line-clamp-6"
                            )}>
                                {parseContent(post.content)}
                            </p>
                            {contentIsLong && (
                                <button
                                    onClick={() => setExpanded(!expanded)}
                                    className="text-sm text-primary font-semibold mt-1 hover:underline text-left block"
                                >
                                    {expanded ? "Show less" : "Read more"}
                                </button>
                            )}
                        </div>
                    )}

                    {post.type === "IMAGE" && post.imageUrls && Array.isArray(post.imageUrls) && post.imageUrls.length > 0 && (
                        <ImageCarousel urls={post.imageUrls} />
                    )}

                    {post.type === "POLL" && post.pollOptions && Array.isArray(post.pollOptions) && (
                        <InteractivePoll post={post} />
                    )}

                    {post.type === "VIDEO_TEASER" && post.content && (
                        <VideoTeaserCard content={post.content} />
                    )}
                </div>

                <div className="mt-4 flex items-center gap-6 text-muted-foreground pt-2 border-t border-border/10">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn("rounded-full px-3 h-9 transition-colors", liked && "text-primary bg-primary/5 hover:bg-primary/10")}
                        onClick={handleLikeClick}
                        disabled={toggleLike.isPending}
                    >
                        <IconThumbUp size={18} className={cn("mr-1.5", liked && "fill-primary")} />
                        <span className="text-xs font-bold">
                            {likesCount > 0 ? likesCount.toLocaleString() : ""}
                        </span>
                    </Button>
                </div>
            </div>
        </Card>
    );
}
