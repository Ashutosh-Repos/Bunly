import type { Metadata } from "next";
import { ShortsClient } from "./_components/shorts-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Bunly Shorts",
    description: "Watch bite-sized vertical videos seamlessly.",
};

export default function ShortsPage() {
    return <ShortsClient />;
}
