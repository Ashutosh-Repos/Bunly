import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchClient } from "./_components/search-client";
import { IconLoader2 } from "@tabler/icons-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Bunly - Search",
    description: "Search for videos, channels, and playlists.",
};

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[50vh]">
                <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        }>
            <SearchClient />
        </Suspense>
    );
}
