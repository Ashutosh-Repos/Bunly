"use client";

import { Suspense } from "react";
import { SubscriptionsClient } from "./_components/subscriptions-client";

export default function SubscriptionsPage() {
    return (
        <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[1600px] mx-auto w-full min-h-[calc(100vh-80px)]">
            <h1 className="text-2xl font-bold tracking-tight mb-2">Subscriptions</h1>
            <Suspense fallback={
                <div className="flex justify-center items-center min-h-[50vh]">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            }>
                <SubscriptionsClient />
            </Suspense>
        </div>
    );
}
