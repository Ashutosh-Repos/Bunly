import type { Metadata } from "next";
import { HomeClient } from "./_components/home-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Bunly - Home",
    description: "Welcome back to Bunly. Watch, share, and enjoy videos.",
};

export default function HomePage() {
    return <HomeClient />;
}
