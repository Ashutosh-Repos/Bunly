"use client";

import { useState, useMemo, useEffect } from "react";
import { IconBell, IconCheck, IconSettings } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { trpc, type RouterOutputs } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/providers/session-provider";
import {
    NotificationItem,
    type NotificationItemData,
} from "@/components/custom/notification-item";
import { toast } from "sonner";
import { NotificationSettings } from "./_components/notification-settings";
import { useInView } from "react-intersection-observer";

const FILTER_TABS = [
    { key: "all", label: "All Activity" },
    { key: "uploads", label: "Uploads" },
    { key: "comments", label: "Mentions & Comments" },
    { key: "activity", label: "Activity" },
] as const;

type FilterTab = (typeof FILTER_TABS)[number]["key"];

type InfiniteNotificationData = {
    pages: RouterOutputs["notification"]["list"][];
    pageParams: (string | null)[];
};

export default function NotificationsPage() {
    const [activeTab, setActiveTab] = useState<FilterTab>("all");
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const router = useRouter();
    const { user } = useSession();
    const utils = trpc.useUtils();

    // Map the active frontend tab to the backend TRPC mapped enum
    const currentTypeFilter = activeTab === "all" ? undefined : activeTab;

    // ─── Queries & Settings ──────────────────────────────────────────────────
    
    // Fetch user settings dynamically for the Settings UI
    const { data: initialSettings, isLoading: isLoadingSettings } = trpc.notification.getSettings.useQuery(undefined, {
        enabled: isSettingsOpen && !!user,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const { 
        data, 
        fetchNextPage, 
        hasNextPage, 
        isFetchingNextPage, 
        isLoading, 
        isError 
    } = trpc.notification.list.useInfiniteQuery(
        {
            limit: 20,
            typeFilter: currentTypeFilter,
        },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
            enabled: !!user,
            staleTime: 1000 * 10,
        },
    );

    // ─── Real-Time Subscriptions ──────────────────────────────────────────────
    
    // [REAL-TIME FIX] Safely inject incoming pushes dynamically without unmounting or reloading React
    trpc.notification.onNotification.useSubscription(undefined, {
        enabled: !!user,
        onData(notification: RouterOutputs["notification"]["list"]["items"][number]) {
            try {
                const updater = (old: InfiniteNotificationData | undefined) => {
                    if (!old) return old;
                    const firstPage = old.pages[0];
                    if (!firstPage) return old;
                    
                    return {
                        ...old,
                        pages: [
                            { ...firstPage, items: [notification, ...firstPage.items.filter(i => i.id !== notification.id)] },
                            ...old.pages.slice(1)
                        ]
                    };
                };
                
                // Add to "all" cache tab
                utils.notification.list.setInfiniteData({ limit: 20, typeFilter: undefined }, updater);
                
                // [BUG FIX] Map WebSockets directly to sub-tabs dynamically so users don't see stale empty states
                if (notification.type === 'NEW_VIDEO') {
                    utils.notification.list.setInfiniteData({ limit: 20, typeFilter: "uploads" }, updater);
                } else if (notification.type === 'COMMENT' || notification.type === 'COMMENT_REPLY') {
                    utils.notification.list.setInfiniteData({ limit: 20, typeFilter: "comments" }, updater);
                } else if (['VIDEO_LIKE', 'COMMENT_LIKE', 'NEW_SUBSCRIBER', 'LIVE_STARTED', 'LIVE_SCHEDULED', 'SYSTEM'].includes(notification.type)) {
                    utils.notification.list.setInfiniteData({ limit: 20, typeFilter: "activity" }, updater);
                }
                
                // Add to specific tab dynamically if it matches
                utils.notification.getUnreadCount.invalidate();
            } catch (err) {
                console.error("Failed to process incoming notification", err);
            }
        },
    });

    // ─── Mutations ───────────────────────────────────────────────────────────

    const markAllRead = trpc.notification.markAllRead.useMutation({
        onMutate: () => {
            // [UX FIX] Optimistically sweep all caches to instantly remove read-dots without network flashing
            const updater = (old: InfiniteNotificationData | undefined) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map((p) => ({
                        ...p,
                        items: p.items.map((i) => ({ ...i, isRead: true }))
                    }))
                };
            };
            utils.notification.list.setInfiniteData({ limit: 20, typeFilter: undefined }, updater);
            utils.notification.list.setInfiniteData({ limit: 20, typeFilter: "uploads" }, updater);
            utils.notification.list.setInfiniteData({ limit: 20, typeFilter: "comments" }, updater);
            utils.notification.list.setInfiniteData({ limit: 20, typeFilter: "activity" }, updater);
            utils.notification.getUnreadCount.setData(undefined, 0);
        },
        onSuccess: () => {
            toast.success("All notifications marked as read", { duration: 2000 });
        },
    });

    const markRead = trpc.notification.markRead.useMutation();

    const deleteNotification = trpc.notification.delete.useMutation({
        onMutate: async ({ id }: { id: string }) => {
            // Optimistically remote from both views
            const updater = (old: InfiniteNotificationData | undefined) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        items: page.items.filter((item) => item.id !== id),
                    })),
                };
            };
            utils.notification.list.setInfiniteData({ limit: 20, typeFilter: undefined }, updater);
            if (activeTab !== "all") {
                utils.notification.list.setInfiniteData({ limit: 20, typeFilter: activeTab }, updater);
            }
        },
        onSuccess: () => {
            // [RELIABILITY FIX] Deleting an unread notification should clear the unread global badge
            utils.notification.getUnreadCount.invalidate();
        }
    });

    const updateNotificationLevel = trpc.channel.updateNotificationLevel.useMutation();

    // ─── Main-Thread Optimizations ────────────────────────────────────────────
    
    // [PERFORMANCE FIX] Prevent main thread freeze on frequent re-renders explicitly caching the flatmap
    const notifications = useMemo(() => {
        return data?.pages.flatMap((page) => page.items) || [];
    }, [data?.pages]);

    // ─── Intersection Observer ────────────────────────────────────────────────
    
    const { ref, inView } = useInView({
        threshold: 0,
        rootMargin: "400px",
    });

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    // ─── Handlers ─────────────────────────────────────────────────────────────

    const handleNotificationClick = (notification: NotificationItemData) => {
        if (!notification.isRead) {
            markRead.mutate({ id: notification.id });
            
            // [RELIABILITY FIX] Sweep *ALL* potentially cached tabs so we don't encounter "ghost" unreads
            const updater = (old: InfiniteNotificationData | undefined) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        items: page.items.map((item) =>
                            item.id === notification.id ? { ...item, isRead: true } : item,
                        ),
                    })),
                };
            };
            utils.notification.list.setInfiniteData({ limit: 20, typeFilter: undefined }, updater);
            utils.notification.list.setInfiniteData({ limit: 20, typeFilter: "uploads" }, updater);
            utils.notification.list.setInfiniteData({ limit: 20, typeFilter: "comments" }, updater);
            utils.notification.list.setInfiniteData({ limit: 20, typeFilter: "activity" }, updater);
            
            // Adjust unread global state atomically
            utils.notification.getUnreadCount.setData(undefined, (old: number | undefined) => Math.max(0, (old || 0) - 1));
        }
        if (notification.actionUrl) {
            router.push(notification.actionUrl);
        }
    };

    const handleDelete = (id: string) => deleteNotification.mutate({ id });

    const handleTurnOffChannel = (channelId: string) => {
        updateNotificationLevel.mutate({ channelId, level: "NONE" });
        toast.info("Notifications turned off for this channel");
    };

    // ─── UI Rendering ─────────────────────────────────────────────────────────

    return (
        <section className="w-full max-w-[1400px] mx-auto py-8 sm:px-4 lg:px-8 flex flex-col min-h-screen text-foreground relative pb-24 lg:pb-8">
            {/* Header Area */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8 shrink-0 px-4 sm:px-0">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight">
                        Notifications
                    </h1>
                    <p className="text-[15px] text-muted-foreground font-medium">
                        {isSettingsOpen
                            ? "Configure your notification preferences."
                            : "Stay updated on interactions, uploads, and account changes."}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!isSettingsOpen && (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="rounded-full shadow-sm hover:shadow-md transition-all gap-2 self-start sm:self-auto font-bold tracking-tight text-xs"
                            onClick={() => markAllRead.mutate()}
                            disabled={markAllRead.isPending || notifications.length === 0}
                        >
                            <IconCheck className="h-4 w-4" stroke={3} />
                            Mark all as read
                        </Button>
                    )}
                    <Button
                        variant={isSettingsOpen ? "default" : "secondary"}
                        size="icon"
                        className="rounded-full shadow-sm hover:shadow-md transition-all shrink-0"
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        title="Notification Settings"
                    >
                        <IconSettings className="h-4.5 w-4.5" stroke={2} />
                    </Button>
                </div>
            </header>

            {/* Navigation Tabs */}
            {!isSettingsOpen && (
                <nav
                    aria-label="Notification filters"
                    className="flex gap-2 mb-6 border-b border-border/80 pb-4 px-4 sm:px-0 overflow-x-auto scrollbar-hide shrink-0"
                >
                    {FILTER_TABS.map((tab) => {
                        const isActive = activeTab === tab.key;
                        return (
                            <Button
                                key={tab.key}
                                variant={isActive ? "default" : "secondary"}
                                size="sm"
                                className={cn(
                                    "rounded-full px-5 font-semibold transition-all shadow-sm shrink-0 text-xs tracking-tight",
                                    isActive
                                        ? "bg-foreground text-background shadow-md hover:bg-foreground/90 scale-105"
                                        : "bg-secondary hover:bg-muted text-muted-foreground",
                                )}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                {tab.label}
                            </Button>
                        );
                    })}
                </nav>
            )}

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto scrollbar-hide relative rounded-xl px-4 sm:px-0">
                {isSettingsOpen ? (
                    isLoadingSettings ? (
                        <div className="flex items-center justify-center p-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : initialSettings ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
                            <NotificationSettings settings={initialSettings} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-card/50 rounded-xl border border-border/40 min-h-[400px]">
                            <p className="text-lg font-bold tracking-tight text-foreground">
                                Settings Unavailable
                            </p>
                            <p className="text-sm">Please refresh the page or try again later.</p>
                        </div>
                    )
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center bg-destructive/10 rounded-2xl border border-dashed border-destructive/30">
                        <IconBell className="h-10 w-10 text-destructive/50 mb-6" />
                        <h3 className="text-xl font-black tracking-tight mb-2 text-destructive">Failed to load feed</h3>
                        <p className="text-sm text-muted-foreground font-medium">Please check your connection and try again.</p>
                        <Button variant="outline" className="mt-4 rounded-full" onClick={() => fetchNextPage()}>Retry</Button>
                    </div>
                ) : isLoading ? (
                    <div className="space-y-3 max-w-3xl">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-24 bg-secondary/40 rounded-xl animate-pulse border border-border/10"
                            />
                        ))}
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center bg-card/30 rounded-2xl border border-dashed border-border/60 max-w-3xl">
                        <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center shadow-inner">
                            <IconBell
                                className="h-10 w-10 text-muted-foreground/40"
                                stroke={1.5}
                            />
                        </div>
                        <h3 className="text-xl font-black tracking-tight mb-2">
                            You&apos;re all caught up!
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-[260px] mx-auto font-medium">
                            When people mention you, upload new videos, or
                            interact with your content, it will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 relative max-w-3xl">
                        {notifications.map((notification: NotificationItemData, idx: number) => (
                            <div
                                key={notification.id}
                                className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                                style={{
                                    animationDelay: `${Math.min(idx, 15) * 40}ms`,
                                    animationDuration: "400ms",
                                }}
                            >
                                <NotificationItem
                                    notification={notification}
                                    onClick={handleNotificationClick}
                                    onDelete={handleDelete}
                                    onTurnOff={handleTurnOffChannel}
                                />
                            </div>
                        ))}

                        {hasNextPage && (
                            <div
                                ref={ref}
                                className="flex justify-center pt-8 pb-4"
                            >
                                <Button
                                    variant="secondary"
                                    onClick={() => fetchNextPage()}
                                    disabled={isFetchingNextPage}
                                    className="w-full max-w-[240px] rounded-full font-bold shadow-sm hover:shadow-md transition-all text-xs tracking-tight"
                                >
                                    {isFetchingNextPage
                                        ? "Loading older notifications..."
                                        : "Load Older"}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
