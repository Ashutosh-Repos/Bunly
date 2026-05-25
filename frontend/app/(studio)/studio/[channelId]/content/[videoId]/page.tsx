"use client";

import { use } from "react";
import { UploadEditor } from "../../_components/upload/upload-editor";
import { IconChevronLeft } from "@tabler/icons-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function StandaloneEditorPage({ params }: { params: Promise<{ channelId: string; videoId: string }> }) {
    // Next.js 15+ async params unwrap
    const { videoId, channelId } = use(params);

    return (
        <div className="flex flex-col h-full bg-background relative max-w-5xl mx-auto py-8">
            <div className="mb-4">
                <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
                    <Link href={`/studio/${channelId}/content`}>
                        <IconChevronLeft className="mr-2" size={16} />
                        Back to Channel Content
                    </Link>
                </Button>
            </div>
            
            <div className="border rounded-xl shadow-sm bg-card overflow-hidden h-[85vh] min-h-[600px]">
                {/* 
                  Leverages the pure UploadEditor logic completely detached from the global context provider modal.
                  It will automatically fetch the video details from tRPC and auto-save drafts on "Next".
                */}
                <UploadEditor idOverride={videoId} standalone={true} />
            </div>
        </div>
    );
}
