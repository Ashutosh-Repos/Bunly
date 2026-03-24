"use client";

import { useEffect, useState, useRef } from "react";
import { trpc } from "@/lib/trpc-client";
import { ShortsPlayer } from "@/components/custom/shorts-player";
import { IconFlame, IconThumbUpFilled, IconThumbDownFilled, IconMessageCircle, IconShare } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { getMediaUrl } from "@/lib/utils";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";

export function ShortsClient() {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = trpc.feed.getTrendingShorts.useInfiniteQuery(
        {},
        { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    );

    const containerRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const activeIndexRef = useRef(activeIndex);
    activeIndexRef.current = activeIndex;

    const { ref: loadMoreRef, inView: loadMoreInView } = useInView({ threshold: 0 });

    useEffect(() => {
        if (loadMoreInView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [loadMoreInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const videos = data?.pages.flatMap(p => p.videos) || [];

    // Scroll snap handler — uses ref to avoid re-registration on every scroll
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const index = Math.round(container.scrollTop / container.clientHeight);
            if (index !== activeIndexRef.current) {
                setActiveIndex(index);
            }
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        return () => container.removeEventListener("scroll", handleScroll);
    }, []);

    if (isLoading) {
        return (
            <div className="h-[calc(100vh-64px)] w-full flex items-center justify-center bg-black">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
            </div>
        );
    }

    if (videos.length === 0) {
        return (
            <div className="h-[calc(100vh-64px)] w-full flex flex-col items-center justify-center bg-black text-white px-4 text-center">
                <IconFlame className="w-16 h-16 text-white/30 mb-4" />
                <h2 className="text-xl font-bold">No Shorts available</h2>
                <p className="text-white/60 text-sm max-w-xs mt-2">Try uploading some vertical videos under 60 seconds.</p>
            </div>
        );
    }

    return (
        <div 
            ref={containerRef}
            className="h-[calc(100vh-64px)] w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth bg-black relative"
            style={{ scrollbarWidth: "none" }}
        >
            <style jsx global>{`
                /* Hide scrollbar for Chrome, Safari and Opera */
                div::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
            
            {videos.map((video, idx) => (
                <div key={video.id} className="h-[calc(100vh-64px)] w-full snap-start snap-always relative flex justify-center pb-2 sm:pb-4 pt-2">
                    {/* Centered Video Player bounded to max mobile width for desktop viewing */}
                    <div className="relative h-full w-full max-w-[420px] bg-zinc-900 border-x border-y sm:border-y border-white/10 sm:rounded-2xl overflow-hidden shadow-2xl">
                        <ShortsPlayer videoId={video.id} hlsPlaylistUrl={video.hlsPlaylistUrl} isActive={activeIndex === idx} />

                        {/* Overlay Metadata */}
                        <div className="absolute bottom-0 left-0 right-16 p-4 pb-6 bg-linear-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
                            <div className="flex items-center gap-2 mb-3 pointer-events-auto">
                                <Link href={`/@${video.channels.handle}`}>
                                    <Avatar className="h-9 w-9 border border-white/20">
                                        <AvatarImage src={video.channels.image ? getMediaUrl(video.channels.image) : ""} />
                                        <AvatarFallback className="bg-white/20 text-white font-bold text-xs">
                                            {video.channels.name?.charAt(0) || "C"}
                                        </AvatarFallback>
                                    </Avatar>
                                </Link>
                                <Link href={`/@${video.channels.handle}`} className="text-white font-bold text-[15px] tracking-tight drop-shadow-md hover:underline">
                                    @{video.channels.handle}
                                </Link>
                                <SubscribeButton channelId={video.channelId} />
                            </div>
                            <h3 className="text-white text-[15px] font-medium leading-snug drop-shadow-md line-clamp-2">
                                {video.title}
                            </h3>
                        </div>

                        {/* Right Actions Bar */}
                        <div className="absolute bottom-6 right-2 flex flex-col items-center gap-5 z-10 w-14">
                            <ShortsEngagement videoId={video.id} isActive={activeIndex === idx} />
                            <ActionIcon icon={<IconMessageCircle size={22} />} label="Comments" onClick={() => toast.info("Comments coming soon!")} />
                            <ActionIcon icon={<IconShare size={22} />} label="Share" onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/shorts/${video.id}`);
                                toast.success("Link copied!");
                            }} />
                            <Link href={`/@${video.channels.handle}`}>
                                <Avatar className="h-10 w-10 mt-3 border-[3px] border-white pointer-events-auto shadow-xl">
                                    <AvatarImage src={video.channels.image ? getMediaUrl(video.channels.image) : ""} />
                                    <AvatarFallback>{video.channels.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </Link>
                        </div>
                    </div>
                </div>
            ))}
            
            {/* Sentinel for infinite loading */}
            {hasNextPage && (
                <div ref={loadMoreRef} className="h-[calc(100vh-64px)] w-full snap-start flex items-center justify-center pb-2 pt-2">
                    <div className="relative h-full w-full max-w-[420px] bg-zinc-900 border border-white/10 sm:rounded-2xl flex items-center justify-center">
                        <div className="h-8 w-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                </div>
            )}
        </div>
    );
}

function ActionIcon({ icon, label, onClick, active }: { icon: React.ReactNode, label: string, onClick?: () => void, active?: boolean }) {
    return (
        <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all drop-shadow-lg group ${active ? 'text-primary' : 'text-white hover:text-white/80'}`}>
            <div className="h-11 w-11 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center group-hover:bg-black/60 group-active:scale-90 transition-all">
                {icon}
            </div>
            <span className="text-[11px] font-semibold">{label}</span>
        </button>
    );
}

/**
 * Consolidated Like/Dislike engagement component.
 * - Single getReaction query shared between both buttons (fixes R2)
 * - Mutual exclusion: liking clears dislike and vice versa (fixes S3)
 * - Registers view count when Short becomes active (fixes S2)
 */
function ShortsEngagement({ videoId, isActive }: { videoId: string; isActive: boolean }) {
    const { data: reaction } = trpc.engagement.getReaction.useQuery({ videoId });
    const [liked, setLiked] = useState(false);
    const [disliked, setDisliked] = useState(false);

    // S2: Register view when this Short becomes active
    const registerView = trpc.video.registerView.useMutation();
    const viewRegisteredRef = useRef(false);
    useEffect(() => {
        if (isActive && !viewRegisteredRef.current) {
            viewRegisteredRef.current = true;
            registerView.mutate({ videoId });
        }
    }, [isActive, videoId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync initial state from server
    useEffect(() => {
        if (reaction?.type === "LIKE") {
            setLiked(true);
            setDisliked(false);
        } else if (reaction?.type === "DISLIKE") {
            setLiked(false);
            setDisliked(true);
        } else {
            setLiked(false);
            setDisliked(false);
        }
    }, [reaction]);

    const toggleLike = trpc.engagement.toggleLike.useMutation({
        onSuccess: (data) => {
            if (data.status === "LIKE") {
                setLiked(true);
                setDisliked(false); // Mutual exclusion
            } else {
                setLiked(false);
            }
        },
    });

    const toggleDislike = trpc.engagement.toggleDislike.useMutation({
        onSuccess: (data) => {
            if (data.status === "DISLIKE") {
                setDisliked(true);
                setLiked(false); // Mutual exclusion
            } else {
                setDisliked(false);
            }
        },
    });

    return (
        <>
            <ActionIcon
                icon={<IconThumbUpFilled size={22} />}
                label="Like"
                active={liked}
                onClick={() => toggleLike.mutate({ videoId })}
            />
            <ActionIcon
                icon={<IconThumbDownFilled size={22} />}
                label="Dislike"
                active={disliked}
                onClick={() => toggleDislike.mutate({ videoId })}
            />
        </>
    );
}

/**
 * Subscribe button with server-hydrated initial state (fixes S1).
 * Uses functional updater to avoid stale closure.
 */
function SubscribeButton({ channelId }: { channelId: string }) {
    const { data: subStatus } = trpc.channel.getSubscriptionStatus.useQuery({ channelId });
    const [subscribed, setSubscribed] = useState(false);

    // Sync initial state from server
    useEffect(() => {
        if (subStatus?.subscribed !== undefined) {
            setSubscribed(subStatus.subscribed);
        }
    }, [subStatus]);

    const toggleSub = trpc.channel.toggleSubscription.useMutation({
        onSuccess: () => {
            setSubscribed((prev) => {
                const next = !prev;
                toast.success(next ? "Subscribed!" : "Unsubscribed");
                return next;
            });
        },
    });
    return (
        <Button
            variant="secondary"
            size="sm"
            className={`h-7 px-3 text-xs ml-2 rounded-full font-bold ${subscribed ? 'bg-white/30 text-white hover:bg-white/40' : 'bg-white text-black hover:bg-white/90'}`}
            onClick={() => toggleSub.mutate({ channelId })}
            disabled={toggleSub.isPending}
        >
            {subscribed ? "Subscribed" : "Subscribe"}
        </Button>
    );
}
