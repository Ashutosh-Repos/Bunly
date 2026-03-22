"use client";

import { useMemo, useEffect, useCallback, useState } from "react";
import { isToday, isYesterday } from "date-fns";
import { IconTrash, IconLoader2, IconHistory } from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc-client";
import { HistoryItem, type HistoryItemData } from "./history-item";

interface HistoryClientProps {
    initialData: {
        items: HistoryItemData[];
        // nextCursor is undefined (not null) — backend cursor is z.string().optional()
        nextCursor?: string | undefined;
    };
}



export function HistoryClient({ initialData }: HistoryClientProps) {
    const utils = trpc.useUtils();
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
    } = trpc.history.getHistory.useInfiniteQuery(
        { limit: 20 },
        {
            initialData: {
                pages: [initialData],
                // Use `undefined` (not `null`) to match the TRPC cursor type: z.string().optional()
                pageParams: [undefined],
            },
            getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        },
    );

    const removeFromHistory = trpc.history.removeFromHistory.useMutation({
        onMutate: async ({ videoId }) => {
            // Cancel outgoing refetches so they won't overwrite the optimistic update
            await utils.history.getHistory.cancel();

            // Optimistic deletion — strip the removed item from every cached page
            utils.history.getHistory.setInfiniteData({ limit: 20 }, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        items: page.items.filter(
                            (item: HistoryItemData) => item.videoId !== videoId,
                        ),
                    })),
                };
            });
        },
        onSuccess: () => {
            toast.success("Removed from watch history", { duration: 2000 });
        },
        onError: () => {
            toast.error("Failed to remove video");
            // Rollback by re-fetching the source of truth
            utils.history.getHistory.invalidate();
        },
    });

    const clearHistory = trpc.history.clearHistory.useMutation({
        onMutate: async () => {
            await utils.history.getHistory.cancel();

            // Optimistic clear — wipe every page's items so the empty state renders instantly
            utils.history.getHistory.setInfiniteData({ limit: 20 }, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: [{ items: [], nextCursor: undefined }],
                    // react-query's InfiniteData<any, string|null> requires (string|null)[] here
                    pageParams: [null] as (string | null)[],
                };
            });
        },
        onSuccess: () => {
            toast.success("Watch history cleared", { duration: 2000 });
            utils.history.getHistory.invalidate();
        },
        onError: () => {
            toast.error("Failed to clear history");
            utils.history.getHistory.invalidate();
        },
    });

    // ─── Intersection Observer ────────────────────────────────────────────────

    const { ref, inView } = useInView({ threshold: 0, rootMargin: "400px" });

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, fetchNextPage, isFetchingNextPage]);

    // ─── Grouping Logic ───────────────────────────────────────────────────────

    const groupedHistory = useMemo(() => {
        if (!data) return [];
        const today: HistoryItemData[] = [];
        const yesterday: HistoryItemData[] = [];
        const older: HistoryItemData[] = [];

        data.pages.forEach((page: { items: HistoryItemData[]; nextCursor?: string | null }) => {
            page.items.forEach((item: HistoryItemData) => {
                const date = new Date(item.lastWatchedAt);
                if (isToday(date)) today.push(item);
                else if (isYesterday(date)) yesterday.push(item);
                else older.push(item);
            });
        });

        const groups = [];
        if (today.length) groups.push({ title: "Today", items: today });
        if (yesterday.length) groups.push({ title: "Yesterday", items: yesterday });
        if (older.length) groups.push({ title: "Older", items: older });

        return groups;
    }, [data]);

    // [PERFORMANCE FIX] Memoized handler prevents a new function reference on every render
    // which would bust React.memo inside HistoryItem and defeat the purpose of memoization
    const handleRemove = useCallback(
        (videoId: string) => removeFromHistory.mutate({ videoId }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [removeFromHistory.mutate],
    );

    if (isError) {
        return (
            <div className="w-full h-[50vh] flex flex-col items-center justify-center gap-3">
                <p className="text-destructive font-bold text-lg tracking-tight">
                    Failed to load watch history.
                </p>
                <Button
                    variant="outline"
                    onClick={() => utils.history.getHistory.invalidate()}
                >
                    Try again
                </Button>
            </div>
        );
    }

    const isEmpty = groupedHistory.length === 0;

    if (isLoading && isEmpty) {
        return (
            <div className="w-full flex justify-center py-32">
                <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
            </div>
        );
    }

    return (
        <section className="w-full max-w-[1000px] mx-auto py-8 sm:px-4 lg:px-8 flex flex-col min-h-screen text-foreground relative pb-24 lg:pb-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-10 shrink-0 px-4 sm:px-0">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight">Watch History</h1>
                    <p className="text-[15px] text-muted-foreground font-medium">
                        Manage your past video activity and resume watching seamlessly.
                    </p>
                </div>

                {/* [FIX] use AlertDialog instead of browser-native confirm() which blocks the main thread */}
                {!isEmpty && (
                    <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="rounded-full shadow-sm hover:shadow-md transition-all gap-2 self-start sm:self-auto font-bold tracking-tight text-xs"
                                disabled={clearHistory.isPending || isLoading}
                            >
                                {clearHistory.isPending ? (
                                    <IconLoader2 className="h-4 w-4 animate-spin" stroke={3} />
                                ) : (
                                    <IconTrash className="h-4 w-4" stroke={3} />
                                )}
                                Clear all history
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Clear watch history?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently remove all videos from your watch history. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => {
                                        setConfirmClearOpen(false);
                                        clearHistory.mutate();
                                    }}
                                >
                                    Clear history
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </header>

            {isEmpty ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center bg-card/30 rounded-2xl border border-dashed border-border/60 max-w-2xl mx-auto px-6 w-full animate-in fade-in duration-700">
                    <div className="h-24 w-24 bg-secondary/50 rounded-full flex items-center justify-center shadow-inner mb-6">
                        <IconHistory className="h-10 w-10 text-muted-foreground/40" stroke={1.5} />
                    </div>
                    <h3 className="text-xl font-black text-foreground mb-2 tracking-tight">
                        No watch history
                    </h3>
                    <p className="text-muted-foreground/80 font-medium leading-relaxed max-w-[260px]">
                        Videos you watch will show up here.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-10 px-4 sm:px-0">
                    {groupedHistory.map((group) => (
                        <div key={group.title} className="flex flex-col gap-5">
                            <h2 className="text-[17px] font-black tracking-tight text-foreground/90 pl-1">
                                {group.title}
                            </h2>
                            <div className="flex flex-col gap-1">
                                {group.items.map((item) => (
                                    <HistoryItem
                                        // [FIX] Use `item.id` as the stable key — it's the PK of watch_history
                                        // `lastWatchedAt.toString()` is not stable across Date/string representations
                                        key={item.id}
                                        item={item}
                                        onRemove={handleRemove}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Infinite Scroll trigger sentinel */}
                    {hasNextPage && (
                        <div ref={ref} className="h-20 w-full flex items-center justify-center">
                            {isFetchingNextPage ? (
                                <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
                            ) : (
                                <div className="h-2 w-2 bg-foreground/20 rounded-full animate-pulse" />
                            )}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
