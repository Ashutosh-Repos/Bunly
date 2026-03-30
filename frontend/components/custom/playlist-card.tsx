import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { IconPlaylist } from "@tabler/icons-react";
import { getMediaUrl } from "@/lib/utils";

import { AuthorName, type AuthorDTO } from "./author-display";

interface PlaylistCardProps {
    id: string;
    title: string;
    videoCount: number;
    firstVideoThumbnail?: string | null;
    author?: AuthorDTO | null;
}

export function PlaylistCard({
    id,
    title,
    videoCount,
    firstVideoThumbnail,
    author,
}: PlaylistCardProps) {
    return (
        <Link href={`/playlist/${id}`} className="group cursor-pointer block h-full">
            <Card className="p-0 overflow-hidden bg-muted/20 border-border/40 hover:border-primary/50 transition-colors shadow-none h-full flex flex-col">
                <div className="aspect-video relative bg-muted flex items-center justify-center isolate border-b border-border/30">
                    <div className="absolute inset-x-0 bottom-0 h-[30%] bg-linear-to-t from-black/80 to-transparent z-10 flex flex-col justify-end p-2 px-3 tracking-tight transition-colors group-hover:from-primary/90">
                        <span className="text-white font-semibold flex items-center justify-end gap-1.5 text-xs drop-shadow-sm">
                            <IconPlaylist size={14} />
                            {videoCount} {videoCount === 1 ? "video" : "videos"}
                        </span>
                    </div>
                    {firstVideoThumbnail ? (
                        <Image 
                            src={getMediaUrl(firstVideoThumbnail)}
                            alt={title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        />
                    ) : (
                        <IconPlaylist className="w-8 h-8 md:w-10 md:h-10 text-muted-foreground/30 group-hover:scale-110 transition-transform duration-500" />
                    )}
                </div>
                <div className="p-3 flex-1 flex flex-col">
                    <h3 className="font-semibold text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                        {title}
                    </h3>
                    {author && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground truncate">
                            <span>By</span>
                            <AuthorName author={author} className="inline-flex hover:no-underline" />
                        </div>
                    )}
                </div>
            </Card>
        </Link>
    );
}
