"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle } from "@tabler/icons-react";

export default function AppError({
    error,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("App Boundary Error:", error);
    }, [error]);

    const isNotFound =
        error?.message?.includes("NOT_FOUND") ||
        error?.message?.includes("not found");

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
            <IconAlertTriangle className="h-16 w-16 text-muted-foreground mb-4 opacity-20" />
            <h1 className="text-2xl font-semibold mb-2">
                {isNotFound ? "Content Not Available" : "Something went wrong"}
            </h1>
            <p className="text-muted-foreground mb-6 max-w-md">
                {isNotFound
                    ? "This video or channel may have been removed, made private, or no longer exists."
                    : "An unexpected error occurred while trying to load this page. Please try again."}
            </p>
            <div className="flex gap-4">
                <Button onClick={() => window.history.back()} variant="outline">
                    Go Back
                </Button>
                <Button onClick={() => (window.location.href = "/")}>
                    Go Home
                </Button>
            </div>
        </div>
    );
}
