"use client";

import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { trpc } from "@/lib/trpc-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMediaUrl } from "@/lib/utils";

export function SubscribedChannelBar() {
    const { data, isLoading } = trpc.channel.getSubscribedChannels.useQuery(
        { limit: 15 },
        { staleTime: 1000 * 60 * 5 } // 5 minutes
    );

    const [emblaRef] = useEmblaCarousel({
        dragFree: true,
        containScroll: "trimSnaps",
    });

    if (isLoading) {
        return (
            <div className="flex gap-4 px-4 sm:px-8 py-4 overflow-hidden border-b border-border/10">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 shrink-0 animate-pulse">
                        <div className="w-14 h-14 rounded-full bg-muted" />
                        <div className="w-12 h-3 rounded-full bg-muted" />
                    </div>
                ))}
            </div>
        );
    }

    if (!data || data.items.length === 0) return null;

    return (
        <div className="w-full border-b border-border/20 py-4 bg-background/50">
            <div className="overflow-hidden px-4 sm:px-8" ref={emblaRef}>
                <div className="flex gap-5">
                    {data.items.map((channel) => (
                        <Link
                            key={channel.id}
                            href={`/@${channel.handle}`}
                            className="flex flex-col items-center gap-2 shrink-0 group w-16"
                        >
                            <div className="relative">
                                <Avatar className="w-14 h-14 border-2 border-transparent group-hover:border-primary transition-colors cursor-pointer ring-2 ring-transparent group-active:scale-95 duration-200">
                                    <AvatarImage
                                        src={getMediaUrl(channel.image) || ""}
                                        alt={channel.name}
                                        className="object-cover"
                                    />
                                    <AvatarFallback className="bg-primary/10 text-primary uppercase font-bold text-lg">
                                        {channel.name?.slice(0, 2)}
                                    </AvatarFallback>
                                </Avatar>
                                {channel.status === "ACTIVE" && (
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background ring-1 ring-black/5" />
                                )}
                            </div>
                            <span className="text-xs font-semibold tracking-tight truncate w-full text-center text-muted-foreground group-hover:text-foreground transition-colors">
                                {channel.name}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
