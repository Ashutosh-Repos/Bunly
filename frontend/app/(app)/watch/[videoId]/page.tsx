import { Metadata } from "next";
import WatchClientPage from "./watch-client";

type Props = {
    params: Promise<{ videoId: string }>;
};

/**
 * Server-side metadata fetcher for YouTube-style rich embeds on Discord/Twitter/iMessage.
 * This intercepts the route on the server and generates SSR HTML <meta> tags before hydrating the client-side TRPC interface.
 */
export async function generateMetadata(
    { params }: Props,
): Promise<Metadata> {
    const { videoId } = await params;

    try {
        // Call the backend TRPC public video query directly via HTTP GET.
        const inputStr = encodeURIComponent(JSON.stringify({ json: { videoId } }));
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        
        const res = await fetch(`${apiUrl}/api/trpc/video.getPublicVideo?input=${inputStr}`, {
            next: { revalidate: 60 }, // Cache on edge for 60s
        });

        if (!res.ok) {
            return { title: "Video Unavailable" };
        }

        const data = await res.json();
        const video = data?.result?.data?.json;

        if (!video) {
            return { title: "Video Not Found" };
        }

        const titleText = `${video.title} - ${video.channels?.name || "Bunly"}`;
        const descText = video.description?.substring(0, 160) || `Watch ${video.title} on Bunly`;

        return {
            title: titleText,
            description: descText,
            openGraph: {
                title: titleText,
                description: descText,
                images: video.thumbnailUrl ? [video.thumbnailUrl] : [],
                type: "video.other",
            },
            twitter: {
                card: "summary_large_image",
                title: titleText,
                description: descText,
                images: video.thumbnailUrl ? [video.thumbnailUrl] : [],
                creator: video.channels?.handle ? `@${video.channels.handle}` : undefined,
            },
        };
    } catch {
        return {
            title: "Watch on Bunly",
        };
    }
}

/**
 * SSR Page Component.
 * Just passes the `params` promise down to the interactive client tier which resolves it using `use()`.
 */
export default function Page({ params }: Props) {
    return <WatchClientPage params={params} />;
}
