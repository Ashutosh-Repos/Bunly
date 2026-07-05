"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
import { IconCheck, IconExclamationCircle, IconLoader2, IconVideo } from "@tabler/icons-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";

export interface ProcessingStatusIndicatorProps {
    videoId: string;
    initialStatus?: "PENDING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
    initialProgress?: number;
    showText?: boolean;
    className?: string;
}

export function ProcessingStatusIndicator({ 
    videoId, 
    initialStatus = "PENDING", 
    initialProgress = 0,
    showText = true,
    className = ""
}: ProcessingStatusIndicatorProps) {
    const [status, setStatus] = useState(initialStatus);
    const [progress, setProgress] = useState(initialProgress);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const utils = trpc.useUtils();

    // The HTTP Catch-up query
    const fetchCurrentStatus = useCallback(async () => {
        try {
            const data = await utils.client.video.getStatus.query({ videoId });
            setStatus(data.status as "PENDING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED");
            setProgress(data.progress || 0);
            if (data.error) setErrorMsg(data.error);
        } catch (err) {
            console.error("[ProcessingStatus] Fast-forward catchup failed", err);
        }
    }, [videoId, utils]);

    // tRPC WebSocket Subscription
    trpc.video.onProcessingStatus.useSubscription(
        { videoId },
        {
            enabled: status === "PROCESSING" || status === "UPLOADING", // Only sub if active
            onData(data) {
                setStatus(data.status as "PENDING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED");
                setProgress(data.progress || 0);
                if (data.error) setErrorMsg(data.error);
            },
            onStarted() {
                // Fired whenever the WebSocket connection is established or re-established.
                // This solves the 'Background Tab' Reconnect issue!
                fetchCurrentStatus();
            },
            onError(err) {
                console.error("[ProcessingStatus] Subscription error", err);
                if (status === "PROCESSING") {
                    // Fall back to polling if the socket dies unexpectedly
                    setTimeout(fetchCurrentStatus, 5000);
                }
            }
        }
    );

    // Initial load sync just to be safe
    useEffect(() => {
        if (initialStatus === "PROCESSING") {
            fetchCurrentStatus();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    const renderIcon = () => {
        switch (status) {
            case "PENDING":
            case "UPLOADING":
                return <IconUpload size={18} className="text-muted-foreground animate-pulse" />;
            case "PROCESSING":
                // If we're at 0%, maybe it's just starting
                if (progress === 0) return <IconLoader2 size={18} className="text-blue-500 animate-spin" />;
                return (
                    <div className="relative flex items-center justify-center w-5 h-5">
                        <svg className="w-5 h-5 -rotate-90 transform" viewBox="0 0 36 36">
                            <path
                                className="text-muted/30"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="text-blue-500 transition-all duration-500 ease-out"
                                strokeDasharray={`${progress}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                        </svg>
                    </div>
                );
            case "READY":
                return <IconCheck size={18} className="text-green-500" />;
            case "FAILED":
                return <IconExclamationCircle size={18} className="text-destructive" />;
            default:
                return <IconVideo size={18} className="text-muted-foreground" />;
        }
    };

    const StatusDisplayInner = (
        <div className={`flex items-center gap-2 ${className}`}>
            {renderIcon()}
            {showText && (
                <span className="text-sm font-medium">
                    {status === "PROCESSING" && `${progress}%`}
                    {status === "READY" && "HD"}
                    {status === "FAILED" && "Error"}
                    {status === "UPLOADING" && "Uploading"}
                    {status === "PENDING" && "Draft"}
                </span>
            )}
        </div>
    );

    if (status === "FAILED" || (status === "PROCESSING" && showText)) {
        return (
            <Popover>
                <PopoverTrigger className="focus:outline-none hover:opacity-80 transition-opacity">
                    {StatusDisplayInner}
                </PopoverTrigger>
                <PopoverContent side="top" className="w-64 p-3 text-sm flex flex-col gap-2">
                    {status === "FAILED" ? (
                        <>
                            <p className="font-semibold text-destructive">Processing Failed</p>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                                {errorMsg || "We encountered an error while processing your video. Please delete and upload it again."}
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="font-semibold">Processing Video</p>
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>Generating HD streams</span>
                                <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-1.5" />
                        </>
                    )}
                </PopoverContent>
            </Popover>
        );
    }

    return StatusDisplayInner;
}

// Minimal stub for IconUpload since I didn't import it at the top to avoid clutter
function IconUpload({ size = 24, ...props }: React.SVGProps<SVGSVGElement> & { size?: number | string }) {
    return <svg {...props} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>;
}
