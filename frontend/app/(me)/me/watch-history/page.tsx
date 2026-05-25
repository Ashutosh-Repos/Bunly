import type { Metadata } from "next";
import { HistoryClient } from "./_components/history-client";

import { getTrpcServer } from "@/lib/trpc-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Watch History - Bunly",
    description: "View and manage your watch history",
};

export default async function HistoryPage() {
    const trpc = await getTrpcServer();
    const initialData = await trpc.history.getHistory.query({ limit: 20 });
    return <HistoryClient initialData={initialData} />;
}
