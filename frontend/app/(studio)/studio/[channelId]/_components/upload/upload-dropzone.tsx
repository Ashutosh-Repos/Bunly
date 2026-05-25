"use client";

import { useUpload } from "@/components/providers/upload-provider";
import { Button } from "@/components/ui/button";
import { IconUpload, IconX } from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";

export function UploadDropzone() {
    const { startUpload, closeModal } = useUpload();
    const params = useParams();
    const channelId = params.channelId as string;
    
    const [isDragging, setIsDragging] = useState(false);

    const handleFile = useCallback((file: File) => {
        if (!file.type.startsWith("video/")) {
            alert("Please upload a valid video file.");
            return;
        }
        startUpload(file, channelId);
    }, [startUpload, channelId]);

    const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, [handleFile]);

    const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
                <h2 className="text-lg font-semibold text-foreground">Upload video</h2>
                <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => closeModal()} aria-label="Close">
                    <IconX className="h-4 w-4" />
                </Button>
            </div>

            {/* Dropzone */}
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div 
                    className={`w-full max-w-lg flex flex-col items-center justify-center border-2 border-dashed rounded-2xl py-16 px-8 transition-all duration-300 ${
                        isDragging 
                            ? "border-primary bg-primary/5 scale-[1.02]" 
                            : "border-border/50 hover:border-muted-foreground/40"
                    }`}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                >
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-colors duration-300 ${
                        isDragging ? "bg-primary/10" : "bg-muted"
                    }`}>
                        <IconUpload size={36} className={`transition-colors duration-300 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <p className="text-base font-medium mb-1 text-foreground text-center">Drag and drop video files to upload</p>
                    <p className="text-sm text-muted-foreground mb-8 text-center max-w-sm">Your videos will be private until you publish them.</p>

                    <div className="relative">
                        <Button size="lg" className="rounded-full px-8 font-semibold">SELECT FILES</Button>
                        <input 
                            type="file" 
                            accept="video/*"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                    handleFile(e.target.files[0]);
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
            
            {/* Footer */}
            <p className="text-xs text-muted-foreground px-8 pb-6 text-center max-w-lg mx-auto">
                By submitting your videos to Bunly, you acknowledge that you agree to Bunly&apos;s Terms of Service and Community Guidelines.
                Please be sure not to violate others&apos; copyright or privacy rights.
            </p>
        </div>
    );
}
