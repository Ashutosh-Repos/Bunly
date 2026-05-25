"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type Hls from "hls.js";
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
import { BunlyImage } from "@/components/custom/bunly-image";

interface VideoPlayerProps {
    videoId: string;
    hlsPlaylistUrl?: string | null;
    thumbnailUrl?: string | null;
    autoPlay?: boolean;
    startAt?: number;
    previewSpriteVtt?: string | null;
    chapters?: { title: string; startTime: number }[];
    onReady?: () => void;
    onError?: (error: unknown) => void;
    onTimeUpdate?: (seconds: number) => void;
    onEnded?: () => void;
}

export function VideoPlayer({
    videoId,
    hlsPlaylistUrl,
    thumbnailUrl,
    autoPlay = false,
    startAt,
    previewSpriteVtt,
    chapters,
    onReady,
    onError,
    onTimeUpdate,
    onEnded,
}: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const settingsRef = useRef<HTMLDivElement>(null);
    const vttCuesRef = useRef<VTTCue[]>([]);
    const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Stable refs for callback props — prevents HLS effect from re-running on every parent render
    const onReadyRef = useRef(onReady);
    const onErrorRef = useRef(onError);
    const onTimeUpdateRef = useRef(onTimeUpdate);
    const onEndedRef = useRef(onEnded);
    useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);
    useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
    useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

    // FIX: Initialize isPlaying=false — let the play/pause DOM events set it correctly
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [duration, setDuration] = useState(0);
    // FIX: Start muted when autoPlay is true — browser policy allows muted autoplay
    const [isMuted, setIsMuted] = useState(autoPlay);
    const [volume, setVolume] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [levels, setLevels] = useState<{ height: number; index: number }[]>([]);
    const [currentLevel, setCurrentLevel] = useState(-1); // -1 = Auto
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const [hoverX, setHoverX] = useState(0);
    const [hoverThumb, setHoverThumb] = useState<string | null>(null);
    const [hoverChapter, setHoverChapter] = useState<string | null>(null);

    // FIX: Filter both AbortError (React hot-reload) AND NotAllowedError (autoplay policy)
    const safePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch((error) => {
                // Safe to ignore: AbortError (hot-reload), NotAllowedError (autoplay policy),
                // NotSupportedError (source not ready yet during HLS init)
                if (error.name !== "AbortError" && error.name !== "NotAllowedError" && error.name !== "NotSupportedError") {
                    console.error("Playback error:", error);
                }
            });
        }
    }, []);

    // Compute segmented chapters to divide the progress bar
    const computedChapters = React.useMemo(() => {
        if (!chapters || chapters.length === 0 || duration === 0) return null;
        
        // Filter out chapters that start at or beyond the video duration
        const validChapters = chapters.filter(c => c.startTime < duration);
        if (validChapters.length === 0) return null;

        const sorted = [...validChapters].sort((a, b) => a.startTime - b.startTime);
        if (sorted[0].startTime > 0) {
            sorted.unshift({ title: "Intro", startTime: 0 });
        }

        return sorted.map((chapter, i) => {
            // Clamp the end time to the video duration
            const nextChapterTime = Math.min(sorted[i + 1]?.startTime ?? duration, duration);
            const segmentDuration = Math.max(0, nextChapterTime - chapter.startTime);
            const widthPercent = (segmentDuration / duration) * 100;
            
            return {
                ...chapter,
                endTime: nextChapterTime,
                widthPercent,
                segmentDuration
            };
        });
    }, [chapters, duration]);

    // FIX: Resolve sprite VTT thumbnail URLs through media proxy
    useEffect(() => {
        if (!previewSpriteVtt) return;
        const vttUrl = getMediaUrl(previewSpriteVtt);
        // Compute the base directory of the VTT file for resolving relative sprite paths
        const vttBase = previewSpriteVtt.substring(0, previewSpriteVtt.lastIndexOf("/") + 1);

        fetch(vttUrl)
            .then((r) => r.text())
            .then((text) => {
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
                    const rawUrl = lines[lines.length - 1]?.trim();
                    if (!rawUrl) return;

                    // Resolve the sprite URL: if it's relative (no protocol), resolve against VTT base path
                    const resolvedUrl = rawUrl.startsWith("http") ? rawUrl : getMediaUrl(vttBase + rawUrl);
                    const cue = new VTTCue(parseVttTime(startStr), parseVttTime(endStr), resolvedUrl);
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

    // FIX: HLS setup — deps are only [videoId, hlsPlaylistUrl]. Callback props use stable refs.
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const src = hlsPlaylistUrl ? getMediaUrl(hlsPlaylistUrl) : getMediaUrl(`processed/${videoId}/master.m3u8`);

        // FIX: Apply muted state before attempting autoplay (browser policy compliance)
        if (autoPlay) video.muted = true;

        const loadNative = () => {
            // Safari native HLS fallback
            video.src = src;
            const onLoadedMeta = () => {
                onReadyRef.current?.();
                if (startAt && startAt > 0) {
                    video.currentTime = startAt;
                }
                if (autoPlay) safePlay();
            };
            if (video.readyState >= 1) {
                onLoadedMeta();
            } else {
                video.addEventListener("loadedmetadata", onLoadedMeta, { once: true });
            }
        };

        let isMounted = true;
        const initHls = async () => {
            try {
                const HlsLib = (await import("hls.js")).default;
                if (!isMounted) return;
                
                if (HlsLib.isSupported()) {
                    const hls = new HlsLib({
                        maxBufferLength: 30,
                        maxMaxBufferLength: 60,
                    });
                    if (!isMounted) {
                        hls.destroy();
                        return;
                    }
                    hlsRef.current = hls;
                    hls.loadSource(src);
                    hls.attachMedia(video);

                    hls.on(HlsLib.Events.MANIFEST_PARSED, (_, data) => {
                        if (!isMounted) return;
                        onReadyRef.current?.();
                        const qualityLevels = data.levels.map((lvl, idx) => ({
                            height: lvl.height,
                            index: idx,
                        }));
                        setLevels(qualityLevels);

                        // FIX: Seek to startAt position before playing
                        if (startAt && startAt > 0) {
                            video.currentTime = startAt;
                        }
                        if (autoPlay) safePlay();
                    });

                    hls.on(HlsLib.Events.LEVEL_SWITCHED, (_, data) => {
                        if (!isMounted) return;
                        setCurrentLevel(data.level);
                    });

                    hls.on(HlsLib.Events.ERROR, (_, data) => {
                        if (!isMounted) return;
                        if (data.fatal) {
                            switch (data.type) {
                                case HlsLib.ErrorTypes.NETWORK_ERROR:
                                    hls.startLoad();
                                    break;
                                case HlsLib.ErrorTypes.MEDIA_ERROR:
                                    hls.recoverMediaError();
                                    break;
                                default:
                                    hls.destroy();
                                    onErrorRef.current?.(data);
                            }
                        }
                    });
                } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                    loadNative();
                }
            } catch (err) {
                console.error("Failed to load HLS chunk", err);
                if (video.canPlayType("application/vnd.apple.mpegurl") && isMounted) {
                    loadNative();
                }
            }
        };

        // Prefer native HLS on Apple devices to save bandwidth and bundle size
        if (video.canPlayType("application/vnd.apple.mpegurl") && /Mac OS X|iPhone|iPad|iPod/i.test(navigator.userAgent || "")) {
            loadNative();
        } else {
            initHls();
        }

        return () => {
            isMounted = false;
            hlsRef.current?.destroy();
            hlsRef.current = null;
        };
    // Only reconstruct HLS when the video source actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId, hlsPlaylistUrl]);

    // FIX: Time/state sync — uses onTimeUpdateRef for stable reference, no unnecessary re-mounts
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const updateTime = () => {
            setProgress(video.currentTime);
            onTimeUpdateRef.current?.(video.currentTime);

            // FIX: Track buffered range for the buffer progress bar
            if (video.buffered.length > 0) {
                setBuffered(video.buffered.end(video.buffered.length - 1));
            }
        };
        const updateDuration = () => setDuration(video.duration);
        const updatePlayState = () => setIsPlaying(!video.paused);
        const handleEnded = () => onEndedRef.current?.();

        video.addEventListener("timeupdate", updateTime);
        video.addEventListener("durationchange", updateDuration);
        video.addEventListener("play", updatePlayState);
        video.addEventListener("pause", updatePlayState);
        video.addEventListener("ended", handleEnded);

        return () => {
            video.removeEventListener("timeupdate", updateTime);
            video.removeEventListener("durationchange", updateDuration);
            video.removeEventListener("play", updatePlayState);
            video.removeEventListener("pause", updatePlayState);
            video.removeEventListener("ended", handleEnded);
        };
    }, []); // Stable — no callback props in deps

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

    // Keyboard shortcuts
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
                    if (video.paused) { safePlay(); } else { video.pause(); }
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
    }, [toggleFullscreen, toggleMute, safePlay]);

    // Auto-hide controls after 3s of inactivity
    const resetHideTimer = useCallback(() => {
        setControlsVisible(true);
        if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
        hideControlsTimerRef.current = setTimeout(() => {
            if (!videoRef.current?.paused) setControlsVisible(false);
        }, 3000);
    }, []);

    // FIX: Close quality settings on outside click
    useEffect(() => {
        if (!showSettings) return;
        const handler = (e: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
                setShowSettings(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showSettings]);

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) { safePlay(); } else { video.pause(); }
    };

    const handleProgressSeek = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (!videoRef.current || !duration) return;
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
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

        if (computedChapters) {
            const chap = computedChapters.find(c => time >= c.startTime && time <= c.endTime);
            if (chap) setHoverChapter(chap.title);
        }
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

    // Compute buffer percentage for the buffer indicator bar
    const bufferPercent = duration ? Math.min(100, (buffered / duration) * 100) : 0;

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
                    {/* Progress bar — padding creates the touch target, bar is the visual */}
                    <div
                        ref={progressBarRef}
                        className="relative w-full h-1.5 flex gap-[2px] cursor-pointer hover:h-2.5 active:h-2.5 transition-all group/progress"
                        style={{ padding: '10px 0', margin: '-10px 0', boxSizing: 'content-box' }}
                        onClick={(e) => { e.stopPropagation(); handleProgressSeek(e); }}
                        onTouchStart={(e) => { e.stopPropagation(); handleProgressSeek(e); }}
                        onMouseMove={handleProgressHover}
                        onMouseLeave={() => { setHoverTime(null); setHoverThumb(null); setHoverChapter(null); }}
                    >
                        {computedChapters ? (
                            computedChapters.map((chap, i) => {
                                let fillPercent = 0;
                                if (progress >= chap.endTime) {
                                    fillPercent = 100;
                                } else if (progress > chap.startTime) {
                                    fillPercent = ((progress - chap.startTime) / chap.segmentDuration) * 100;
                                }

                                // Compute per-chapter buffer fill
                                let bufferFillPercent = 0;
                                if (buffered >= chap.endTime) {
                                    bufferFillPercent = 100;
                                } else if (buffered > chap.startTime) {
                                    bufferFillPercent = ((buffered - chap.startTime) / chap.segmentDuration) * 100;
                                }

                                return (
                                    <div 
                                        key={i} 
                                        className="relative h-full bg-white/20 rounded-sm overflow-hidden"
                                        style={{ width: `${chap.widthPercent}%` }}
                                    >
                                        {/* Buffer bar */}
                                        <div 
                                            className="absolute top-0 left-0 h-full bg-white/30 transition-all duration-150 pointer-events-none"
                                            style={{ width: `${Math.max(0, Math.min(100, bufferFillPercent))}%` }}
                                        />
                                        {/* Played bar */}
                                        <div 
                                            className="absolute top-0 left-0 h-full bg-red-600 transition-all duration-75 pointer-events-none"
                                            style={{ width: `${Math.max(0, Math.min(100, fillPercent))}%` }}
                                        />
                                    </div>
                                );
                            })
                        ) : (
                            <div className="relative w-full h-full bg-white/20 rounded-full overflow-hidden">
                                {/* Buffer progress bar */}
                                <div
                                    className="absolute top-0 left-0 h-full bg-white/30 transition-all duration-150 pointer-events-none"
                                    style={{ width: `${bufferPercent}%` }}
                                />
                                <div
                                    className="absolute top-0 left-0 h-full bg-red-600 transition-all duration-75 pointer-events-none"
                                    style={{ width: `${duration ? Math.min(100, (progress / duration) * 100) : 0}%` }}
                                />
                            </div>
                        )}
                        
                        {/* Seek preview tooltip */}
                        {hoverTime !== null && (
                            <div
                                className="absolute bottom-full mb-2 flex flex-col items-center gap-1 pointer-events-none"
                                style={{ left: `${hoverX}px`, transform: "translateX(-50%)" }}
                            >
                                {hoverThumb && (
                                    <BunlyImage
                                        src={hoverThumb}
                                        alt="Seek preview"
                                        width={112}
                                        height={64}
                                        className="rounded shadow-lg border border-white/10 object-cover"
                                    />
                                )}
                                {hoverChapter && (
                                    <span className="text-xs bg-black/80 text-white px-2 py-0.5 rounded font-medium whitespace-nowrap shadow-sm">
                                        {hoverChapter}
                                    </span>
                                )}
                                <span className="text-xs bg-black/80 text-white px-1.5 py-0.5 rounded font-mono shadow-sm">
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
                            {/* Quality Selector */}
                            {levels.length > 0 && (
                                <div ref={settingsRef} className="relative">
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

                            {/* Fullscreen button */}
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
