"use client";

import { useStudio } from "./_components/studio-provider";

export default function StudioDashboardPage() {
    const { channel } = useStudio();

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
            <div className="space-y-1 text-left">
                <h1 className="text-4xl max-sm:text-3xl font-black tracking-tighter uppercase text-foreground/90 leading-[1.1]">
                    Channel Dashboard
                </h1>
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/60">
                    Welcome back, {channel.name}
                </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="col-span-1 lg:col-span-2 rounded-2xl border border-border/10 bg-surface-1 p-6 h-[400px] flex items-center justify-center text-muted-foreground/40 font-black uppercase tracking-widest text-xs border-dashed">
                    Latest Video Performance Widget
                </div>
                <div className="col-span-1 border border-border/10 bg-surface-1 rounded-2xl p-6 h-[400px] flex items-center justify-center text-muted-foreground/40 font-black uppercase tracking-widest text-xs border-dashed">
                    Analytics Snapshot Widget
                </div>
            </div>
        </div>
    );
}
