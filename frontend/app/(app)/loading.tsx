import { VideoGrid } from "@/components/custom/video-grid";

/**
 * Route-level loading skeleton for the home page.
 * Shows immediately during server-side data fetching on navigation.
 */
export default function HomeLoading() {
    return (
        <div className="flex flex-col w-full pb-20">
            <div className="pt-4 px-4 sm:px-8">
                <VideoGrid isLoading={true} />
            </div>
        </div>
    );
}
