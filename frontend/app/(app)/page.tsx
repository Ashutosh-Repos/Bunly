import type { Metadata } from "next";
import { FeedClient } from "./_components/feed-client";
import { getTrpcServer } from "@/lib/trpc-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Bunly - Home",
    description: "Welcome back to Bunly. Watch, share, and enjoy videos.",
};

export default async function HomePage() {
    const trpc = await getTrpcServer();
    const initialHomeFeed = await trpc.feed.getHomeFeed.query({});
    return <FeedClient initialData={initialHomeFeed} type="home" />;
}
