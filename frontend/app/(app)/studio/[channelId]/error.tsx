"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle } from "@tabler/icons-react";
import Link from "next/link";

export default function StudioChannelError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Studio Layout Error:", error);
    }, [error]);

    return (
        <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-6 text-center p-8">
            <div className="p-5 rounded-full bg-destructive/10 text-destructive mb-2 shadow-sm border border-destructive/20">
                <IconAlertTriangle className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black tracking-tighter uppercase text-foreground/90">
                Dashboard Unavailable
            </h2>
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/40 max-w-md leading-relaxed">
                We failed to authenticate or hook into your Creator Profile.
            </p>
            <div className="flex items-center gap-4 mt-4">
                <Button 
                    variant="outline"
                    onClick={() => reset()}
                    className="font-black uppercase tracking-widest text-[10px] h-10 px-6 rounded-xl border-border/20"
                >
                    Retry Connection
                </Button>
                <Button 
                    asChild
                    className="bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-widest text-[10px] h-10 px-6 rounded-xl shadow-[0_0_15px_-3px_oklch(var(--primary)/0.4)]"
                >
                    <Link href="/studio">
                        Return to Hub
                    </Link>
                </Button>
            </div>
        </div>
    );
}
