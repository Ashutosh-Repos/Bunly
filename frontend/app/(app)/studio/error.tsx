"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle } from "@tabler/icons-react";

export default function StudioError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Studio Route Error:", error);
    }, [error]);

    return (
        <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-6 text-center p-8">
            <div className="p-5 rounded-full bg-destructive/10 text-destructive mb-2 shadow-sm border border-destructive/20">
                <IconAlertTriangle className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black tracking-tighter uppercase text-foreground/90">
                Studio Unavailable
            </h2>
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/40 max-w-md leading-relaxed">
                We encountered an unexpected error loading the Creator Studio. Please verify your connection or try again later.
            </p>
            <Button 
                onClick={() => reset()}
                className="mt-4 bg-primary text-black font-black uppercase tracking-widest text-[10px] h-10 px-8 rounded-xl shadow-[0_0_15px_-3px_oklch(var(--primary)/0.4)]"
            >
                Try Again
            </Button>
        </div>
    );
}
