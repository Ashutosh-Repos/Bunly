"use client";

import { useStudio } from "./studio-provider";
import { Button } from "@/components/ui/button";
import { IconArrowsExchange, IconCheck } from "@tabler/icons-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMediaUrl } from "@/lib/utils";
import Link from "next/link";

export function SwitchChannelButton() {
    const { channel: currentChannel, allChannels } = useStudio();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2 font-black uppercase tracking-widest text-[10px] rounded-xl border-border/20 bg-surface-1">
                    <IconArrowsExchange className="w-4 h-4 text-primary" />
                    Switch Channel
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[300px] rounded-xl">
                <DropdownMenuLabel className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">
                    Your Channels
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allChannels.map((c) => (
                    <DropdownMenuItem asChild key={c.id}>
                        <Link href={`/studio/${c.id}`} className="flex items-center gap-3 cursor-pointer py-3 rounded-lg focus:bg-surface-2 focus:text-foreground">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={getMediaUrl(c.image || "")} />
                                <AvatarFallback>{c.name.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col flex-1 overflow-hidden">
                                <span className="text-xs font-black uppercase truncate">{c.name}</span>
                                <span className="text-[10px] text-muted-foreground truncate">@{c.handle}</span>
                            </div>
                            {c.id === currentChannel.id && (
                                <IconCheck className="w-4 h-4 text-primary" />
                            )}
                        </Link>
                    </DropdownMenuItem>
                ))}
                
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/studio/create" className="flex items-center justify-center font-black uppercase tracking-widest text-[10px] text-primary py-3 cursor-pointer focus:bg-primary/10 rounded-lg">
                        Create new channel
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
