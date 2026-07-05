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
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <IconUpload size={16} className="text-primary animate-pulse" />
                        </div>
                        <div className="flex flex-col flex-1 max-w-sm">
                            <div className="flex justify-between text-xs mb-1.5">
                                <span className="font-medium truncate mr-2">{engine?.file.name}</span>
                                <span className="text-muted-foreground shrink-0">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-1.5 w-full" />
                            <span className="text-[10px] text-muted-foreground mt-1.5">
                                Keep this tab open until the upload completes.
                            </span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground" onClick={() => pauseUpload()} title="Pause Upload">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        </Button>
                    </div>
                );
            case "PAUSED":
                return (
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                            <IconUpload size={16} className="text-amber-500" />
                        </div>
                        <div className="flex flex-col flex-1 max-w-sm">
                            <div className="flex justify-between text-xs mb-1.5">
                                <span className="font-medium text-amber-500">Upload Paused</span>
                                <span className="text-muted-foreground">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-1.5 w-full" />
                        </div>
                        <Button variant="outline" size="sm" className="shrink-0 h-7 text-xs" onClick={() => resumeUpload()}>Resume</Button>
                    </div>
                );
            case "PROCESSING":
                return (
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <IconVideo size={16} className="text-blue-500 animate-spin-slow" />
                        </div>
                        <div className="flex flex-col flex-1 max-w-sm">
                            <div className="flex justify-between text-xs mb-1.5">
                                <span className="font-medium text-blue-500">Processing video…</span>
                                {/* C2 fix: use processingProgress from WebSocket, not upload progress */}
                                <span className="text-muted-foreground">{processingProgress > 0 ? `${processingProgress}%` : ""}</span>
                            </div>
                            {/* C2 fix: processingProgress drives this bar, undefined = indeterminate pulse */}
                            <Progress value={processingProgress === 0 ? undefined : processingProgress} className="h-1.5 w-full" />
                            <span className="text-[10px] text-muted-foreground mt-1.5">
                                Generating SD/HD streams. You can save your draft and close this dialog.
                            </span>
                        </div>
                    </div>
                );
            case "READY":
                return (
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <IconCheck size={16} className="text-emerald-500" />
                        </div>
                        <div className="flex flex-col flex-1">
                            <span className="text-xs font-medium text-emerald-500">Checks complete. No issues found.</span>
                            <span className="text-[10px] text-muted-foreground">Your video is ready to be published.</span>
                        </div>
                    </div>
                );
            case "FAILED":
                return (
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                            <IconFileAlert size={16} className="text-destructive" />
                        </div>
                        <div className="flex flex-col flex-1">
                            <span className="text-xs font-medium text-destructive">
                                {processingError ? "Processing Failed" : "Upload Failed"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                                {processingError || "The network connection was interrupted or the session expired."}
                            </span>
                        </div>
                        {/* Only show Retry for client-side upload failures, not server-side processing failures */}
                        {!processingError && (
                            <Button variant="outline" size="sm" className="shrink-0 h-7 text-xs" onClick={() => resumeUpload()}>Retry</Button>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className="h-16 px-6 flex items-center justify-between w-full">
            {/* Left side: Upload / Processing status */}
            <div className="flex-1 min-w-0">
                {renderLeftContent()}
            </div>

            {/* Right side: Global Actions (Close / Cancel) */}
            {(status === "UPLOADING" || status === "PAUSED") && (
                <div className="flex items-center pl-4 ml-4 border-l border-border/60 h-8 shrink-0">
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive h-7" onClick={() => clearUpload()}>
                        Cancel
                    </Button>
                </div>
            )}
        </div>
    );
}
