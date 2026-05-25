"use client";

import { useUpload } from "@/components/providers/upload-provider";
import { Button } from "@/components/ui/button";
import { IconUpload } from "@tabler/icons-react";
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
        <div className="flex flex-col items-center justify-center p-8 h-full bg-background rounded-b-xl relative">
            {/* Top Right Close Button (Custom for Dropzone view since it has no footer) */}
            <div className="absolute top-4 right-4 text-muted-foreground flex gap-4 border-b w-full justify-between items-center pb-4 px-4 left-0">
                <h2 className="text-xl font-bold text-foreground">Upload video</h2>
                <Button variant="ghost" size="icon" onClick={() => closeModal()} aria-label="Close">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </Button>
            </div>

            <div 
                className={`mt-16 w-full max-w-2xl flex flex-col items-center justify-center border-2 border-dashed rounded-full aspect-square md:aspect-video transition-colors duration-200 ${
                    isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
            >
                <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center mb-8">
                    <IconUpload size={48} className="text-muted-foreground" />
                </div>
                <p className="text-xl mb-2 text-foreground">Drag and drop video files to upload</p>
                <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">Your videos will be private until you publish them.</p>

                <div className="relative">
                    <Button size="lg" className="rounded-full px-8">SELECT FILES</Button>
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
            
            <p className="text-xs text-muted-foreground mt-auto pt-8 text-center max-w-lg">
                By submitting your videos to Bunly, you acknowledge that you agree to Bunly&apos;s Terms of Service and Community Guidelines.
                Please be sure not to violate others&apos; copyright or privacy rights.
            </p>
        </div>
    );
}
