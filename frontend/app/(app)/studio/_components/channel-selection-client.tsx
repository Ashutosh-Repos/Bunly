"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMediaUrl } from "@/lib/utils";
import { IconPlus } from "@tabler/icons-react";
import type { Channel } from "@/app/(app)/studio/[channelId]/_components/studio-provider";

export function ChannelSelectionClient({ channels }: { channels: Channel[] }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {channels.map((channel) => (
                <Link key={channel.id} href={`/studio/${channel.id}`}>
                    <Card className="hover:border-primary/50 bg-surface-1 border-border/10 transition-all cursor-pointer group h-full">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <Avatar className="h-16 w-16 border-2 border-transparent group-hover:border-primary shadow-sm transition-all">
                                <AvatarImage src={getMediaUrl(channel.image || "")} />
                                <AvatarFallback className="font-black uppercase">{channel.name.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col flex-1 overflow-hidden">
                                <CardTitle className="text-lg truncate">{channel.name}</CardTitle>
                                <CardDescription className="truncate">@{channel.handle}</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-[10px] text-muted-foreground/80 font-black uppercase tracking-[0.2em]">
                                {Intl.NumberFormat('en-US', { notation: 'compact' }).format(channel.subscriberCount)} Subs • {Intl.NumberFormat('en-US', { notation: 'compact' }).format(channel.videoCount)} Videos
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            ))}
            
            <Link href="/studio/create">
                <Card className="hover:border-primary/50 transition-colors cursor-pointer group h-full border-dashed bg-muted/20 hover:bg-muted/40 shadow-none border-border/20 min-h-[140px]">
                    <CardContent className="flex flex-col items-center justify-center h-full text-muted-foreground/60 group-hover:text-primary transition-colors gap-4 pt-6">
                        <div className="p-4 rounded-full bg-background border border-border/10 shadow-sm group-hover:shadow-[0_0_15px_-3px_oklch(var(--primary)/0.3)] transition-all">
                            <IconPlus className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-widest">Create Channel</span>
                    </CardContent>
                </Card>
            </Link>
        </div>
    );
}
