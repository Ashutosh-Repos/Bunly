"use client";

import { useState, useEffect } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUpload } from "@/components/providers/upload-provider";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { DetailsStep } from "./steps/details-step";
import { ElementsStep } from "./steps/elements-step";
import { VisibilityStep } from "./steps/visibility-step";
import { toast } from "sonner";
import { IconChevronLeft, IconChevronRight, IconLoader2, IconX, IconCheck, IconExternalLink } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const editorSchema = z.object({
    title: z.string().min(1, "Title is required").max(100, "Title cannot exceed 100 characters"),
    description: z.string().max(5000).optional(),
    thumbnailUrl: z.string().optional(),
    tags: z.array(z.string()).optional(),
    categoryId: z.string().nullable().optional(),
    isAgeRestricted: z.boolean().optional(),
    allowComments: z.boolean().optional(),
    allowEmbedding: z.boolean().optional(),
    chapters: z.array(z.object({
        title: z.string().min(1).max(200),
        startTime: z.number().min(0),
    })).optional(),
    visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED", "SCHEDULED"]).optional(),
    scheduledAt: z.date().nullable().optional(),
}).refine(data => {
    if (data.visibility === "SCHEDULED" && !data.scheduledAt) {
        return false;
    }
    return true;
}, {
    message: "Schedule date is required",
    path: ["scheduledAt"]
});

type EditorFormValues = z.infer<typeof editorSchema>;

const STEPS = ["Details", "Video Elements", "Visibility"];

export interface UploadEditorProps {
    idOverride?: string;
    standalone?: boolean;
}

export function UploadEditor({ idOverride, standalone = false }: UploadEditorProps) {
    const { videoId: ctxVideoId, closeModal, engine } = useUpload();
    const utils = trpc.useUtils();
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [saveIndicator, setSaveIndicator] = useState<"idle" | "saving" | "saved">("idle");
    const router = useRouter();

    const videoId = idOverride || ctxVideoId;

    const { data: videoData, isLoading } = trpc.video.getVideo.useQuery(
        { videoId: videoId as string },
        { enabled: !!videoId }
    );

    const updateMutation = trpc.video.updateVideo.useMutation({
        onSuccess: () => {
            setSaveIndicator("saved");
            setTimeout(() => setSaveIndicator("idle"), 2000);
        },
        onError: () => {
            setSaveIndicator("idle");
        }
    });

    const methods = useForm<EditorFormValues>({
        resolver: zodResolver(editorSchema),
        defaultValues: {
            title: engine?.file.name.replace(/\.[^/.]+$/, "").substring(0, 100) || "",
            description: "",
            visibility: "PRIVATE",
            tags: [],
            chapters: [],
            isAgeRestricted: false,
            allowComments: true,
            allowEmbedding: true,
        }
    });

    // Hydrate form when DB data loads
    useEffect(() => {
        if (videoData) {
            methods.reset({
                title: videoData.title || "",
                description: videoData.description || "",
                visibility: videoData.visibility as "PRIVATE" | "PUBLIC" | "UNLISTED" | "SCHEDULED",
                scheduledAt: videoData.scheduledAt ? new Date(videoData.scheduledAt) : undefined,
                categoryId: videoData.categoryId,
                tags: videoData.tags?.map(t => t.name) || [],
                chapters: videoData.chapters?.map(c => ({ title: c.title, startTime: c.startTime })) || [],
                thumbnailUrl: videoData.thumbnailUrl || undefined,
                isAgeRestricted: videoData.isAgeRestricted,
                allowComments: videoData.allowComments,
                allowEmbedding: videoData.allowEmbedding,
            });
        }
    }, [videoData, methods]);

    const saveCurrentStep = () => {
        if (!videoId) return;
        setSaveIndicator("saving");
        updateMutation.mutate({
            videoId,
            title: methods.getValues("title"),
            description: methods.getValues("description"),
            tags: methods.getValues("tags"),
            categoryId: methods.getValues("categoryId"),
            thumbnailUrl: methods.getValues("thumbnailUrl"),
            isAgeRestricted: methods.getValues("isAgeRestricted"),
            allowComments: methods.getValues("allowComments"),
            allowEmbedding: methods.getValues("allowEmbedding"),
            chapters: methods.getValues("chapters"),
            visibility: methods.getValues("visibility"),
            scheduledAt: methods.getValues("scheduledAt"),
        });
    };

    const handleNext = async () => {
        let fieldsToValidate: (keyof EditorFormValues)[] = [];
        if (activeStepIndex === 0) {
            fieldsToValidate = ["title", "description", "tags"];
        } else if (activeStepIndex === 1) {
            fieldsToValidate = ["chapters"];
        } else if (activeStepIndex === 2) {
            fieldsToValidate = ["visibility", "scheduledAt"];
        }

        const isStepValid = await methods.trigger(fieldsToValidate);
        if (!isStepValid) return;

        // Block transition past Details until processing is complete
        // (duration isn't known until READY, so chapters/visibility steps can't work correctly)
        if (activeStepIndex === 0 && videoData?.processingStatus !== "READY") {
            toast.info("Video is still processing. You can edit details now but chapters and visibility will be available once processing completes.");
            saveCurrentStep();
            return;
        }

        // C5c fix: auto-save on Next navigation
        saveCurrentStep();

        if (activeStepIndex < STEPS.length - 1) {
            setActiveStepIndex(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (activeStepIndex > 0) {
            // C5c fix: auto-save on Back navigation too
            saveCurrentStep();
            setActiveStepIndex(prev => prev - 1);
        }
    };

    const onDone = async () => {
        const isValid = await methods.trigger();
        if (!isValid) return;

        const formValues = methods.getValues();
        const { chapters, visibility, scheduledAt, ...rest } = formValues;
        
        // Map visibility appropriately
        let finalVisibility = visibility;
        const finalScheduledAt = scheduledAt;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((visibility as any) === "SCHEDULED") {
            finalVisibility = "PRIVATE";
            // scheduledAt remains passed as is
        }
        
        updateMutation.mutate({
            videoId: videoId as string,
            ...rest,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            visibility: finalVisibility as any,
            scheduledAt: finalScheduledAt,
            chapters: chapters ? chapters.map(c => ({ title: c.title, startTime: c.startTime })) : undefined
        }, {
            onSuccess: () => {
                utils.video.getChannelContent.invalidate();
                const visibility = methods.getValues("visibility");
                toast.success(visibility === "PUBLIC" ? "Video published!" : "Video details saved.");
                closeModal();
            },
            onError: (err) => {
                setSaveIndicator("idle");
                toast.error("Failed to save video: " + err.message);
            }
        });
    };

    // C5: Determine action button label
    const isOnVisibilityStep = activeStepIndex === STEPS.length - 1;
    const selectedVisibility = useWatch({ control: methods.control, name: "visibility" });
    const isPublishing = isOnVisibilityStep && selectedVisibility === "PUBLIC";
    const isProcessingReady = videoData?.processingStatus === "READY";
    const isStillProcessing = videoData?.processingStatus === "PROCESSING" || videoData?.processingStatus === "PENDING";

    return (
        <FormProvider {...methods}>
            <div className="flex flex-col h-full bg-background relative">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-border/60 shrink-0">
                    <h2 className="text-base font-semibold truncate mr-4 text-foreground">{videoData?.title || methods.getValues("title") || "Untitled video"}</h2>
                    <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground shrink-0" onClick={() => {
                        if (standalone) {
                            router.push("../");
                        } else {
                            closeModal();
                        }
                    }}>
                        <IconX className="h-4 w-4" />
                    </Button>
                </div>

                {/* C5b: Watch Video CTA banner — shown once processing is READY */}
                {isProcessingReady && videoId && (
                    <div className="flex items-center justify-between bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2.5 shrink-0">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                            <IconCheck size={16} />
                            Processing complete — your video is live!
                        </div>
                        <Button variant="ghost" size="sm" asChild className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 gap-1.5">
                            <Link href={`/watch/${videoId}`} target="_blank">
                                Watch Video <IconExternalLink size={14} />
                            </Link>
                        </Button>
                    </div>
                )}

                {/* Processing warning banner (still churning) */}
                {isStillProcessing && (
                    <div className="flex items-center gap-2 bg-blue-500/10 border-b border-blue-500/20 px-6 py-2.5 shrink-0">
                        <IconLoader2 size={14} className="text-blue-500 animate-spin" />
                        <span className="text-sm text-blue-600 dark:text-blue-400">Your video is still processing. It will become available once complete.</span>
                    </div>
                )}

                {/* Stepper Navigation */}
                <div className="flex justify-center border-b border-border/60 px-6 py-5 bg-muted/30 shrink-0">
                    <nav className="flex items-center w-full max-w-xl">
                        {STEPS.map((stepName, i) => (
                            <div key={stepName} className="flex-1 flex items-center">
                                <div className="flex flex-col items-center relative w-full">
                                    <div className={`flex items-center justify-center transition-all duration-300 ${
                                        i === activeStepIndex 
                                            ? "text-foreground" 
                                            : i < activeStepIndex 
                                                ? "text-foreground" 
                                                : "text-muted-foreground/50"
                                    }`}>
                                        <div className={`w-8 h-8 flex items-center justify-center rounded-full mb-2 transition-all duration-300 ${
                                            i === activeStepIndex 
                                                ? "bg-foreground text-background" 
                                                : i < activeStepIndex 
                                                    ? "bg-emerald-500 text-white" 
                                                    : "bg-muted text-muted-foreground"
                                        }`}>
                                            {i < activeStepIndex ? <IconCheck size={14} stroke={3} /> : <span className="text-xs font-bold">{i + 1}</span>}
                                        </div>
                                        <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                                            i === activeStepIndex ? "text-foreground" : "text-muted-foreground"
                                        }`}>{stepName}</span>
                                    </div>
                                </div>
                                {/* Connecting Line */}
                                {i !== STEPS.length - 1 && (
                                    <div className={`h-[2px] flex-1 mx-2 rounded-full transition-colors duration-500 ${
                                        i < activeStepIndex ? "bg-emerald-500" : "bg-border"
                                    }`} />
                                )}
                            </div>
                        ))}
                    </nav>
                </div>

                {/* Main Form Content */}
                <div className="flex-1 overflow-y-auto p-6 md:px-10">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <IconLoader2 className="animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="max-w-2xl mx-auto w-full">
                            <div className={activeStepIndex === 0 ? "block" : "hidden"}>
                                <DetailsStep />
                            </div>
                            <div className={activeStepIndex === 1 ? "block" : "hidden"}>
                                <ElementsStep videoDuration={videoData?.duration ?? null} />
                            </div>
                            <div className={activeStepIndex === 2 ? "block" : "hidden"}>
                                <VisibilityStep />
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky Editor Actions Bar */}
                <div className="px-6 py-3 border-t border-border/60 flex justify-between items-center bg-background shrink-0">
                    <Button variant="ghost" size="sm" onClick={handleBack} disabled={activeStepIndex === 0 || updateMutation.isPending} className="gap-1.5 text-muted-foreground hover:text-foreground">
                        <IconChevronLeft size={16} /> Back
                    </Button>

                    <div className="flex items-center gap-3">
                        {/* Save indicator */}
                        {saveIndicator === "saving" && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <IconLoader2 size={12} className="animate-spin" /> Saving…
                            </span>
                        )}
                        {saveIndicator === "saved" && (
                            <span className="text-xs text-emerald-500 flex items-center gap-1.5">
                                <IconCheck size={12} /> Saved
                            </span>
                        )}

                        {activeStepIndex < STEPS.length - 1 ? (
                            <Button size="sm" onClick={handleNext} disabled={updateMutation.isPending} className="gap-1.5">
                                Next <IconChevronRight size={16} />
                            </Button>
                        ) : (
                            // C5: Context-aware button label
                            <Button 
                                size="sm"
                                onClick={onDone} 
                                disabled={updateMutation.isPending}
                                variant={isPublishing ? "default" : "outline"}
                            >
                                {isPublishing ? "Publish" : "Save"}
                            </Button>
                        )}
                    </div>
                </div>

            </div>
        </FormProvider>
    );
}
