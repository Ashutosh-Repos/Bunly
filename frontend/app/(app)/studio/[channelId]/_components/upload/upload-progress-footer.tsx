"use client";

import { useUpload } from "@/components/providers/upload-provider";
import { IconCheck, IconFileAlert, IconUpload, IconVideo } from "@tabler/icons-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc-client";
import { useState } from "react";

export function UploadProgressFooter() {
    const { status, progress, engine, resumeUpload, pauseUpload, clearUpload, videoId, markReady, markFailed } = useUpload();
    const [processingProgress, setProcessingProgress] = useState(0);
    const [processingError, setProcessingError] = useState<string | null>(null);

    trpc.video.onProcessingStatus.useSubscription(
        { videoId: videoId! },
        {
            enabled: status === "PROCESSING" && !!videoId,
            onData(data) {
                setProcessingProgress(data.progress || 0);
                if (data.status === "READY" && engine) {
                    markReady();
                } else if (data.status === "FAILED") {
                    // C3 fix: propagate server-side FAILED status to upload context
                    markFailed();
                    setProcessingError((data as { error?: string }).error || "Processing failed on the server.");
                }
            }
        }
    );

    // Prevent rendering if not active
    if (status === "UNINITIALIZED") return null;

    const renderLeftContent = () => {
        switch (status) {
            case "UPLOADING":
                return (
                    <div className="flex items-center gap-4 flex-1">
                        <div className="bg-primary/10 p-2 rounded-full animate-pulse">
                            <IconUpload size={20} className="text-primary" />
                        </div>
                        <div className="flex flex-col flex-1 max-w-md">
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium">Uploading {engine?.file.name}</span>
                                <span className="text-muted-foreground">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2 w-full" />
                            <span className="text-xs text-muted-foreground mt-1">
                                Please keep this tab open until the upload completes. 
                            </span>
                        </div>
                        <div className="flex gap-2 ml-4">
                            <Button variant="ghost" size="icon" onClick={() => pauseUpload()} title="Pause Upload">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                            </Button>
                        </div>
                    </div>
                );
            case "PAUSED":
                return (
                    <div className="flex items-center gap-4 flex-1">
                        <div className="bg-yellow-500/10 p-2 rounded-full">
                            <IconUpload size={20} className="text-yellow-500" />
                        </div>
                        <div className="flex flex-col flex-1 max-w-md">
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-yellow-500">Upload Paused</span>
                                <span className="text-muted-foreground">{progress}%</span>
                            </div>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <Progress value={progress} className="h-2 w-full bg-yellow-500/20" {...({ indicatorClassName: "bg-yellow-500" } as any)} />
                        </div>
                        <div className="flex gap-2 ml-4">
                            <Button variant="outline" size="sm" onClick={() => resumeUpload()}>Resume</Button>
                        </div>
                    </div>
                );
            case "PROCESSING":
                return (
                    <div className="flex items-center gap-4 flex-1">
                        <div className="bg-blue-500/10 p-2 rounded-full animate-spin-slow">
                            <IconVideo size={20} className="text-blue-500" />
                        </div>
                        <div className="flex flex-col flex-1 max-w-md">
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-blue-500">Processing video...</span>
                                {/* C2 fix: use processingProgress from WebSocket, not upload progress */}
                                <span className="text-muted-foreground">{processingProgress > 0 ? `${processingProgress}%` : ""}</span>
                            </div>
                            {/* C2 fix: processingProgress drives this bar, undefined = indeterminate pulse */}
                            <Progress value={processingProgress === 0 ? undefined : processingProgress} className="h-2 w-full" />
                            <span className="text-xs text-muted-foreground mt-1">
                                We are generating SD/HD streams. You can save your draft and close this dialog.
                            </span>
                        </div>
                    </div>
                );
            case "READY":
                return (
                    <div className="flex items-center gap-4 flex-1">
                        <div className="bg-green-500/10 p-2 rounded-full">
                            <IconCheck size={20} className="text-green-500" />
                        </div>
                        <div className="flex flex-col flex-1 max-w-md">
                            <span className="text-sm font-medium text-green-500">Checks complete. No issues found.</span>
                            <span className="text-xs text-muted-foreground">Your video is ready to be published.</span>
                        </div>
                    </div>
                );
            case "FAILED":
                return (
                    <div className="flex items-center gap-4 flex-1">
                        <div className="bg-destructive/10 p-2 rounded-full">
                            <IconFileAlert size={20} className="text-destructive" />
                        </div>
                        <div className="flex flex-col flex-1 max-w-md">
                            <span className="text-sm font-medium text-destructive">
                                {processingError ? "Processing Failed" : "Upload Failed"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {processingError || "The network connection was interrupted or the session expired."}
                            </span>
                        </div>
                        {/* Only show Retry for client-side upload failures, not server-side processing failures */}
                        {!processingError && (
                            <div className="flex gap-2 ml-4">
                                <Button variant="outline" size="sm" onClick={() => resumeUpload()}>Retry</Button>
                            </div>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className="h-24 px-6 flex items-center justify-between w-full">
            {/* Left side: Upload / Processing status */}
            <div className="flex-1">
                {renderLeftContent()}
            </div>

            {/* Right side: Global Actions (Close / Cancel) */}
            <div className="flex items-center gap-2 pl-4 border-l ml-4 h-12">
                {status === "UPLOADING" || status === "PAUSED" ? (
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => clearUpload()}>
                        Cancel Upload
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
