import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchClient } from "./_components/search-client";
import { IconLoader2 } from "@tabler/icons-react";
import { getTrpcServer } from "@/lib/trpc-server";

export const dynamic = "force-dynamic";

type Props = {
    searchParams: Promise<{ q?: string; type?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
    const { q } = await searchParams;
    return {
        title: q ? `${q} - Search - Bunly` : "Search - Bunly",
        description: q ? `Search results for "${q}" on Bunly.` : "Search for videos, channels, and playlists.",
    };
}

export default async function SearchPage({ searchParams }: Props) {
    const { q } = await searchParams;
    const query = q || "";
    
    let initialSearchData = null;
    
    if (query) {
        const trpc = await getTrpcServer();
        // Fetch first page of search results server-side
        // Note: Filter is hardcoded to "ALL" for initial server render to ensure instant UI
        initialSearchData = await trpc.search.globalSearch.query({ 
            query, 
            filter: "ALL",
            limit: 20 
        });
    }

    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[50vh]">
                <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        }>
            <SearchClient initialSearchData={initialSearchData} />
        </Suspense>
    );
}
