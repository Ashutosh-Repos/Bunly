"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { UploadEngine, UploadStatus } from "@/lib/upload-engine";
import { trpc } from "@/lib/trpc-client";

interface UploadContextValue {
    engine: UploadEngine | null;
    status: UploadStatus | "UNINITIALIZED";
    progress: number;
    videoId: string | null;
    wsUrl: string | null;
    isModalOpen: boolean;
    openModal: () => void;
    closeModal: () => void;
    startUpload: (file: File, channelId: string) => void;
    editDraft: (videoId: string, processingStatus?: string) => void;
    pauseUpload: () => void;
    resumeUpload: () => void;
    cancelUpload: () => void;
    clearUpload: () => void;
    markReady: () => void;
    markFailed: () => void;
}

const UploadContext = createContext<UploadContextValue | undefined>(undefined);

export function UploadProvider({ children }: { children: React.ReactNode }) {
    const [engine, setEngine] = useState<UploadEngine | null>(null);
    const [status, setStatus] = useState<UploadStatus | "UNINITIALIZED">("UNINITIALIZED");
    const [progress, setProgress] = useState(0);
    const [videoId, setVideoId] = useState<string | null>(null);
    const [wsUrl, setWsUrl] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // TRPC Utils to imperatively call mutations outside of render loops
    const utils = trpc.useUtils();

    // Clean up engine on unmount if it's running
    useEffect(() => {
        return () => {
            if (engine && engine.status === "UPLOADING") {
                engine.pause();
            }
        };
    }, [engine]);

    const startUpload = (file: File, channelId: string) => {
        if (engine && (engine.status === "UPLOADING" || engine.status === "PROCESSING")) {
            console.warn("Upload already in progress.");
            return;
        }

        const newEngine = new UploadEngine({
            file,
            channelId,
            apiAdapter: {
                initUpload: async (data) => {
                    return await utils.client.video.initUpload.mutate(data);
                },
                getPartUrls: async (data) => {
                    return await utils.client.video.getPartUrls.mutate(data);
                },
                completeUpload: async (data) => {
                    return await utils.client.video.completeUpload.mutate(data);
                },
                abortUpload: async (data) => {
                    return await utils.client.video.abortUpload.mutate(data);
                },
                reportFailure: async (data) => {
                    return await utils.client.video.reportFailure.mutate(data);
                }
            },
            onProgress: (p) => setProgress(p),
            onStatusChange: (s) => setStatus(s),
            onVideoCreated: (id, url) => {
                setVideoId(id);
                setWsUrl(url);
            },
            onError: (err) => {
                console.error("[UploadProvider] Engine Error:", err);
            }
        });

        setEngine(newEngine);
        setStatus("IDLE");
        setProgress(0);
        setVideoId(null);
        setWsUrl(null);
        
        newEngine.start();
    };

    const pauseUpload = () => {
        engine?.pause();
    };

    const editDraft = (id: string, processingStatus?: string) => {
        // Map backend processingStatus string to a valid UploadStatus for context
        let mappedStatus: UploadStatus | "UNINITIALIZED" = "READY";
        if (processingStatus === "PROCESSING" || processingStatus === "UPLOADING") {
            mappedStatus = "PROCESSING";
        } else if (processingStatus === "FAILED") {
            mappedStatus = "FAILED";
        } else if (processingStatus === "PENDING") {
            mappedStatus = "PROCESSING"; // Treat as PROCESSING (still in queue)
        }
        
        setVideoId(id);
        setStatus(mappedStatus);
        openModal();
    };

    const resumeUpload = () => {
        engine?.start(); // start() handles resuming if PAUSED
    };

    const cancelUpload = async () => {
        if (engine) {
            await engine.abort();
        }
        setEngine(null);
        setStatus("UNINITIALIZED");
        setProgress(0);
        setVideoId(null);
        setWsUrl(null);
    };

    const clearUpload = () => {
        setEngine(null);
        setStatus("UNINITIALIZED");
        setProgress(0);
        setVideoId(null);
        setWsUrl(null);
    };

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    return (
        <UploadContext.Provider
            value={{
                engine,
                status,
                progress,
                videoId,
                wsUrl,
                isModalOpen,
                openModal,
                closeModal,
                startUpload,
                editDraft,
                pauseUpload,
                resumeUpload,
                cancelUpload,
                clearUpload,
                markReady: () => setStatus("READY"),
                markFailed: () => setStatus("FAILED"),
            }}
        >
            {children}
        </UploadContext.Provider>
    );
}

export function useUpload() {
    const context = useContext(UploadContext);
    if (context === undefined) {
        throw new Error("useUpload must be used within an UploadProvider");
    }
    return context;
}

