"use client";

import Link from "next/link";
import { useStudio } from "./studio-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMediaUrl } from "@/lib/utils";
import { SwitchChannelButton } from "./switch-channel-button";
import { IconLayoutDashboard, IconVideoPlus } from "@tabler/icons-react";
import { useUpload } from "@/components/providers/upload-provider";
import { Button } from "@/components/ui/button";

export function StudioNavbar() {
    const { channel } = useStudio();
    const { openModal } = useUpload();

    return (
        <header className="sticky top-0 z-50 w-full h-16 border-b border-border/10 bg-surface-1/95 backdrop-blur supports-backdrop-filter:bg-surface-1/60">
            <div className="flex h-full items-center justify-between px-6">
                <div className="flex items-center gap-4">
                    <Link href={`/studio/${channel.id}`} className="flex items-center gap-3 group">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-black transition-colors">
                            <IconLayoutDashboard className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-2 border-l border-border/20 pl-4">
                            <Avatar className="h-8 w-8 rounded-lg border border-border/20">
                                <AvatarImage src={getMediaUrl(channel.image || "")} alt={channel.name} className="object-cover" />
                                <AvatarFallback className="bg-primary/5 text-primary text-xs tracking-widest font-black uppercase">
                                    {channel.name.slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="text-xs font-black tracking-widest uppercase text-foreground leading-tight">
                                    {channel.name}
                                </span>
                                <span className="text-[9px] font-black tracking-[0.2em] text-muted-foreground uppercase leading-tight">
                                    @{channel.handle}
                                </span>
                            </div>
                        </div>
                    </Link>
                </div>
                
                <div className="flex items-center gap-3">
                    <Button onClick={() => openModal()} variant="outline" className="gap-2 bg-background data-[state=open]:bg-muted">
                        <IconVideoPlus className="h-4 w-4" />
                        <span>Create</span>
                    </Button>
                    <SwitchChannelButton />
                </div>
            </div>
        </header>
    );
}
