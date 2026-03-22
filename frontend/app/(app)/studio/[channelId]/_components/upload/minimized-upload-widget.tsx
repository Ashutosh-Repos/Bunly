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
            className="fixed bottom-6 right-6 w-80 bg-background border rounded-lg shadow-lg z-50 overflow-hidden cursor-pointer hover:border-primary/50 transition-colors animate-in slide-in-from-bottom flex flex-col"
            onClick={() => openModal()}
        >
            <div className="bg-muted px-4 py-2 flex items-center justify-between border-b">
                <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                    {status === "UPLOADING" || status === "PAUSED" ? (
                        <><IconUpload size={14} className="text-primary animate-pulse" /> Uploading Video</>
                    ) : status === "PROCESSING" ? (
                        <><IconVideo size={14} className="text-blue-500 animate-spin-slow" /> Processing Video</>
                    ) : status === "FAILED" ? (
                        <><IconAlertCircle size={14} className="text-destructive" /> <span className="text-destructive">Failed</span></>
                    ) : (
                        <><IconCheck size={14} className="text-green-500" /> <span className="text-green-500">Ready!</span></>
                    )}
                </span>
                
                {/* Close Button to dismiss the widget if finished or cancelled */}
                {(status === "READY" || status === "FAILED") && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 rounded-full hover:bg-background"
                        onClick={(e) => {
                            e.stopPropagation();
                            clearUpload();
                        }}
                    >
                        <IconX size={14} />
                    </Button>
                )}
            </div>

            <div className="p-4 flex flex-col gap-2">
                <p className="text-sm font-medium truncate">
                    {engine?.file.name || "Untitled Video"}
                </p>
                {status !== "READY" && status !== "FAILED" && (
                    <div className="flex items-center gap-3">
                        {/* M5 fix: use real processingProgress during PROCESSING, upload progress otherwise */}
                        <Progress value={displayProgress === 0 && status === "PROCESSING" ? undefined : displayProgress} className="flex-1 h-1.5" />
                        <span className="text-xs text-muted-foreground font-medium w-8 text-right">
                            {displayProgress === 0 && status === "PROCESSING" ? "" : `${displayProgress}%`}
                        </span>
                    </div>
                )}
                {status === "READY" && (
                    <p className="text-xs text-green-500 font-medium">Processing complete. Click to view.</p>
                )}
                {status === "FAILED" && (
                    <p className="text-xs text-destructive">Click to see what went wrong.</p>
                )}
            </div>
        </div>
    );
}
