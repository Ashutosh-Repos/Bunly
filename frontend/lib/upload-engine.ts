
"use client";

import { v4 as uuidv4 } from "uuid";

export type UploadStatus = "IDLE" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "PAUSED";

export interface PartState {
    partNumber: number;
    startPoint: number;
    endPoint: number;
    blob: Blob;
    status: "PENDING" | "UPLOADING" | "COMPLETED" | "FAILED";
    loaded: number; // Bytes uploaded so far for this part
    eTag?: string;
    uploadUrl?: string;
    xhr?: XMLHttpRequest;
    retries: number;
}

export interface UploadApiAdapter {
    initUpload: (data: { fileName: string; channelId: string; idempotencyKey?: string }) => Promise<{ videoId: string; uploadId: string; wsUrl: string }>;
    getPartUrls: (data: { videoId: string; uploadId: string; parts: { partNumber: number }[] }) => Promise<{ urls: { partNumber: number; url: string }[] }>;
    completeUpload: (data: { videoId: string; uploadId: string; parts: { ETag: string; PartNumber: number }[] }) => Promise<unknown>;
    abortUpload: (data: { videoId: string; uploadId: string }) => Promise<unknown>;
    reportFailure: (data: { videoId: string; error?: string }) => Promise<unknown>;
}

export interface UploadEngineConfig {
    file: File;
    channelId: string;
    apiAdapter: UploadApiAdapter;
    onProgress?: (progress: number) => void;
    onStatusChange?: (status: UploadStatus) => void;
    onError?: (error: Error) => void;
    onVideoCreated?: (videoId: string, wsUrl: string) => void;
    chunkSizeMB?: number;
    maxConcurrency?: number;
    maxRetries?: number;
}

export class UploadEngine {
    public id: string;
    public file: File;
    public channelId: string;
    public api: UploadApiAdapter;

    public videoId: string | null = null;
    public uploadId: string | null = null;
    public wsUrl: string | null = null;
    public status: UploadStatus = "IDLE";
    
    public parts: Map<number, PartState> = new Map();
    public progress: number = 0;
    
    private chunkSize: number;
    private maxConcurrency: number;
    private maxRetries: number;
    private activeUploads: number = 0;
    private idempotencyKey: string;

    // Callbacks
    private onProgress?: (p: number) => void;
    private onStatusChange?: (s: UploadStatus) => void;
    private onError?: (e: Error) => void;
    private onVideoCreated?: (id: string, wsUrl: string) => void;

    constructor(config: UploadEngineConfig) {
        this.id = uuidv4();
        this.file = config.file;
        this.channelId = config.channelId;
        this.api = config.apiAdapter;
        
        this.onProgress = config.onProgress;
        this.onStatusChange = config.onStatusChange;
        this.onError = config.onError;
        this.onVideoCreated = config.onVideoCreated;

        this.chunkSize = (config.chunkSizeMB || 5) * 1024 * 1024;
        this.maxConcurrency = config.maxConcurrency || 3;
        this.maxRetries = config.maxRetries || 3;
        this.idempotencyKey = uuidv4(); // Locally generated idempotency

        this.initializeParts();
    }

    private setStatus(newStatus: UploadStatus) {
        this.status = newStatus;
        if (this.onStatusChange) this.onStatusChange(this.status);
    }

    private initializeParts() {
        const totalParts = Math.ceil(this.file.size / this.chunkSize);
        for (let i = 0; i < totalParts; i++) {
            const startPoint = i * this.chunkSize;
            const endPoint = Math.min(startPoint + this.chunkSize, this.file.size);
            const blob = this.file.slice(startPoint, endPoint);
            
            this.parts.set(i + 1, {
                partNumber: i + 1,
                startPoint,
                endPoint,
                blob,
                status: "PENDING",
                loaded: 0,
                retries: 0
            });
        }
    }

    private calculateOverallProgress() {
        let totalLoaded = 0;
        this.parts.forEach(part => {
            if (part.status === "COMPLETED") {
                totalLoaded += part.blob.size;
            } else {
                totalLoaded += part.loaded;
            }
        });

        const newProgress = Math.min(100, Math.round((totalLoaded / this.file.size) * 100));
        if (newProgress !== this.progress) {
            this.progress = newProgress;
            if (this.onProgress) this.onProgress(this.progress);
        }
    }

    public async start() {
        if (this.status !== "IDLE" && this.status !== "PAUSED" && this.status !== "FAILED") return;
        
        // Reset retries for failed chunks to allow recovery
        if (this.status === "FAILED") {
            this.parts.forEach(p => {
                if (p.status === "FAILED") p.retries = 0;
            });
        }

        try {
            this.setStatus("UPLOADING");

            if (!this.videoId || !this.uploadId) {
                // Phase 1: Initialize
                const res = await this.api.initUpload({
                    fileName: this.file.name,
                    channelId: this.channelId,
                    idempotencyKey: this.idempotencyKey,
                });
                this.videoId = res.videoId;
                this.uploadId = res.uploadId;
                this.wsUrl = res.wsUrl;
                
                if (this.onVideoCreated) {
                    this.onVideoCreated(this.videoId, this.wsUrl);
                }
            }

            // Phase 2: Start worker loop
            this.pump();
        } catch (error: unknown) {
            this.handleError(error);
        }
    }

    private async pump() {
        if (this.status !== "UPLOADING") return;

        // Check if all parts are done
        const allParts = Array.from(this.parts.values());
        const completedCount = allParts.filter(p => p.status === "COMPLETED").length;
        
        if (completedCount === allParts.length) {
            return this.finishUpload();
        }

        // Find available parts to upload
        const pendingParts = allParts.filter(p => p.status === "PENDING" || p.status === "FAILED");
        const spacesAvailable = this.maxConcurrency - this.activeUploads;

        if (spacesAvailable <= 0 || pendingParts.length === 0) return;

        // Take up to `spacesAvailable` parts
        const partsToProcess = pendingParts.slice(0, spacesAvailable);
        
        // Find which parts need URLs
        const partsNeedingUrls = partsToProcess.filter(p => !p.uploadUrl);
        
        if (partsNeedingUrls.length > 0 && this.videoId && this.uploadId) {
            try {
                // Batch fetch presigned URLs based on our API contract
                const res = await this.api.getPartUrls({
                    videoId: this.videoId,
                    uploadId: this.uploadId,
                    parts: partsNeedingUrls.map(p => ({ partNumber: p.partNumber }))
                });

                res.urls.forEach(u => {
                    const part = this.parts.get(u.partNumber);
                    if (part) part.uploadUrl = u.url;
                });
            } catch (err: unknown) {
                // If we fail to get URLs, pause and error
                this.handleError(err);
                return;
            }
        }

        // Start XHR for parts that now have URLs
        partsToProcess.forEach(part => {
            if (part.uploadUrl && part.status !== "UPLOADING") {
                this.uploadPart(part);
            }
        });
    }

    private uploadPart(part: PartState) {
        if (!part.uploadUrl) return;
        
        part.status = "UPLOADING";
        this.activeUploads++;

        const xhr = new XMLHttpRequest();
        part.xhr = xhr;

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                part.loaded = event.loaded;
                this.calculateOverallProgress();
            }
        };

        xhr.onload = () => {
            part.xhr = undefined;
            this.activeUploads--;

            if (xhr.status >= 200 && xhr.status < 300) {
                part.status = "COMPLETED";
                part.loaded = part.blob.size;
                
                // Get ETag from S3 response
                const eTag = xhr.getResponseHeader("ETag");
                if (eTag) {
                    // S3 might wrap ETag in quotes, remove them
                    part.eTag = eTag.replace(/"/g, "");
                } else {
                    // Fallback if CORS doesn't expose ETag (ensure CORS rules are set on S3)
                    console.warn(`[UploadEngine] Part ${part.partNumber} completed but no ETag found in response.`);
                }
                
                this.calculateOverallProgress();
                this.pump(); // Try to start next part
            } else {
                this.handlePartFailure(part);
            }
        };

        xhr.onerror = () => {
            part.xhr = undefined;
            this.activeUploads--;
            this.handlePartFailure(part);
        };
        
        xhr.onabort = () => {
            part.xhr = undefined;
            this.activeUploads--;
            part.status = "PENDING";
            part.loaded = 0;
        };

        xhr.open("PUT", part.uploadUrl);
        // Do NOT set Content-Type header unless it was included in backend signing. 
        // Standard S3 pre-signed URLs without specific Content-Type signing will fail if it's set here.
        xhr.send(part.blob);
    }

    private handlePartFailure(part: PartState) {
        part.retries++;
        
        if (part.retries >= this.maxRetries) {
            part.status = "FAILED";
            this.handleError(new Error(`Part ${part.partNumber} failed to upload after ${this.maxRetries} attempts.`));
        } else {
            // Requeue for retry
            part.status = "PENDING";
            part.uploadUrl = undefined; // Force get a new URL just in case it expired
            part.loaded = 0;
            
            // Wait a moment before retrying using exponential backoff locally
            const backoffTime = Math.pow(2, part.retries) * 1000;
            setTimeout(() => this.pump(), backoffTime);
        }
    }

    private async finishUpload() {
        if (!this.videoId || !this.uploadId || this.status === "PROCESSING") return;
        
        // Eagerly set to PROCESSING to lock out concurrent finishUpload calls from overlapping HTTP callbacks
        this.setStatus("PROCESSING");

        try {
            const completedParts = Array.from(this.parts.values())
                .sort((a, b) => a.partNumber - b.partNumber)
                .map(p => ({
                    PartNumber: p.partNumber,
                    ETag: p.eTag!
                }));

            // Make sure all parts have ETags (safeguard)
            if (completedParts.some(p => !p.ETag)) {
                throw new Error("Cannot complete upload: some parts are missing ETags due to missing S3 CORS headers.");
            }

            await this.api.completeUpload({
                videoId: this.videoId,
                uploadId: this.uploadId,
                parts: completedParts
            });
            
        } catch (error: unknown) {
            this.handleError(error);
        }
    }

    public pause() {
        if (this.status !== "UPLOADING") return;
        this.setStatus("PAUSED");
        
        // Abort all in-flight XHRs and clear stale URLs
        this.parts.forEach(part => {
            if (part.status === "UPLOADING" && part.xhr) {
                part.xhr.abort();
            }
            if (part.status !== "COMPLETED") {
                // Drop the pre-signed URL so that it is re-fetched on resume.
                // S3 presigned URLs expire, so keeping them across long pauses creates 403 Forbidden errors.
                part.uploadUrl = undefined;
            }
        });
    }

    public async abort() {
        this.pause();
        this.setStatus("FAILED");
        
        if (this.videoId && this.uploadId) {
            try {
                await this.api.abortUpload({
                    videoId: this.videoId,
                    uploadId: this.uploadId
                });
            } catch (err) {
                console.warn("[UploadEngine] Failed to notify API of abort", err);
            }
        }
    }

    private handleError(error: unknown) {
        this.pause();
        this.setStatus("FAILED");
        if (this.onError) this.onError(error instanceof Error ? error : new Error(String(error)));
        
        if (this.videoId) {
            this.api.reportFailure({ 
                videoId: this.videoId, 
                error: error instanceof Error ? error.message : String(error) 
            }).catch(() => {});
        }
    }
}
