import { VideoGrid } from "@/components/custom/video-grid";

/**
 * Route-level loading skeleton for the search page.
 * Shows during server-side search result fetching.
 */
export default function SearchLoading() {
    return (
        <div className="w-full max-w-[1400px] mx-auto p-4 sm:p-8 space-y-8 animate-pulse">
            <div className="h-8 bg-muted/40 rounded-lg w-64 mb-8" />
            <div className="flex gap-2 flex-wrap mb-4">
                <div className="h-8 w-14 bg-muted/40 rounded-lg" />
                <div className="h-8 w-20 bg-muted/40 rounded-lg" />
                <div className="h-8 w-24 bg-muted/40 rounded-lg" />
            </div>
            <VideoGrid isLoading={true} />
        </div>
    );
}
