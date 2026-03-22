"use client";

import { useUpload } from "@/components/providers/upload-provider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UploadDropzone } from "./upload-dropzone";
import { UploadEditor } from "./upload-editor";
import { UploadProgressFooter } from "./upload-progress-footer";

export function UploadModal() {
    const { isModalOpen, closeModal, status } = useUpload();

    return (
        <Dialog 
            open={isModalOpen} 
            onOpenChange={(open) => {
                if (!open) closeModal();
            }}
        >
            <DialogContent 
                className="max-w-4xl p-0 overflow-hidden flex flex-col h-[85vh] max-h-[850px]"
                // Disable clicking outside to close so user doesn't accidentally lose draft state
                onInteractOutside={(e) => e.preventDefault()}
                showCloseButton={false}
            >
                {/* Header is visually hidden during the flow, but provided for accessibility */}
                <div className="sr-only">
                    <DialogHeader>
                        <DialogTitle>Upload Video</DialogTitle>
                        <DialogDescription>Upload and configure your video details.</DialogDescription>
                    </DialogHeader>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto w-full">
                    {status === "UNINITIALIZED" ? (
                        <UploadDropzone />
                    ) : (
                        <UploadEditor />
                    )}
                </div>

                {/* Always-Pinned Footer during upload process */}
                {status !== "UNINITIALIZED" && (
                    <div className="shrink-0 border-t bg-background">
                        <UploadProgressFooter />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
