"use client";

import { getMediaUrl, formatDuration } from "@/lib/utils";
import Link from "next/link";
import { IconPlayerPlayFilled, IconVideo, IconPlaylist } from "@tabler/icons-react";
import Image from "next/image";
import type { RouterOutputs } from "@/lib/trpc-client";

type Playlist = RouterOutputs["playlist"]["getPlaylistFlow"];

export function PlaylistClient({ playlist }: { playlist: Playlist }) {
    const videos = playlist.videos;
    const firstVideo = videos[0];

    return (
        <div className="max-w-[1200px] mx-auto p-4 md:p-8 flex flex-col md:flex-row gap-8 min-h-[calc(100vh-80px)]">
            
            {/* Sidebar Details */}
            <div className="w-full md:w-[360px] lg:w-[400px] shrink-0">
                <div className="bg-linear-to-b from-muted to-background p-6 rounded-2xl sticky top-24 border border-border/40 shadow-sm flex flex-col">
                    
                    {/* Cover Image */}
                    <div className="w-full aspect-video rounded-xl bg-black/10 overflow-hidden relative shadow-md mb-6 ring-1 ring-border/10">
                        {firstVideo?.thumbnailUrl ? (
                            <Image
                                src={getMediaUrl(firstVideo.thumbnailUrl)}
                                alt="Playlist Cover"
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                                <IconVideo size={40} className="text-muted-foreground/30" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/20" />
                    </div>

                    <h1 className="text-2xl font-bold line-clamp-2 leading-tight mb-4">
                        {playlist.title}
                    </h1>

                    <div className="flex flex-col gap-2 text-sm text-foreground/80 mb-6 font-medium">
                        <span className="font-semibold text-foreground">{playlist.authorName || "User"}</span>
                        <span>{videos.length} videos</span>
                    </div>

                    <div className="flex gap-3 mt-auto">
                        <Link href={firstVideo ? `/watch/${firstVideo.id}?list=${playlist.id}` : "#"} className="flex-1">
                            <button 
                                disabled={!firstVideo}
                                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 rounded-full hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-[0.98]"
                            >
                                <IconPlayerPlayFilled size={20} className="fill-current" />
                                Play All
                            </button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Video List */}
            <div className="flex-1 flex flex-col gap-3 pb-24">
                {videos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/10 h-64">
                        <IconPlaylist className="w-12 h-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold text-foreground/80">This playlist is empty</h3>
                        <p className="text-sm text-muted-foreground mt-1">Videos you add will appear here.</p>
                    </div>
                ) : (
                    videos.map((video, index) => (
                        <Link
                            key={video.id}
                            href={`/watch/${video.id}?list=${playlist.id}&index=${index}`}
                            className="flex gap-4 p-3 rounded-xl hover:bg-muted/60 transition-colors group relative cursor-pointer"
                        >
                            <div className="flex items-center justify-center w-6 text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                                {index + 1}
                            </div>
                            
                            <div className="w-[160px] aspect-video bg-muted rounded-lg shrink-0 relative overflow-hidden ring-1 ring-border/10 group-hover:ring-primary/50 transition-all">
                                {video.thumbnailUrl ? (
                                    <Image
                                        src={getMediaUrl(video.thumbnailUrl)}
                                        alt={video.title}
                                        fill
                                        className="object-cover"
                                        sizes="160px"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <IconVideo size={24} className="text-muted-foreground/30" />
                                    </div>
                                )}
                                {(video.duration ?? 0) > 0 && (
                                    <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded font-medium">
                                        {formatDuration(video.duration)}
                                    </span>
                                )}
                            </div>
                            
                            <div className="flex flex-col py-1 justify-between">
                                <div>
                                    <h3 className="font-semibold text-[15px] leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                                        {video.title}
                                    </h3>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                        <span>{video.channelName}</span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}

