import { Metadata } from "next";
import { cache } from "react";
import WatchClientPage from "./watch-client";
import { getTrpcServer } from "@/lib/trpc-server";

type Props = {
    params: Promise<{ videoId: string }>;
};

/**
 * Shared, cached fetcher for the video data on the server.
 * Next.js automatically deduplicates this across generateMetadata and the Page component.
 */
const getVideo = cache(async (videoId: string) => {
    const trpc = await getTrpcServer();
    try {
        return await trpc.video.getPublicVideo.query({ videoId });
    } catch (err) {
        console.error("Failed to pre-fetch video data:", err);
        return null;
    }
});

/**
 * Server-side metadata fetcher for YouTube-style rich embeds on Discord/Twitter/iMessage.
 */
export async function generateMetadata(
    { params }: Props,
): Promise<Metadata> {
    const { videoId } = await params;
    const video = await getVideo(videoId);

    if (!video) {
        return { title: "Video Not Found - Bunly" };
    }

    const titleText = `${video.title} - ${video.author?.name || "Bunly"}`;
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
            creator: video.author?.handle ? `@${video.author.handle}` : undefined,
        },
    };
}

/**
 * SSR Page Component.
 * Fetches the primary video data on the server and passes it to the interactive client tier.
 */
export default async function Page({ params }: Props) {
    const { videoId } = await params;
    const initialVideoData = await getVideo(videoId);

    return <WatchClientPage videoId={videoId} initialVideoData={initialVideoData || undefined} />;
}
