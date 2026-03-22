"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc-client";
import { PlaylistClient } from "./_components/playlist-client";

export default function PlaylistPage({ params }: { params: Promise<{ playlistId: string }> }) {
    const { playlistId } = use(params);

    const { data, isLoading, error } = trpc.playlist.getPlaylistFlow.useQuery(
        { playlistId },
        { retry: false }
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <h1 className="text-2xl font-bold">Playlist unavailable</h1>
                <p className="text-muted-foreground">
                    {error?.message || "This playlist does not exist or is private."}
                </p>
            </div>
        );
    }

    return (
        data ? (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <PlaylistClient playlist={data as any} />
        ) : null
    );
}
