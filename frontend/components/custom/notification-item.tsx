"use client";

import { memo } from "react";
import { 
    IconBell, 
    IconPlayerPlayFilled, 
    IconDotsVertical, 
    IconTrash, 
    IconBellOff,
    IconThumbUp,
    IconUserPlus,
    IconMessageCircle,
    IconMessageCirclePlus
} from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { BunlyImage } from "@/components/custom/bunly-image";

// Map types to Tabler icons and Shadcn contextual colors
const NOTIFICATION_TYPE_CONFIG: Record<
    string,
    { icon: React.ElementType; color: string }
> = {
    NEW_VIDEO: {
        icon: IconPlayerPlayFilled,
        color: "text-primary shadow-[0_0_12px_oklch(var(--primary)/0.3)]",
    },
    LIVE_STARTED: {
        icon: IconPlayerPlayFilled,
        color: "text-primary shadow-[0_0_12px_oklch(var(--primary)/0.3)]",
    },
    LIVE_SCHEDULED: {
        icon: IconBell,
        color: "text-secondary shadow-[0_0_12px_oklch(var(--secondary)/0.3)]",
    },
    VIDEO_LIKE: {
        icon: IconThumbUp,
        color: "text-primary shadow-[0_0_12px_oklch(var(--primary)/0.3)]",
    },
    COMMENT_LIKE: {
        icon: IconThumbUp,
        color: "text-primary shadow-[0_0_12px_oklch(var(--primary)/0.3)]",
    },
    NEW_SUBSCRIBER: {
        icon: IconUserPlus,
        color: "text-primary shadow-[0_0_12px_oklch(var(--primary)/0.3)]",
    },
    COMMENT: {
        icon: IconMessageCircle,
        color: "text-muted-foreground",
    },
    COMMENT_REPLY: {
        icon: IconMessageCirclePlus,
        color: "text-muted-foreground",
    },
    SYSTEM: { icon: IconBell, color: "text-muted-foreground" },
};

export interface NotificationItemData {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string | Date;
    thumbnailUrl: string | null;
    actionUrl: string | null;
    channelId: string | null;
    groupCount: number;
    user_notifications_actorIdTouser: {
        id: string;
        name: string;
        image: string | null;
    } | null;
}

interface NotificationItemProps {
    notification: NotificationItemData;
    onClick?: (notification: NotificationItemData) => void;
    onDelete?: (id: string) => void;
    onTurnOff?: (channelId: string) => void;
    compact?: boolean; // true for popover, false for full page
}

// [PERFORMANCE FIX] Wrap in React.memo to prevent massive DOM layout thrashing during infinite scroll loads
export const NotificationItem = memo(function NotificationItem({
    notification,
    onClick,
    onDelete,
    onTurnOff,
    compact = false,
}: NotificationItemProps) {
    const actor = notification.user_notifications_actorIdTouser;
    const typeConfig = NOTIFICATION_TYPE_CONFIG[notification.type];
    const hasActor = !!actor;
    const groupCount = notification.groupCount || 1;

    // Build standard group suffix if multiple events collapsed
    const groupSuffix =
        groupCount > 1
            ? ` and ${groupCount - 1} other${groupCount - 1 > 1 ? "s" : ""}`
            : "";

    // The Icon to render safely
    const FallbackIcon = IconBell;
    const TypeIcon = typeConfig?.icon || FallbackIcon;

    return (
        <article
            className={cn(
                "flex items-start gap-4 p-4 lg:p-5 rounded-xl transition-all duration-300 transform-gpu bg-card/60 hover:bg-secondary/60 border border-border/20 cursor-pointer group relative font-sans shadow-sm hover:shadow-md",
                !notification.isRead &&
                    "bg-primary/5 hover:bg-primary/10 border-primary/20",
            )}
            onClick={() => onClick?.(notification)}
        >
            {/* Unread Indicator Bar */}
            {!notification.isRead && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1/2 w-1 bg-primary rounded-r-full shadow-[0_0_8px_oklch(var(--primary)/0.6)]" />
            )}

            {/* Avatar: Actor Photo OR Type Icon */}
            <div className="relative shrink-0">
                {hasActor ? (
                    <Avatar className="h-12 w-12 xl:h-14 xl:w-14 border-2 border-background/50 shadow-sm transition-transform group-hover:scale-105">
                        <BunlyImage 
                            src={actor?.image} 
                            alt={actor?.name ?? "User"}
                            fill
                            className="rounded-full object-cover"
                        />
                        <AvatarFallback className="bg-muted font-bold text-lg select-none">
                            {actor?.name?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                    </Avatar>
                ) : (
                    <div
                        className={cn(
                            "h-12 w-12 xl:h-14 xl:w-14 rounded-2xl flex items-center justify-center bg-secondary border border-border/40 transition-transform group-hover:scale-105 shadow-sm",
                            typeConfig?.color,
                        )}
                    >
                        <TypeIcon className="h-6 w-6 xl:h-7 xl:w-7" />
                    </div>
                )}
                {/* Secondary Type Icon overlay layout */}
                {hasActor && typeConfig && (
                    <div
                        className={cn(
                            "absolute -bottom-1 -right-1 h-5 w-5 xl:h-6 xl:w-6 rounded-full border-2 border-background flex items-center justify-center bg-card shadow-sm",
                            typeConfig.color,
                        )}
                    >
                        <TypeIcon className="h-3 w-3 xl:h-3.5 xl:w-3.5" />
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col gap-1.5 min-w-0 justify-center h-full pt-1">
                <p
                    className={cn(
                        "text-[15px] xl:text-[16px] leading-snug text-foreground/90",
                        compact ? "line-clamp-2" : "line-clamp-3",
                    )}
                >
                    {/* [BUG FIX] Canonical Notification Routing: Directly render Title & Message */}
                    {notification.title && (
                        <span className="font-extrabold text-foreground tracking-tight mr-1.5">
                            {notification.title}
                            {groupSuffix && (
                                <span className="text-muted-foreground ml-1 font-semibold">
                                    {groupSuffix}
                                </span>
                            )}
                        </span>
                    )}
                    <span className="text-foreground/80 font-medium">
                        {notification.message}
                    </span>
                </p>
                <time className="text-[11px] xl:text-xs font-bold uppercase tracking-widest text-muted-foreground/50 group-hover:text-muted-foreground/80 transition-colors flex items-center gap-1.5">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                    })}
                </time>
            </div>

            {/* Right side: Thumbnail */}
            {notification.thumbnailUrl && (
                <div className="shrink-0 relative overflow-hidden rounded-lg ml-2 border border-border/20 shadow-sm transition-transform group-hover:scale-105 bg-muted w-24 h-16 xl:w-[114px] xl:h-[72px]">
                    <BunlyImage
                        src={notification.thumbnailUrl}
                        alt="Thumbnail"
                        fill
                        className="object-cover"
                    />
                </div>
            )}

            {/* ⋮ Actions Menu (appears on hover) */}
            {(onDelete || onTurnOff) && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 xl:h-8 xl:w-8 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-secondary/80 focus:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <IconDotsVertical className="h-4 w-4 text-muted-foreground" stroke={2} />
                            <span className="sr-only">Open notification actions</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 font-sans">
                        {onDelete && (
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(notification.id);
                                }}
                                className="text-destructive focus:bg-destructive/10 cursor-pointer font-semibold py-2.5"
                            >
                                <IconTrash className="h-4 w-4 mr-2" stroke={2.5} />
                                Remove notification
                            </DropdownMenuItem>
                        )}
                        {onTurnOff && notification.channelId && (
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTurnOff(notification.channelId!);
                                }}
                                className="cursor-pointer font-semibold py-2.5"
                            >
                                <IconBellOff className="h-4 w-4 mr-2 text-muted-foreground" stroke={2.5} />
                                Turn off from channel
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </article>
    );
});
