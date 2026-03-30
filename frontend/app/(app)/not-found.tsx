import { Button } from "@/components/ui/button";
import { IconGhost } from "@tabler/icons-react";
import Link from "next/link";

export default function AppNotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
            <IconGhost className="h-16 w-16 text-muted-foreground mb-4 opacity-20" />
            <h1 className="text-2xl font-semibold mb-2">
                This page isn&apos;t available.
            </h1>
            <p className="text-muted-foreground mb-6 max-w-md">
                Sorry about that. Try searching for something else or return to the homepage.
            </p>
            <div className="flex gap-4">
                <Link href="/">
                    <Button variant="default">Go Home</Button>
                </Link>
            </div>
        </div>
    );
}
