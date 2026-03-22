"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import type { ControllerRenderProps } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { useDebounce } from "@/hooks/use-debounce";
import { IconCheck, IconLoader2, IconX, IconPlus, IconTrash } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ImageUpload from "@/components/custom/image-uploader";

const channelHandleRegex = /^[a-zA-Z0-9_.]+$/;
const linkSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(100),
    url: z.string().url("Please enter a valid URL"),
});

const createChannelFrontendSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(50),
    handle: z
        .string()
        .trim()
        .min(3, "Handle must be at least 3 characters")
        .max(30)
        .regex(
            channelHandleRegex,
            "Handle can only contain letters, numbers, underscores, and periods.",
        ),
    description: z.string().trim().max(5000).optional(),
    image: z.string().optional(),
    bannerUrl: z.string().optional(),
    contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
    location: z.string().trim().max(100).optional(),
    tagsString: z.string().optional().refine((val) => {
        if (!val) return true;
        const tags = val.split(",").map(t => t.trim()).filter(Boolean);
        return tags.length <= 50;
    }, "Maximum 50 tags allowed"),
    links: z.array(linkSchema).max(20).optional(),
});

type CreateChannelFormType = z.infer<typeof createChannelFrontendSchema>;

const steps = [
    { title: "Basic Info", subtitle: "Establish your fundamental broadcasting identity.", fields: ["name", "handle", "description"] },
    { title: "Branding & Discovery", subtitle: "Upload your media assets and optimize for search.", fields: ["image", "bannerUrl", "location", "tagsString"] },
    { title: "Contact & Links", subtitle: "Connect with your audience and external platforms.", fields: ["contactEmail", "links"] },
] as const;

export default function CreateChannelPage() {
    const [step, setStep] = useState(0);
    const router = useRouter();
    const utils = trpc.useUtils();

    const createChannelMutation = trpc.channel.createChannel.useMutation({
        onSuccess: (data) => {
            toast.success("Channel created successfully!");
            utils.channel.getUserChannels.invalidate();
            router.refresh();
            router.push(`/studio/${data.channel.id}`);
        },
        onError: (error) => {
            toast.error(error.message || "Failed to create channel");
        },
    });

    const isPending = createChannelMutation.isPending;

    const form = useForm<CreateChannelFormType>({
        resolver: zodResolver(createChannelFrontendSchema),
        defaultValues: {
            name: "",
            handle: "",
            description: "",
            image: "",
            bannerUrl: "",
            contactEmail: "",
            location: "",
            tagsString: "",
            links: [],
        },
        mode: "onChange",
    });

    const { control, trigger, handleSubmit, setError, clearErrors } = form;

    const handleValue = useWatch({
        control,
        name: "handle",
    });
    const debouncedHandle = useDebounce(handleValue, 500);

    const { fields, append, remove } = useFieldArray({
        control,
        name: "links",
    });

    const { data: handleCheckData, isLoading: isCheckingHandle } =
        trpc.channel.checkHandleAvailability.useQuery(
            { handle: debouncedHandle },
            {
                enabled: !!debouncedHandle && debouncedHandle.length >= 3,
                retry: false,
            },
        );

    let handleStatus: "idle" | "checking" | "available" | "taken" | "error" = "idle";
    let handleMessage = "";

    if (!debouncedHandle || debouncedHandle.length < 3) {
        handleStatus = "idle";
    } else if (isCheckingHandle) {
        handleStatus = "checking";
    } else if (handleCheckData?.success) {
        handleStatus = "available";
        handleMessage = "Handle is available";
    } else if (handleCheckData?.success === false) {
        handleStatus = "taken";
        handleMessage = "This handle is already taken";
    }

    useEffect(() => {
        if (handleStatus === "taken") {
            setError("handle", {
                type: "manual",
                message: "This handle is already taken",
            });
        } else if (handleStatus === "available") {
            clearErrors("handle");
        }
    }, [handleStatus, setError, clearErrors]);

    async function next() {
        const fieldsToCheck = steps[step].fields as unknown as Parameters<typeof trigger>[0];
        const valid = await trigger(fieldsToCheck);

        if (step === 0 && handleStatus === "taken") {
            return;
        }

        if (!valid) return;
        setStep((s) => s + 1);
    }

    function back() {
        setStep((s) => s - 1);
    }

    const onSubmit = (data: CreateChannelFormType) => {
        if (step < steps.length - 1) {
            next();
            return;
        }
        if (handleStatus === "taken" || isCheckingHandle) return;

        const { tagsString, contactEmail, ...rest } = data;
        
        const tags = tagsString 
            ? tagsString.split(",").map(t => t.trim()).filter(Boolean) 
            : undefined;

        const payload = {
            ...rest,
            image: rest.image === "" ? undefined : rest.image,
            bannerUrl: rest.bannerUrl === "" ? undefined : rest.bannerUrl,
            contactEmail: contactEmail === "" ? undefined : contactEmail,
            tags: tags && tags.length > 0 ? tags : undefined,
            links: rest.links && rest.links.length > 0 ? rest.links : undefined,
        };

        createChannelMutation.mutate(payload);
    };

    return (
        <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-4 sm:p-12 relative overflow-y-auto w-full">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/10 blur-[150px] rounded-[100%] pointer-events-none -z-10" />
            
            <div className="w-full max-w-2xl bg-surface-1/50 border border-border/10 rounded-[32px] p-6 sm:p-12 shadow-2xl backdrop-blur-xl relative z-10 my-10">
                <Form {...form}>
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="space-y-8"
                        onKeyDown={(e) => {
                            if (
                                e.key === "Enter" &&
                                e.target instanceof HTMLElement &&
                                e.target.tagName !== "TEXTAREA"
                            ) {
                                e.preventDefault();
                            }
                        }}
                    >
                        <div className="mb-10 text-center space-y-3">
                            <h1 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase text-foreground/90 leading-[1.1]">
                                {steps[step].title}
                            </h1>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 max-w-sm mx-auto">
                                {steps[step].subtitle}
                            </p>
                            <div className="flex items-center justify-center gap-2 mt-6">
                                {steps.map((_, i) => (
                                    <div key={i} className={cn("h-1.5 rounded-full transition-all duration-500", i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/40" : "w-2 bg-border/20")} />
                                ))}
                            </div>
                        </div>

                        {step === 0 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <FormField
                                    control={control}
                                    name="name"
                                    render={({ field }: { field: ControllerRenderProps<CreateChannelFormType, "name"> }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                                                Channel Name
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder="My Awesome Channel"
                                                    className="bg-surface-2 border-border/10 rounded-2xl h-14 px-5 focus-visible:ring-primary/20 text-sm font-medium transition-all"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={control}
                                    name="handle"
                                    render={({ field }: { field: ControllerRenderProps<CreateChannelFormType, "handle"> }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                                                Unique Handle
                                            </FormLabel>
                                            <FormControl>
                                                <div className="relative group">
                                                    <div className="absolute left-5 top-[18px] text-muted-foreground/40 font-black">
                                                        @
                                                    </div>
                                                    <Input
                                                        {...field}
                                                        placeholder="my_handle"
                                                        onChange={(e) => {
                                                            const val = e.target.value.replace('@', '');
                                                            field.onChange(val);
                                                        }}
                                                        className={cn(
                                                            "bg-surface-2 border-border/10 rounded-2xl h-14 pl-10 pr-12 focus-visible:ring-primary/20 text-sm font-medium transition-all",
                                                            handleStatus === "taken" && "border-destructive focus-visible:ring-destructive/20",
                                                            handleStatus === "available" && "border-emerald-500/50 focus-visible:ring-emerald-500/20",
                                                        )}
                                                    />
                                                    <div className="absolute right-4 top-4">
                                                        {handleStatus === "checking" && <IconLoader2 className="h-6 w-6 animate-spin text-primary" />}
                                                        {handleStatus === "available" && <IconCheck className="h-6 w-6 text-emerald-500" />}
                                                        {handleStatus === "taken" && <IconX className="h-6 w-6 text-destructive" />}
                                                    </div>
                                                </div>
                                            </FormControl>
                                            <FormDescription>
                                                {handleMessage && (
                                                    <span
                                                        className={cn(
                                                            "text-[10px] font-black uppercase tracking-widest",
                                                            handleStatus === "available" ? "text-emerald-500" : handleStatus === "taken" ? "text-destructive" : "text-muted-foreground/40",
                                                        )}
                                                    >
                                                        {handleMessage}
                                                    </span>
                                                )}
                                                {!handleMessage && "An alphanumeric URL identifier for your network"}
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={control}
                                    name="description"
                                    render={({ field }: { field: ControllerRenderProps<CreateChannelFormType, "description"> }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                                                Registry Overview (Bio)
                                            </FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    {...field}
                                                    placeholder="Tell viewers what to expect from your content..."
                                                    className="bg-surface-2 border-border/10 rounded-2xl min-h-[140px] p-5 focus-visible:ring-primary/20 text-sm font-medium resize-none transition-all"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        {step === 1 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <FormField
                                    control={control}
                                    name="image"
                                    render={({ field }: { field: ControllerRenderProps<CreateChannelFormType, "image"> }) => (
                                        <FormItem>
                                            <FormControl>
                                                <div className="h-32 w-32 relative mx-auto mb-2">
                                                    <ImageUpload
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        type="channel-logo"
                                                    />
                                                </div>
                                            </FormControl>
                                            <div className="text-center">
                                                <FormDescription className="text-[10px] font-black uppercase tracking-widest">
                                                    Avatar (1:1 Ratio)
                                                </FormDescription>
                                            </div>
                                            <FormMessage className="text-center" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={control}
                                    name="bannerUrl"
                                    render={({ field }: { field: ControllerRenderProps<CreateChannelFormType, "bannerUrl"> }) => (
                                        <FormItem>
                                            <FormControl>
                                                <div className="h-40 w-full relative">
                                                    <ImageUpload
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        type="channel-banner"
                                                    />
                                                </div>
                                            </FormControl>
                                            <div className="text-center mt-2">
                                                <FormDescription className="text-[10px] font-black uppercase tracking-widest">
                                                    Banner Wallpaper (2560x1440)
                                                </FormDescription>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                                    <FormField
                                        control={control}
                                        name="location"
                                        render={({ field }: { field: ControllerRenderProps<CreateChannelFormType, "location"> }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                                                    Broadcast Location
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        placeholder="San Francisco, CA"
                                                        className="bg-surface-2 border-border/10 rounded-2xl h-14 px-5 focus-visible:ring-primary/20 text-sm font-medium transition-all"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    
                                    <FormField
                                        control={control}
                                        name="tagsString"
                                        render={({ field }: { field: ControllerRenderProps<CreateChannelFormType, "tagsString"> }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                                                    Search Tags
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        placeholder="Gaming, Tech, React"
                                                        className="bg-surface-2 border-border/10 rounded-2xl h-14 px-5 focus-visible:ring-primary/20 text-sm font-medium transition-all"
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-[9px] uppercase tracking-widest">Comma Separated</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <FormField
                                    control={control}
                                    name="contactEmail"
                                    render={({ field }: { field: ControllerRenderProps<CreateChannelFormType, "contactEmail"> }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                                                Public Inquiries Email
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    type="email"
                                                    placeholder="contact@example.com"
                                                    className="bg-surface-2 border-border/10 rounded-2xl h-14 px-5 focus-visible:ring-primary/20 text-sm font-medium transition-all"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="space-y-4 pt-4 border-t border-border/10">
                                    <div className="flex justify-between items-center px-1">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                            External Platforms
                                        </FormLabel>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => append({ title: "", url: "" })}
                                            className="hover:bg-primary/10 text-primary font-black uppercase text-[10px] tracking-widest rounded-xl h-9 px-4 transition-all"
                                        >
                                            <IconPlus className="w-4 h-4 mr-2" /> Add Link
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        {fields.map((field, i) => (
                                            <div key={field.id} className="flex gap-3 items-start animate-in fade-in zoom-in-95">
                                                <FormField
                                                    control={control}
                                                    name={`links.${i}.title`}
                                                    render={({ field }: { field: ControllerRenderProps<CreateChannelFormType, `links.${number}.title`> }) => (
                                                        <FormItem className="flex-1">
                                                            <FormControl>
                                                                <Input
                                                                    {...field}
                                                                    placeholder="Twitter"
                                                                    className="h-12 text-sm bg-surface-2 border-border/10 rounded-xl focus-visible:ring-primary/20"
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={control}
                                                    name={`links.${i}.url`}
                                                    render={({ field }: { field: ControllerRenderProps<CreateChannelFormType, `links.${number}.url`> }) => (
                                                        <FormItem className="grow-2 w-full">
                                                            <FormControl>
                                                                <Input
                                                                    {...field}
                                                                    placeholder="https://twitter.com/..."
                                                                    className="h-12 text-sm bg-surface-2 border-border/10 rounded-xl focus-visible:ring-primary/20"
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => remove(i)}
                                                    className="h-12 w-12 text-destructive/40 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all shrink-0"
                                                >
                                                    <IconTrash className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        ))}
                                        {fields.length === 0 && (
                                            <div className="text-center py-6 bg-surface-2/30 rounded-2xl border border-dashed border-border/10">
                                                <p className="text-[11px] uppercase tracking-widest font-black text-muted-foreground/40">
                                                    No external links mapped yet
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {form.formState.errors.root && (
                            <div className="bg-destructive/10 text-destructive px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-destructive/20 text-center shadow-sm">
                                {form.formState.errors.root.message}
                            </div>
                        )}

                        {/* FOOTER NAV */}
                        <div className="flex justify-between items-center pt-8 border-t border-border/10 mt-8 gap-4">
                            {step > 0 ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={back}
                                    className="hover:bg-surface-2 text-foreground/80 font-black uppercase text-[11px] tracking-widest rounded-2xl transition-all h-14 px-8 w-full sm:w-auto"
                                >
                                    Back
                                </Button>
                            ) : (
                                <div className="hidden sm:block" /> 
                            )}

                            {step < steps.length - 1 ? (
                                <Button
                                    type="button"
                                    onClick={next}
                                    disabled={
                                        (step === 0 && handleStatus !== "available") ||
                                        handleStatus === "checking" ||
                                        handleStatus === "taken"
                                    }
                                    className="bg-primary hover:bg-primary/90 text-black font-black uppercase text-[11px] tracking-widest rounded-2xl transition-all h-14 px-12 shadow-[0_0_30px_-5px_oklch(var(--primary)/0.3)] w-full sm:w-auto ml-auto"
                                >
                                    Next Step
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    disabled={
                                        isPending ||
                                        handleStatus === "taken" ||
                                        handleStatus === "checking"
                                    }
                                    className="bg-primary hover:bg-primary/90 text-black font-black uppercase text-[11px] tracking-widest rounded-2xl transition-all h-14 px-12 shadow-[0_0_30px_-5px_oklch(var(--primary)/0.4)] hover:shadow-[0_0_40px_-5px_oklch(var(--primary)/0.5)] w-full sm:w-auto ml-auto"
                                >
                                    {isPending ? (
                                        <IconLoader2 className="mr-3 h-5 w-5 animate-spin" />
                                    ) : (
                                        <IconCheck className="mr-3 h-5 w-5" />
                                    )}
                                    Initialize Hub
                                </Button>
                            )}
                        </div>
                    </form>
                </Form>
            </div>
            
            <p className="mt-8 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 text-center relative z-10 w-full mb-8">
                Powered by the Studio Network Protocol
            </p>
        </div>
    );
}
