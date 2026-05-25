"use client";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useState } from "react";
import { IconBellRinging } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc-client";

export interface NotificationSettingsType {
    newVideos: boolean;
    liveStreams: boolean;
    comments: boolean;
    replies: boolean;
    likes: boolean;
    subscribers: boolean;
}

interface NotificationFormProps {
    settings: NotificationSettingsType;
}

export function NotificationSettings({
    settings: initialSettings,
}: NotificationFormProps) {
    const [settings, setSettings] = useState(initialSettings);
    const utils = trpc.useUtils();

    const updateSettings = trpc.notification.updateSettings.useMutation({
        onMutate: async (newVar: Partial<NotificationSettingsType>) => {
            // Cancel outgoing refetches
            await utils.notification.getSettings.cancel();
            
            // Snapshot previous value
            const previousSettings = utils.notification.getSettings.getData();
            
            // Optimistic update of trpc cache
            utils.notification.getSettings.setData(undefined, (old: NotificationSettingsType | undefined) => {
                if (!old) return old;
                return { ...old, ...newVar };
            });

            return { previousSettings };
        },
        onError: (_err, newVar, context) => {
            // Revert optimistic local state on failure
            setSettings((prev) => {
                const reverted = { ...prev };
                for (const key of Object.keys(newVar) as Array<keyof NotificationSettingsType>) {
                    if (newVar[key] !== undefined) {
                        reverted[key] = !newVar[key];
                    }
                }
                return reverted;
            });
            // Revert TRPC cache
            if (context?.previousSettings) {
                utils.notification.getSettings.setData(undefined, context.previousSettings);
            }
            toast.error("Failed to update preferences");
        },
        onSuccess: () => {
            toast.success("Preferences saved successfully", {
                duration: 2000,
            });
        }
    });

    const handleToggle = (key: keyof NotificationSettingsType) => {
        const newValue = !settings[key];
        
        // Instant local optimistic update for snappiness
        setSettings((prev) => ({ ...prev, [key]: newValue }));
        
        // Fire TRPC mutation
        updateSettings.mutate({ [key]: newValue });
    };

    return (
        <div className="w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-card/40 border-border shadow-sm overflow-hidden rounded-xl">
                <CardHeader className="border-b border-border/40 bg-secondary/30 px-6 py-5">
                    <CardTitle className="flex items-center gap-2.5 text-lg font-black tracking-tight text-foreground">
                        <IconBellRinging
                            className="h-6 w-6 text-foreground"
                            stroke={2}
                        />
                        Activity Preferences
                    </CardTitle>
                    <CardDescription className="text-[15px] text-muted-foreground font-medium mt-1.5">
                        Select which interactions trigger a notification in your feed.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="flex flex-col">
                        {[
                            {
                                id: "newVideos",
                                label: "New Videos",
                                desc: "When channels you follow upload content.",
                            },
                            {
                                id: "liveStreams",
                                label: "Live Streams",
                                desc: "When channels you follow go live.",
                            },
                            {
                                id: "subscribers",
                                label: "New Subscribers",
                                desc: "When someone subscribes to your channel.",
                            },
                            {
                                id: "comments",
                                label: "Comments",
                                desc: "When someone comments on your videos.",
                            },
                            {
                                id: "replies",
                                label: "Replies",
                                desc: "When someone replies to your comments.",
                            },
                            {
                                id: "likes",
                                label: "Likes",
                                desc: "When someone likes your video or comment.",
                            },
                        ].map((item, idx) => (
                            <div
                                key={item.id}
                                className={cn(
                                    "flex items-center justify-between p-6 hover:bg-secondary/40 transition-colors group",
                                    idx !== 0 && "border-t border-border/40",
                                )}
                            >
                                <div className="flex flex-col gap-1 pr-6 flex-1">
                                    <Label
                                        htmlFor={item.id}
                                        className="text-[15px] font-bold cursor-pointer select-none group-hover:text-primary transition-colors"
                                    >
                                        {item.label}
                                    </Label>
                                    <p className="text-sm text-muted-foreground font-medium select-none">
                                        {item.desc}
                                    </p>
                                </div>
                                <Switch
                                    id={item.id}
                                    checked={
                                        settings[
                                            item.id as keyof NotificationSettingsType
                                        ] as boolean
                                    }
                                    onCheckedChange={() =>
                                        handleToggle(
                                            item.id as keyof NotificationSettingsType,
                                        )
                                    }
                                    className="data-[state=checked]:bg-foreground shrink-0"
                                />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
