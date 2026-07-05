"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { getMediaUrl } from "@/lib/utils";

interface VideoHoverPreviewProps {
    thumbnailUrl?: string | null;
    previewSprite?: string | null;
    duration?: number | null;
    className?: string;
    priority?: boolean;
    children?: React.ReactNode;
}

/**
 * Video Hover Preview Component
 * Displays a static thumbnail by default.
 * On hover, cycles through sprite frames using CSS background-position (10×10 grid).
 */
export function VideoHoverPreview({
    thumbnailUrl,
    previewSprite,
    duration = 0,
    className = "",
    priority = false,
    children,
}: VideoHoverPreviewProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Cycle through time when hovered
    useEffect(() => {
        if (isHovered && previewSprite && duration && duration > 0) {
            const frameRate = 100; // ms per frame
            const step = duration / 50; // Map duration to 50 steps

            intervalRef.current = setInterval(() => {
                setCurrentTime((prev) => {
                    const next = prev + step;
                    return next >= duration ? 0 : next;
                });
            }, frameRate);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isHovered, previewSprite, duration]);

    // Calculate Grid Position (10x10)
    const calculatePosition = () => {
        if (!duration || duration <= 0) return { x: 0, y: 0 };

        const interval = Math.max(1, Math.ceil(duration / 100));
        const totalFrames = Math.ceil(duration / interval);

        const frameIndex = Math.floor(currentTime / interval);
        const clampedIndex = Math.min(totalFrames - 1, Math.max(0, frameIndex));

        const col = clampedIndex % 10;
        const row = Math.floor(clampedIndex / 10);

        const x = col * (100 / 9);
        const y = row * (100 / 9);

        return { x, y };
    };

    const { x, y } = isHovered ? calculatePosition() : { x: 0, y: 0 };
    const spriteUrl = previewSprite ? getMediaUrl(previewSprite) : null;

    return (
        <div
            className={`relative w-full h-full overflow-hidden ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { setIsHovered(false); setCurrentTime(0); }}
        >
            {/* Default Thumbnail */}
            {thumbnailUrl && (
                <Image
                    src={getMediaUrl(thumbnailUrl)}
                    alt="Video Preview"
                    fill
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovered && spriteUrl ? "opacity-0" : "opacity-100"}`}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    priority={priority}
                    unoptimized
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                    }}
                />
            )}

            {/* Sprite Preview (CSS background-position cycling) */}
            {spriteUrl && (
                <div
                    className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${isHovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                    style={{
                        backgroundImage: `url(${spriteUrl})`,
                        backgroundSize: "1000% 1000%", // 10x10 grid
                        backgroundPosition: `${x}% ${y}%`,
                        backgroundRepeat: "no-repeat",
                    }}
                />
            )}

            {/* Passthrough children (duration badge, etc.) */}
            {children}
        </div>
    );
}
