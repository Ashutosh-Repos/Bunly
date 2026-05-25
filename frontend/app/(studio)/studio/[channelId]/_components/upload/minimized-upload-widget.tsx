"use client";

import { useUpload } from "@/components/providers/upload-provider";
import { IconUpload, IconVideo, IconX, IconCheck, IconAlertCircle } from "@tabler/icons-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc-client";
import { useState } from "react";

export function MinimizedUploadWidget() {
    const { status, progress, engine, isModalOpen, openModal, clearUpload, videoId } = useUpload();
    const [processingProgress, setProcessingProgress] = useState(0);

    // M5 fix: Subscribe to WebSocket for real-time processing progress in the minimized widget
    trpc.video.onProcessingStatus.useSubscription(
        { videoId: videoId! },
        {
            enabled: status === "PROCESSING" && !!videoId,
            onData(data) {
                setProcessingProgress(data.progress || 0);
            },
        }
    );

    // Do not show widget if modal is open, or if nothing is happening
    if (isModalOpen || status === "UNINITIALIZED") return null;

    // Use the right progress value based on lifecycle phase
    const displayProgress = status === "PROCESSING" ? processingProgress : progress;

    return (
        <div 
            className="fixed bottom-6 right-6 w-72 bg-background/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl z-50 overflow-hidden cursor-pointer hover:border-foreground/20 transition-all duration-300 animate-in slide-in-from-bottom"
            onClick={() => openModal()}
        >
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-border/40">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    {status === "UPLOADING" || status === "PAUSED" ? (
                        <><IconUpload size={12} className="text-primary animate-pulse" /> Uploading</>
                    ) : status === "PROCESSING" ? (
                        <><IconVideo size={12} className="text-blue-500 animate-spin-slow" /> Processing</>
                    ) : status === "FAILED" ? (
                        <><IconAlertCircle size={12} className="text-destructive" /> <span className="text-destructive">Failed</span></>
                    ) : (
                        <><IconCheck size={12} className="text-emerald-500" /> <span className="text-emerald-500">Ready</span></>
                    )}
                </span>
                
                {/* Close Button to dismiss the widget if finished or cancelled */}
                {(status === "READY" || status === "FAILED") && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5 rounded-full text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                            e.stopPropagation();
                            clearUpload();
                        }}
                    >
                        <IconX size={12} />
                    </Button>
                )}
            </div>

            <div className="px-4 py-3 flex flex-col gap-2">
                <p className="text-xs font-medium truncate text-foreground">
                    {engine?.file.name || "Untitled Video"}
                </p>
                {status !== "READY" && status !== "FAILED" && (
                    <div className="flex items-center gap-2">
                        {/* M5 fix: use real processingProgress during PROCESSING, upload progress otherwise */}
                        <Progress value={displayProgress === 0 && status === "PROCESSING" ? undefined : displayProgress} className="flex-1 h-1" />
                        <span className="text-[10px] text-muted-foreground font-medium w-8 text-right">
                            {displayProgress === 0 && status === "PROCESSING" ? "" : `${displayProgress}%`}
                        </span>
                    </div>
                )}
                {status === "READY" && (
                    <p className="text-[10px] text-emerald-500 font-medium">Processing complete. Click to view.</p>
                )}
                {status === "FAILED" && (
                    <p className="text-[10px] text-destructive">Click to see what went wrong.</p>
                )}
            </div>
        </div>
    );
}
