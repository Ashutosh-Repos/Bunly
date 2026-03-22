"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { getMediaUrl, formatDuration } from "@/lib/utils";
import {
    IconPlayerPlayFilled,
    IconPlayerPauseFilled,
    IconVolume,
    IconVolume3,
    IconMaximize,
    IconMinimize,
    IconSettings,
} from "@tabler/icons-react";

interface VideoPlayerProps {
    videoId: string;
    thumbnailUrl?: string | null;
    autoPlay?: boolean;
    previewSpriteVtt?: string | null;
    onReady?: () => void;
    onError?: (error: unknown) => void;
    onTimeUpdate?: (seconds: number) => void;
}

export function VideoPlayer({
    videoId,
    thumbnailUrl,
    autoPlay = false,
    previewSpriteVtt,
    onReady,
    onError,
    onTimeUpdate,
}: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const vttCuesRef = useRef<VTTCue[]>([]);
    const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    // Fullscreen state derived from document — synced in useEffect below
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [levels, setLevels] = useState<{ height: number; index: number }[]>([]);
    const [currentLevel, setCurrentLevel] = useState(-1); // -1 = Auto
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const [hoverX, setHoverX] = useState(0);
    const [hoverThumb, setHoverThumb] = useState<string | null>(null);



    // Load VTT for sprite preview (M9)
    useEffect(() => {
        if (!previewSpriteVtt) return;
        const vttUrl = getMediaUrl(previewSpriteVtt);
        fetch(vttUrl)
            .then((r) => r.text())
            .then((text) => {
                // Parse VTT manually: extract timestamps + sprite URL
                const cueBlocks = text.split(/\n\n+/);
                const cues: VTTCue[] = [];
                cueBlocks.forEach((block) => {
                    const lines = block.trim().split("\n");
                    const timeLine = lines.find((l) => l.includes("-->"));
                    if (!timeLine) return;
                    const [startStr, endStr] = timeLine.split("-->").map((s) => s.trim());
                    const parseVttTime = (t: string) => {
                        const parts = t.replace(",", ".").split(":").map(Number);
                        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
                        return parts[0] * 60 + parts[1];
                    };
                    const url = lines[lines.length - 1]?.trim();
                    if (!url) return;
                    const cue = new VTTCue(parseVttTime(startStr), parseVttTime(endStr), url);
                    cues.push(cue);
                });
                vttCuesRef.current = cues;
            })
            .catch(() => {}); // Silently fail — sprite preview is non-critical
    }, [previewSpriteVtt]);

    // Get the sprite thumbnail for a given time position
    const getSpriteThumbUrl = useCallback((time: number): string | null => {
        const cue = vttCuesRef.current.find((c) => time >= c.startTime && time <= c.endTime);
        return cue ? cue.text : null;
    }, []);

    // HLS setup (M6: capture levels)
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const src = getMediaUrl(`${videoId}/master.m3u8`);

        if (Hls.isSupported()) {
            const hls = new Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
            });
            hlsRef.current = hls;
            hls.loadSource(src);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                onReady?.();
                // M6: Expose quality levels
                const qualityLevels = data.levels.map((lvl, idx) => ({
                    height: lvl.height,
                    index: idx,
                }));
                setLevels(qualityLevels);
                if (autoPlay) video.play().catch(console.error);
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
                setCurrentLevel(data.level);
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            hls.recoverMediaError();
                            break;
                        default:
                            hls.destroy();
                            onError?.(data);
                    }
                }
            });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = src;
            video.addEventListener("loadedmetadata", () => {
                onReady?.();
                if (autoPlay) video.play().catch(console.error);
            });
        }

        return () => hlsRef.current?.destroy();
    }, [videoId, autoPlay, onReady, onError]);

    // Time/state sync
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const updateTime = () => {
            setProgress(video.currentTime);
            onTimeUpdate?.(video.currentTime);
        };
        const updateDuration = () => setDuration(video.duration);
        const updatePlayState = () => setIsPlaying(!video.paused);

        video.addEventListener("timeupdate", updateTime);
        video.addEventListener("durationchange", updateDuration);
        video.addEventListener("play", updatePlayState);
        video.addEventListener("pause", updatePlayState);

        return () => {
            video.removeEventListener("timeupdate", updateTime);
            video.removeEventListener("durationchange", updateDuration);
            video.removeEventListener("play", updatePlayState);
            video.removeEventListener("pause", updatePlayState);
        };
    }, [onTimeUpdate]);

    // M7: Fullscreen toggle — declared BEFORE keyboard shortcut useEffect to avoid TDZ
    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setIsMuted(video.muted);
    }, []);

    const toggleFullscreen = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        if (!document.fullscreenElement) {
            el.requestFullscreen().catch(console.error);
        } else {
            document.exitFullscreen().catch(console.error);
        }
    }, []);

    // Sync isFullscreen state with document.fullscreenchange events
    useEffect(() => {
        const onChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    // M8: Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;
            const video = videoRef.current;
            if (!video) return;

            switch (e.key) {
                case " ":
                case "k":
                    e.preventDefault();
                    if (video.paused) { video.play().catch(console.error); } else { video.pause(); }
                    break;
                case "f":
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case "m":
                    e.preventDefault();
                    toggleMute();
                    break;
                case "ArrowRight":
                    e.preventDefault();
                    video.currentTime = Math.min(video.currentTime + 5, video.duration);
                    break;
                case "ArrowLeft":
                    e.preventDefault();
                    video.currentTime = Math.max(video.currentTime - 5, 0);
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    video.volume = Math.min(video.volume + 0.1, 1);
                    setVolume(video.volume);
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    video.volume = Math.max(video.volume - 0.1, 0);
                    setVolume(video.volume);
                    break;
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [toggleFullscreen, toggleMute]);

    // Auto-hide controls after 3s of inactivity
    const resetHideTimer = useCallback(() => {
        setControlsVisible(true);
        if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
        hideControlsTimerRef.current = setTimeout(() => {
            if (!videoRef.current?.paused) setControlsVisible(false);
        }, 3000);
    }, []);

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) { video.play().catch(console.error); } else { video.pause(); }
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!videoRef.current || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        videoRef.current.currentTime = pos * duration;
    };

    const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = pos * duration;
        setHoverTime(time);
        setHoverX(e.clientX - rect.left);
        setHoverThumb(getSpriteThumbUrl(time));
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const vol = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.volume = vol;
            videoRef.current.muted = vol === 0;
        }
        setVolume(vol);
        setIsMuted(vol === 0);
    };

    // M6: Quality switch
    const setQualityLevel = (level: number) => {
        if (!hlsRef.current) return;
        hlsRef.current.currentLevel = level;
        setCurrentLevel(level);
        setShowSettings(false);
    };

    const currentQualityLabel =
        currentLevel === -1
            ? "Auto"
            : `${levels.find((l) => l.index === currentLevel)?.height ?? "?"}p`;

    return (
        <div
            ref={containerRef}
            className="group/player relative w-full bg-black aspect-video overflow-hidden rounded-xl border border-white/10 shadow-2xl font-sans"
            onMouseMove={resetHideTimer}
            onMouseEnter={resetHideTimer}
        >
            <video
                ref={videoRef}
                className="w-full h-full object-contain cursor-pointer"
                poster={thumbnailUrl ? getMediaUrl(thumbnailUrl) : undefined}
                onClick={togglePlay}
                playsInline
            />

            {/* Controls overlay */}
            <div
                className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 pointer-events-none ${
                    controlsVisible ? "opacity-100" : "opacity-0"
                }`}
            >
                {/* Gradient scrim */}
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                <div className="relative pointer-events-auto px-4 pb-4 flex flex-col gap-2">
                    {/* Progress bar with seek preview (M9) */}
                    <div
                        ref={progressBarRef}
                        className="relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer hover:h-2.5 transition-all"
                        onClick={handleProgressClick}
                        onMouseMove={handleProgressHover}
                        onMouseLeave={() => { setHoverTime(null); setHoverThumb(null); }}
                    >
                        <div
                            className="absolute top-0 left-0 h-full bg-red-600 rounded-full"
                            style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
                        />
                        {/* Seek preview tooltip (M9) */}
                        {hoverTime !== null && (
                            <div
                                className="absolute bottom-4 flex flex-col items-center gap-1 pointer-events-none"
                                style={{ left: `${hoverX}px`, transform: "translateX(-50%)" }}
                            >
                                {hoverThumb && (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={hoverThumb} alt="" className="w-28 h-16 rounded shadow-lg border border-white/10 object-cover" />
                                )}
                                <span className="text-xs bg-black/80 text-white px-1.5 py-0.5 rounded font-mono">
                                    {formatDuration(hoverTime)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Control bar */}
                    <div className="flex items-center justify-between text-white gap-4">
                        {/* Left controls */}
                        <div className="flex items-center gap-3">
                            <button onClick={togglePlay} className="hover:text-red-500 transition-colors">
                                {isPlaying
                                    ? <IconPlayerPauseFilled size={22} />
                                    : <IconPlayerPlayFilled size={22} />}
                            </button>

                            {/* Volume control */}
                            <div className="flex items-center gap-1.5 group/vol">
                                <button onClick={toggleMute} className="hover:text-red-500 transition-colors">
                                    {isMuted || volume === 0
                                        ? <IconVolume3 size={20} />
                                        : <IconVolume size={20} />}
                                </button>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={isMuted ? 0 : volume}
                                    onChange={handleVolumeChange}
                                    className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-red-600 cursor-pointer overflow-hidden"
                                />
                            </div>

                            <div className="text-xs font-medium tracking-wide opacity-80 font-mono whitespace-nowrap">
                                {formatDuration(progress)} <span className="opacity-50 mx-1">/</span> {formatDuration(duration || 0)}
                            </div>
                        </div>

                        {/* Right controls */}
                        <div className="flex items-center gap-3 relative">
                            {/* M6: Quality Selector */}
                            {levels.length > 0 && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowSettings(v => !v)}
                                        className="flex items-center gap-1 text-xs hover:text-red-400 transition-colors"
                                        title="Quality"
                                    >
                                        <IconSettings size={18} />
                                        <span className="opacity-70">{currentQualityLabel}</span>
                                    </button>
                                    {showSettings && (
                                        <div className="absolute bottom-8 right-0 bg-black/90 border border-white/10 rounded-lg overflow-hidden min-w-[100px] shadow-xl z-10">
                                            <div className="px-3 py-1.5 text-[10px] text-white/40 uppercase tracking-widest font-semibold border-b border-white/10">Quality</div>
                                            <button
                                                onClick={() => setQualityLevel(-1)}
                                                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 transition-colors flex items-center justify-between gap-4 ${currentLevel === -1 ? "text-red-400" : "text-white"}`}
                                            >
                                                Auto {currentLevel === -1 && <span className="text-red-400 text-xs">✓</span>}
                                            </button>
                                            {[...levels].reverse().map((lvl) => (
                                                <button
                                                    key={lvl.index}
                                                    onClick={() => setQualityLevel(lvl.index)}
                                                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 transition-colors flex items-center justify-between gap-4 ${currentLevel === lvl.index ? "text-red-400" : "text-white"}`}
                                                >
                                                    {lvl.height}p {currentLevel === lvl.index && <span className="text-red-400 text-xs">✓</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* M7: Fullscreen button */}
                            <button onClick={toggleFullscreen} className="hover:text-red-500 transition-colors" title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}>
                                {isFullscreen ? <IconMinimize size={20} /> : <IconMaximize size={20} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
