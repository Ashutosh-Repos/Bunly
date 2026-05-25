"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";

import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

export function DangerZone({ channelId }: { channelId: string }) {
    const router = useRouter();
    const utils = trpc.useUtils();
    const [confirmText, setConfirmText] = useState("");
    const [open, setOpen] = useState(false);

    const deleteMutation = trpc.channel.deleteChannel.useMutation({
        onSuccess: async () => {
            toast.success("Channel successfully suspended and scheduled for deletion");
            
            // Hard invalidation to purge the channel from the navigation Sidebar globally
            await utils.channel.getUserChannels.invalidate();
            
            // Force route out of the deleted territory
            router.push("/studio");
        },
        onError: (error) => {
            toast.error(error.message || "Failed to suspend network");
        },
    });

    const isConfirmed = confirmText.toLowerCase() === "delete my channel";
    const isPending = deleteMutation.isPending;

    return (
        <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader>
                <CardTitle className="text-red-500 flex items-center gap-2">
                    <IconAlertTriangle className="w-5 h-5" />
                    Danger Zone
                </CardTitle>
                <CardDescription>
                    Irreversible actions that will permanently mutate or destroy your channel records.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-red-500/20 bg-background">
                    <div className="space-y-1">
                        <h4 className="font-medium">Suspend & Delete Channel</h4>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            Once you delete your channel, your videos, analytics, and metadata will be permanently suspended from the public network.
                        </p>
                    </div>

                    <AlertDialog open={open} onOpenChange={setOpen}>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="shrink-0">
                                Delete Channel
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action will immediately restrict public access, remove you from the Studio Navbar, and enqueue your S3 network artifacts for bulk deletion. 
                                </AlertDialogDescription>
                            </AlertDialogHeader>

                            <div className="my-4 space-y-2">
                                <p className="text-sm font-medium">
                                    Please type <span className="text-red-500 font-bold select-all">delete my channel</span> to confirm.
                                </p>
                                <Input
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder="delete my channel"
                                />
                            </div>

                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isPending} onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    disabled={!isConfirmed || isPending}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        deleteMutation.mutate({ channelId });
                                    }}
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    {isPending ? (
                                        <IconLoader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        "Confirm Suspension"
                                    )}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    );
}
