"use client";

import { createContext, useContext, ReactNode } from "react";

export interface Channel {
    id: string;
    name: string;
    handle: string;
    image: string | null;
    subscriberCount: number;
    videoCount: number;
    totalViews: number;
}

interface StudioContextValue {
    channel: Channel;
    allChannels: Channel[];
}

const StudioContext = createContext<StudioContextValue | undefined>(undefined);

export function StudioProvider({
    channel,
    allChannels,
    children,
}: {
    channel: Channel;
    allChannels: Channel[];
    children: ReactNode;
}) {
    return (
        <StudioContext.Provider value={{ channel, allChannels }}>
            {children}
        </StudioContext.Provider>
    );
}

export function useStudio() {
    const context = useContext(StudioContext);
    if (context === undefined) {
        throw new Error("useStudio must be used within a StudioProvider");
    }
    return context;
}

export function useOptionalStudio() {
    return useContext(StudioContext);
}
