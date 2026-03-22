"use client";

import { useState } from "react";
import { IconBell, IconCheck } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/providers/session-provider";
import {
    NotificationItem,
    type NotificationItemData,
} from "@/components/custom/notification-item";

const POPOVER_MAX_ITEMS = 7;

export function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();
    const { user } = useSession();
    const utils = trpc.useUtils();

    // 1. Fetch Notifications (Infinite Query)
    const { data } = trpc.notification.list.useInfiniteQuery(
        { limit: 10 },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
            enabled: !!user,
        },
    );

    // 2. Persisted Unread Count
    const { data: serverUnreadCount } = trpc.notification.getUnreadCount.useQuery(undefined, {
        enabled: !!user,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
    });
    
    // We compute the unread count directly off the TRPC truth to prevent React cascading render errors
    const unreadCount = serverUnreadCount ?? 0;

    // 3. Real-time Subscription (direct cache update + desktop toast)
    trpc.notification.onNotification.useSubscription(undefined, {
        onData(notification) {
            // [BUG FIX] Strip argument matchers from invalidates to ensure all feeds sync globally!
            utils.notification.list.invalidate();
            utils.notification.getUnreadCount.invalidate();

            // Desktop toast when bell is closed
            if (!isOpen) {
                const notif = notification as NotificationItemData;
                const msg = notif.title || "New notification";
                toast(msg, {
                    description: notif.message,
                    action: notif.actionUrl
                        ? {
                              label: "View",
                              onClick: () => router.push(notif.actionUrl as string),
                          }
                        : undefined,
                    duration: 5000,
                });
            }
        },
        enabled: !!user,
    });

    // 4. Mutations

    const markRead = trpc.notification.markRead.useMutation({
        onMutate: async ({ id }) => {
            // Optimistic update — we don't bind to { limit: 10 } exactly so both caches get swept if possible, 
            // but for setInfiniteData we need to match the specific query key.
            // We'll update the `limit: 10` cache which drives this component directly.
            await utils.notification.list.cancel({ limit: 10 });
            const prev = utils.notification.list.getInfiniteData({ limit: 10 });

            utils.notification.list.setInfiniteData({ limit: 10 }, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        items: page.items.map((item) =>
                            item.id === id ? { ...item, isRead: true } : item,
                        ),
                    })),
                };
            });

            utils.notification.getUnreadCount.setData(undefined, (c = 0) => Math.max(0, c - 1));
            return { prev };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev) {
                utils.notification.list.setInfiniteData({ limit: 10 }, ctx.prev);
                utils.notification.getUnreadCount.setData(undefined, (c = 0) => c + 1);
            }
            toast.error("Failed to mark notification as read");
        },
        onSettled: () => {
            // [BUG FIX] Strip limit:10 to invalidate global cache states (ghost states fix)
            utils.notification.list.invalidate();
            utils.notification.getUnreadCount.invalidate();
        },
    });

    const markAllRead = trpc.notification.markAllRead.useMutation({
        onMutate: async () => {
            await utils.notification.list.cancel({ limit: 10 });
            const prevList = utils.notification.list.getInfiniteData({ limit: 10 });
            const prevCount = unreadCount;

            utils.notification.getUnreadCount.setData(undefined, 0);
            utils.notification.list.setInfiniteData({ limit: 10 }, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        items: page.items.map((item) => ({
                            ...item,
                            isRead: true,
                            readAt: new Date(),
                        })),
                    })),
                };
            });
            utils.notification.getUnreadCount.setData(undefined, 0);

            return { prevList, prevCount };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prevList) {
                utils.notification.list.setInfiniteData({ limit: 10 }, ctx.prevList);
            }
            if (ctx?.prevCount !== undefined) {
                utils.notification.getUnreadCount.setData(undefined, ctx.prevCount);
            }
            toast.error("Failed to mark all as read");
        },
        onSettled: () => {
            utils.notification.list.invalidate();
            utils.notification.getUnreadCount.invalidate();
        },
    });

    const deleteNotification = trpc.notification.delete.useMutation({
        onMutate: async ({ id }) => {
            await utils.notification.list.cancel({ limit: 10 });
            const prev = utils.notification.list.getInfiniteData({ limit: 10 });

            // [BUG FIX] Secure Unread Cache Leak — decrement count if the deleted item was unread!
            let wasUnread = false;

            utils.notification.list.setInfiniteData({ limit: 10 }, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        items: page.items.filter((item) => {
                            if (item.id === id) {
                                if (!item.isRead) wasUnread = true;
                                return false;
                            }
                            return true;
                        }),
                    })),
                };
            });

            if (wasUnread) {
                utils.notification.getUnreadCount.setData(undefined, (c = 0) => Math.max(0, c - 1));
            }

            return { prev, wasUnread };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev) {
                utils.notification.list.setInfiniteData({ limit: 10 }, ctx.prev);
            }
            if (ctx?.wasUnread) {
                utils.notification.getUnreadCount.setData(undefined, (c = 0) => c + 1);
            }
            toast.error("Failed to delete notification");
        },
        onSettled: () => {
            utils.notification.list.invalidate();
            utils.notification.getUnreadCount.invalidate();
        },
    });

    const updateNotificationLevel = trpc.channel.updateNotificationLevel.useMutation();

    // Prevent rendering the bell at all if unauthenticated
    if (!user) return null;

    const notifications = data?.pages.flatMap((page) => page.items) || [];
    const popoverItems = notifications.slice(0, POPOVER_MAX_ITEMS);

    const handleNotificationClick = (notification: NotificationItemData) => {
        if (!notification.isRead) {
            markRead.mutate({ id: notification.id });
        }
        setIsOpen(false);
        if (notification.actionUrl) {
            router.push(notification.actionUrl);
        }
    };

    const handleDelete = (id: string) => deleteNotification.mutate({ id });

    const handleTurnOffChannel = (channelId: string) => {
        updateNotificationLevel.mutate({ channelId, level: "NONE" });
        toast.success("Notifications turned off for this channel");
    };

    // Badge display: cap at 99+
    const badgeText = unreadCount > 99 ? "99+" : `${unreadCount}`;

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative hover:bg-secondary/80 transition-colors rounded-full h-10 w-10 shrink-0"
                >
                    <IconBell className="h-5 w-5" stroke={2} />
                    <span className="sr-only">Notifications</span>
                    {unreadCount > 0 && (
                        <span
                            className={cn(
                                "absolute -top-0.5 -right-0.5 rounded-full bg-primary ring-2 ring-background text-[10px] font-black text-primary-foreground flex items-center justify-center animate-in zoom-in duration-300 shadow-[0_0_10px_oklch(var(--primary)/0.4)]",
                                unreadCount > 99 ? "h-5 min-w-5 px-1.5" : "h-4 w-4",
                            )}
                        >
                            {badgeText}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[380px] p-0 bg-popover/95 backdrop-blur-2xl border-border/40 shadow-2xl rounded-2xl overflow-hidden mr-2 sm:mr-4 font-sans"
                align="end"
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/20 bg-muted/20">
                    <h4 className="font-black text-[15px] tracking-tight text-foreground/90">
                        Notifications
                    </h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                            onClick={() => markAllRead.mutate()}
                            disabled={markAllRead.isPending}
                        >
                            <IconCheck className="h-3.5 w-3.5 mr-1.5" stroke={3} />
                            Mark all read
                        </Button>
                    )}
                </div>
                <ScrollArea className="max-h-[400px]">
                    {popoverItems.length === 0 ? (
                        <div className="p-8 pb-10 flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
                            <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mb-1">
                                <IconBell className="h-8 w-8 text-muted-foreground/40" stroke={1.5} />
                            </div>
                            <p className="text-[15px] font-bold text-foreground/80 tracking-tight">
                                Customise your notifications
                            </p>
                            <p className="text-sm px-4 leading-relaxed opacity-80">
                                Your channel activity will show up here.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col pb-1">
                            {popoverItems.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification as NotificationItemData}
                                    onClick={handleNotificationClick}
                                    onDelete={handleDelete}
                                    onTurnOff={handleTurnOffChannel}
                                    compact
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>
                {/* Footer Link */}
                <div className="border-t border-border/20 p-1.5 bg-muted/40">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-10 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 hover:text-foreground hover:bg-secondary rounded-xl transition-all"
                        onClick={() => {
                            setIsOpen(false);
                            router.push("/me/notifications");
                        }}
                    >
                        See all notifications
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
