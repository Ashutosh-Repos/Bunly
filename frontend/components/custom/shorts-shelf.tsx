"use client";

import Link from "next/link";
import { IconFlame } from "@tabler/icons-react";
import { getMediaUrl } from "@/lib/utils";
import type { VideoGridVideo } from "@/components/custom/video-grid";
import useEmblaCarousel from "embla-carousel-react";

interface ShortsShelfProps {
    shorts: VideoGridVideo[];
}

export function ShortsShelf({ shorts }: ShortsShelfProps) {
    const [emblaRef] = useEmblaCarousel({
        loop: false,
        dragFree: true,
        align: "start",
        containScroll: "trimSnaps",
    });

    if (shorts.length === 0) return null;

    return (
        <section className="my-10">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-5 px-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10">
                    <IconFlame size={18} className="text-red-500" />
                </div>
                <h2 className="text-lg font-bold tracking-tight">Shorts</h2>
            </div>

            {/* Carousel */}
            <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex gap-3">
                    {shorts.map((short) => (
                        <Link
                            key={short.id}
                            href={`/watch/${short.id}`}
                            className="flex-[0_0_150px] sm:flex-[0_0_180px] group cursor-pointer"
                        >
                            <div className="relative aspect-9/16 rounded-xl overflow-hidden bg-muted/30 ring-1 ring-border/10 group-hover:ring-primary/30 group-hover:shadow-lg group-hover:shadow-primary/5 transition-all">
                                {short.thumbnailUrl ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={getMediaUrl(short.thumbnailUrl)}
                                        alt={short.title}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <IconFlame size={24} className="text-muted-foreground/30" />
                                    </div>
                                )}

                                {/* Bottom gradient overlay */}
                                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/80 to-transparent" />

                                {/* View count badge */}
                                <span className="absolute bottom-2 left-2 right-2 text-white text-[13px] font-semibold leading-tight line-clamp-2 drop-shadow-sm">
                                    {short.title}
                                </span>
                            </div>

                            {/* Views under thumbnail */}
                            <p className="mt-1.5 text-xs text-muted-foreground font-medium px-0.5 truncate">
                                {short.viewCount.toLocaleString()} views
                            </p>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
