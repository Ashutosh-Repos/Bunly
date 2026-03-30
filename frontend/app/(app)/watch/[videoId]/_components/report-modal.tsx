"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconFlag } from "@tabler/icons-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const REPORT_REASONS = [
    { value: "SEXUAL_CONTENT", label: "Sexual content" },
    { value: "VIOLENCE", label: "Violent or repulsive content" },
    { value: "HATE_SPEECH", label: "Hateful or abusive content" },
    { value: "HARASSMENT", label: "Harassment or bullying" },
    { value: "MISINFORMATION", label: "Misinformation" },
    { value: "SPAM", label: "Spam or misleading" },
    { value: "COPYRIGHT", label: "Infringes my rights" },
    { value: "IMPERSONATION", label: "Impersonation" },
] as const;

type ReportReason = typeof REPORT_REASONS[number]["value"];

export function ReportVideoModal({ videoId }: { videoId: string }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState<ReportReason | null>(null);
    const [description, setDescription] = useState("");

    const reportMutation = trpc.report.submit.useMutation({
        onSuccess: () => {
            toast.success("Report submitted successfully. Thanks for keeping Bunly safe.");
            setOpen(false);
            setReason(null);
            setDescription("");
        },
        onError: (err) => {
            toast.error("Failed to submit report: " + err.message);
        }
    });

    const handleSubmit = () => {
        if (!reason) return;
        reportMutation.mutate({
            videoId,
            reason,
            description: description.trim() || undefined,
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="rounded-full shadow-none hover:bg-muted/80 px-3 w-10 p-0 text-muted-foreground">
                    <IconFlag size={18} />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Report video</DialogTitle>
                    <DialogDescription>
                        If you see content that violates our community guidelines, please report it.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-4">
                        {REPORT_REASONS.map((r) => (
                            <div key={r.value} className="flex items-center space-x-3 cursor-pointer" onClick={() => setReason(r.value)}>
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${reason === r.value ? 'border-primary' : 'border-muted-foreground/30'}`}>
                                    {reason === r.value && <div className="w-2 h-2 bg-primary rounded-full" />}
                                </div>
                                <Label className="text-sm font-medium leading-none cursor-pointer">
                                    {r.label}
                                </Label>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4">
                        <Label htmlFor="description" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Additional Details (Optional)
                        </Label>
                        <Textarea
                            id="description"
                            placeholder="Provide any additional context that could help us investigate..."
                            className="resize-none"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={!reason || reportMutation.isPending}
                    >
                        {reportMutation.isPending ? "Reporting..." : "Report"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
