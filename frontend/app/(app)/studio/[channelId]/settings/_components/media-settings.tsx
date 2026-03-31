"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IconPhotoEdit, IconCamera } from "@tabler/icons-react";

import { trpc } from "@/lib/trpc-client";
import ImageUpload from "@/components/custom/image-uploader";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { RouterOutputs } from "@/lib/trpc-client";
import { Badge } from "@/components/ui/badge";

interface MediaSettingsProps {
    initialData: NonNullable<RouterOutputs["channel"]["getChannelById"]>["channel"];
}

export function MediaSettings({ initialData }: MediaSettingsProps) {
    const utils = trpc.useUtils();
    
    const [avatar, setAvatar] = useState(initialData.image || "");
    const [prevAvatarProp, setPrevAvatarProp] = useState(initialData.image);

    if (initialData.image !== prevAvatarProp) {
        setPrevAvatarProp(initialData.image);
        setAvatar(initialData.image || "");
    }

    const [banner, setBanner] = useState(initialData.bannerUrl || "");
    const [prevBannerProp, setPrevBannerProp] = useState(initialData.bannerUrl);

    if (initialData.bannerUrl !== prevBannerProp) {
        setPrevBannerProp(initialData.bannerUrl);
        setBanner(initialData.bannerUrl || "");
    }

    const updateChannelMutation = trpc.channel.updateChannel.useMutation({
        onSuccess: async () => {
            toast.success("Media settings updated");
            
            // Dual-Strike Invalidation
            await Promise.all([
                utils.channel.getChannelById.invalidate({ channelId: initialData.id }),
                utils.channel.getUserChannels.invalidate(),
            ]);
        },
    });

    const handleAvatarUpdate = async (url: string) => {
        const oldAvatar = avatar;
        setAvatar(url); // Optimistic UI Update

        try {
            await updateChannelMutation.mutateAsync({
                channelId: initialData.id,
                image: url === "" ? undefined : url, // Zod coerces natively, but undefined helps Prisma partials skip
            });
        } catch {
            setAvatar(oldAvatar); // Reliable Rollback
            toast.error("Failed to commit Avatar to the database.");
        }
    };

    const handleBannerUpdate = async (url: string) => {
        const oldBanner = banner;
        setBanner(url); // Optimistic UI Update

        try {
            await updateChannelMutation.mutateAsync({
                channelId: initialData.id,
                bannerUrl: url === "" ? undefined : url, 
            });
        } catch {
            setBanner(oldBanner); // Reliable Rollback
            toast.error("Failed to commit Banner to the database.");
        }
    };

    const isPending = updateChannelMutation.isPending;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Channel Branding</CardTitle>
                        <CardDescription>
                            Your avatar and banner represent you everywhere on the platform.
                        </CardDescription>
                    </div>
                    {isPending && <Badge variant="secondary" className="animate-pulse">Syncing...</Badge>}
                </div>
            </CardHeader>
            <CardContent className="space-y-8">
                
                {/* Banner Section */}
                <div className="space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                        <IconPhotoEdit className="w-4 h-4 text-muted-foreground" />
                        Channel Banner
                    </h4>
                    <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-border">
                        <ImageUpload
                            value={banner}
                            onChange={(url: string) => handleBannerUpdate(url)}
                            disabled={isPending}
                            variant="overlay"
                            type="banner"
                            priority={true}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground w-full max-w-2xl">
                        For the best results on all devices, use an image that&apos;s at least 2048 x 1152 pixels and 6MB or less.
                    </p>
                </div>

                {/* Avatar Section */}
                <div className="space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                        <IconCamera className="w-4 h-4 text-muted-foreground" />
                        Profile Picture
                    </h4>
                    <div className="w-40 h-40 overflow-hidden rounded-full border border-border">
                        <ImageUpload
                            value={avatar}
                            onChange={(url: string) => handleAvatarUpdate(url)}
                            disabled={isPending}
                            variant="overlay"
                            type="avatar"
                            priority={true}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground max-w-sm">
                        It&apos;s recommended to use a picture that&apos;s at least 98 x 98 pixels and 4MB or less.
                    </p>
                </div>

            </CardContent>
        </Card>
    );
}
