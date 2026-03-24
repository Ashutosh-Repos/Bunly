"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc-client";
import { notFound, usePathname } from "next/navigation";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconBellRinging, IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";
import { getMediaUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ChannelLayoutProps {
    children: React.ReactNode;
    params: Promise<{ handle: string }>;
}

export default function ChannelLayout({ children, params }: ChannelLayoutProps) {
    const resolvedParams = use(params);
    const decodedHandle = decodeURIComponent(resolvedParams.handle);
    
    // Only map routes starting with '@' to the Channel Layout
    if (!decodedHandle.startsWith("@")) {
        notFound();
    }

    const cleanHandle = decodedHandle.slice(1);
    const pathname = usePathname();

    const utils = trpc.useUtils();
    const { data, isLoading, isError } = trpc.channel.getChannelByHandle.useQuery({ handle: cleanHandle });
    
    const toggleSub = trpc.channel.toggleSubscription.useMutation({
        onMutate: async () => {
            await utils.channel.getChannelByHandle.cancel({ handle: cleanHandle });
            const previousData = utils.channel.getChannelByHandle.getData({ handle: cleanHandle });
            if (previousData?.channel) {
                const wasSubscribed = previousData.isSubscribed;
                utils.channel.getChannelByHandle.setData({ handle: cleanHandle }, {
                    ...previousData,
                    isSubscribed: !wasSubscribed,
                    channel: {
                        ...previousData.channel,
                        subscriberCount: Math.max(0, previousData.channel.subscriberCount + (wasSubscribed ? -1 : 1)),
                    },
                });
            }
            return { previousData };
        },
        onError: (_err, _input, context) => {
            if (context?.previousData) {
                utils.channel.getChannelByHandle.setData({ handle: cleanHandle }, context.previousData);
            }
        },
        onSettled: () => {
            // Delay: write-behind worker needs time to persist subscription to DB
            setTimeout(() => {
                utils.channel.getChannelByHandle.invalidate({ handle: cleanHandle });
            }, 3000);
        },
    });

    if (isLoading) {
        return (
            <div className="w-full animate-pulse">
                <div className="w-full aspect-6/1 md:aspect-8/1 bg-muted/50" />
                <div className="max-w-[1400px] mx-auto px-4 sm:px-8 flex items-end gap-6 -mt-8 sm:-mt-12 relative z-10">
                    <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-muted/80 border-4 border-background" />
                    <div className="flex-1 pb-4 flex flex-col gap-2">
                        <div className="h-8 bg-muted rounded w-48" />
                        <div className="h-4 bg-muted rounded w-32" />
                    </div>
                </div>
            </div>
        );
    }

    if (isError || !data?.channel) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <h1 className="text-2xl font-bold mb-2">Channel not found</h1>
                <p className="text-muted-foreground">This page isn&apos;t available. Sorry about that.</p>
                <Link href="/" className="mt-6">
                    <Button variant="outline">Go to Home</Button>
                </Link>
            </div>
        );
    }

    const { channel, isSubscribed } = data;

    const TABS = [
        { label: "Home", href: `/${decodedHandle}` },
        { label: "Videos", href: `/${decodedHandle}/videos` },
        { label: "Shorts", href: `/${decodedHandle}/shorts` },
        { label: "Playlists", href: `/${decodedHandle}/playlists` },
        { label: "Community", href: `/${decodedHandle}/community` },
    ];

    return (
        <div className="w-full min-h-screen bg-background pb-20">
            {/* Banner */}
            <div className="w-full aspect-6/1 md:aspect-8/1 md:max-h-[250px] relative bg-muted overflow-hidden">
                {channel.bannerUrl ? (
                    <Image
                        src={getMediaUrl(channel.bannerUrl)}
                        alt={`${channel.name} banner`}
                        fill
                        className="object-cover"
                        priority
                    />
                ) : (
                    <div className="absolute inset-0 bg-linear-to-r from-muted to-muted/50" />
                )}
            </div>

            <div className="max-w-[1400px] mx-auto">
                {/* Profile Header */}
                <div className="px-4 sm:px-8 pt-4 pb-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 bg-background relative z-10">
                    <Avatar className="w-24 h-24 sm:w-[160px] sm:h-[160px] border-4 border-background shadow-md shrink-0">
                        <AvatarImage src={channel.image ? getMediaUrl(channel.image) : ""} className="object-cover" />
                        <AvatarFallback className="text-4xl sm:text-6xl font-bold bg-muted">
                            {(channel.name || "C").charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 flex flex-col items-center sm:items-start pt-2">
                        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-1 truncate max-w-full">
                            {channel.name}
                        </h1>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-sm sm:text-[15px] text-muted-foreground font-medium mb-3">
                            <span className="text-foreground tracking-tight">@{channel.handle}</span>
                            <span>•</span>
                            <span>{channel.subscriberCount.toLocaleString()} subscribers</span>
                            <span>•</span>
                            <span>{channel.videoCount} videos</span>
                        </div>
                        
                        {channel.description && (
                            <p className="text-sm text-muted-foreground max-w-2xl line-clamp-2 md:line-clamp-3 mb-4 text-center sm:text-left leading-relaxed flex items-center gap-1 group cursor-pointer hover:text-foreground transition-colors">
                                {channel.description}
                                <IconChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </p>
                        )}
                        
                        <div className="mt-1">
                            {isSubscribed ? (
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="secondary" 
                                        className="rounded-full font-bold px-6 shadow-sm border"
                                        onClick={() => toggleSub.mutate({ channelId: channel.id })}
                                        disabled={toggleSub.isPending}
                                    >
                                        <IconBellRinging size={18} className="mr-2 opacity-70" />
                                        Subscribed
                                    </Button>
                                </div>
                            ) : (
                                <Button 
                                    className="rounded-full font-bold px-6 bg-foreground text-background hover:bg-foreground/90"
                                    onClick={() => toggleSub.mutate({ channelId: channel.id })}
                                    disabled={toggleSub.isPending}
                                >
                                    Subscribe
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="border-b border-border mt-2 px-4 sm:px-8">
                    <nav className="flex items-center gap-8 overflow-x-auto scrollbar-hide">
                        {TABS.map((tab) => {
                            const isActive = pathname === tab.href;
                            return (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    className={cn(
                                        "pb-3.5 pt-2 text-[15px] font-semibold tracking-tight whitespace-nowrap border-b-2 transition-colors",
                                        isActive
                                            ? "border-foreground text-foreground"
                                            : "border-transparent text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Nested Page Content */}
                <div className="px-4 sm:px-8 py-8 w-full">
                    {children}
                </div>
            </div>
        </div>
    );
}
