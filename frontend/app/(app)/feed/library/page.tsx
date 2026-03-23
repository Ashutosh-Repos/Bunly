import type { Metadata } from "next";
import { LibraryClient } from "./_components/library-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Bunly - Library",
    description: "Your watch history, liked videos, and playlists.",
};

export default function LibraryPage() {
    return <LibraryClient />;
}
