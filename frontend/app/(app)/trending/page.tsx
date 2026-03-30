import type { Metadata } from "next";
import { FeedClient } from "../_components/feed-client";
import { getTrpcServer } from "@/lib/trpc-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Trending - Bunly",
    description: "See what's trending now on Bunly. Discover the most popular videos from across the platform.",
};

export default async function TrendingPage() {
    const trpc = await getTrpcServer();
    const initialTrendingFeed = await trpc.feed.getTrendingFeed.query({});
    return <FeedClient initialData={initialTrendingFeed} type="trending" />;
}
