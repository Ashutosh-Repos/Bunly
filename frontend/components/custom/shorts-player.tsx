"use client";

import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { getMediaUrl } from "@/lib/utils";
import { IconPlayerPlayFilled, IconVolume, IconVolume3 } from "@tabler/icons-react";

interface ShortsPlayerProps {
    videoId: string;
    hlsPlaylistUrl?: string | null;
    isActive: boolean; // Tells the player if it's currently snapped in the viewport
}

export function ShortsPlayer({ videoId, hlsPlaylistUrl, isActive }: ShortsPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [progress, setProgress] = useState(0);

    // HLS logic — FIX: hlsPlaylistUrl added to deps
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const src = hlsPlaylistUrl ? getMediaUrl(hlsPlaylistUrl) : getMediaUrl(`processed/${videoId}/master.m3u8`);

        if (Hls.isSupported()) {
            const hls = new Hls({
                maxBufferLength: 10,
                maxMaxBufferLength: 20,
            });
            hlsRef.current = hls;
            hls.loadSource(src);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) hls.destroy();
            });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = src;
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [videoId, hlsPlaylistUrl]);

    // Playback control — FIX: Seek BEFORE play to prevent race condition
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isActive) {
            video.currentTime = 0; // Rewind first
            video.play().catch(() => {}); // Then play (safe catch for autoplay policy)
        } else {
            video.pause();
        }
    }, [isActive]);

    return (
        <div 
            className="relative w-full h-full bg-black cursor-pointer group"
            onClick={() => {
                if (videoRef.current) {
                    if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); }
                    else { videoRef.current.play().catch(() => {}); setIsPlaying(true); }
                }
            }}
        >
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                loop
                playsInline
                muted={isMuted}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (v.duration) setProgress((v.currentTime / v.duration) * 100);
                }}
            />
            
            {/* Play overlay when paused */}
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="h-16 w-16 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-md">
                        <IconPlayerPlayFilled className="text-white w-8 h-8 ml-1" />
                    </div>
                </div>
            )}

            {/* Mute toggle */}
            <button 
                className="absolute top-4 right-4 h-10 w-10 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors z-10"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                }}
            >
                {isMuted ? <IconVolume3 size={20} /> : <IconVolume size={20} />}
            </button>

            {/* Bottom Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 z-10">
                <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
        </div>
    );
}
