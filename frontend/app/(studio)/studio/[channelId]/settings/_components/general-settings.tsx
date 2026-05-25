"use client";

import { useEffect } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { IconLoader2, IconCheck, IconX } from "@tabler/icons-react";

import { trpc } from "@/lib/trpc-client";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { RouterOutputs } from "@/lib/trpc-client";

const channelHandleRegex = /^[a-zA-Z0-9_.]+$/;

const generalSettingsSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(50, "Name is too long"),
    handle: z
        .string()
        .trim()
        .min(3, "Handle must be at least 3 characters")
        .max(30, "Handle must be at most 30 characters")
        .regex(
            channelHandleRegex,
            "Handle can only contain letters, numbers, underscores, and periods.",
        ),
    description: z.string().trim().max(5000, "Description is too long").optional(),
});

type GeneralSettingsFormValues = z.infer<typeof generalSettingsSchema>;

interface GeneralSettingsProps {
    initialData: NonNullable<RouterOutputs["channel"]["getChannelById"]>["channel"];
}

export function GeneralSettings({ initialData }: GeneralSettingsProps) {
    const utils = trpc.useUtils();

    const form = useForm<GeneralSettingsFormValues>({
        resolver: zodResolver(generalSettingsSchema),
        defaultValues: {
            name: initialData.name,
            handle: initialData.handle,
            description: initialData.description || "",
        },
    });

    useEffect(() => {
        form.reset({
            name: initialData.name,
            handle: initialData.handle,
            description: initialData.description || "",
        });
    }, [initialData, form]);

    const { isDirty, isSubmitting } = form.formState;
    const currentHandle = useWatch({ control: form.control, name: "handle" });

    const debouncedHandle = useDebounce(currentHandle, 500);

    const handleAvailabilityQuery = trpc.channel.checkHandleAvailability.useQuery(
        { handle: debouncedHandle },
        {
            enabled:
                !!debouncedHandle &&
                debouncedHandle !== initialData.handle &&
                debouncedHandle.length >= 3,
        },
    );

    const updateChannelMutation = trpc.channel.updateChannel.useMutation({
        onSuccess: async () => {
            toast.success("General settings updated successfully");

            await Promise.all([
                utils.channel.getChannelById.invalidate({ channelId: initialData.id }),
                utils.channel.getUserChannels.invalidate(),
            ]);

            form.reset(form.getValues());
        },
        onError: (error) => {
            toast.error(error.message || "Failed to update channel settings");

            if (error.data?.code === "CONFLICT") {
                form.setError("handle", { message: "This handle is already taken." });
            }
        },
    });

    async function onSubmit(data: GeneralSettingsFormValues) {
        if (!isDirty) return;

        const payload = {
            ...data,
            description: data.description === "" ? undefined : data.description,
        };

        await updateChannelMutation.mutateAsync({
            channelId: initialData.id,
            ...payload,
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                    Update your channel&apos;s core identity and public profile.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Controller
                        name="name"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor={field.name}>Channel Name</FieldLabel>
                                <Input
                                    {...field}
                                    id={field.name}
                                    placeholder="Your awesome channel name"
                                    disabled={updateChannelMutation.isPending}
                                />
                                {fieldState.invalid && (
                                    <FieldError errors={[fieldState.error]} />
                                )}
                            </Field>
                        )}
                    />

                    <Controller
                        name="handle"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor={field.name}>Channel Handle</FieldLabel>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground select-none">
                                        @
                                    </span>
                                    <Input
                                        {...field}
                                        id={field.name}
                                        placeholder="channel_handle"
                                        className="pl-8"
                                        disabled={updateChannelMutation.isPending}
                                    />
                                    {field.value !== initialData.handle &&
                                        field.value.length >= 3 && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                {handleAvailabilityQuery.isFetching ? (
                                                    <IconLoader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                                                ) : handleAvailabilityQuery.isSuccess ? (
                                                    handleAvailabilityQuery.data.success ? (
                                                        <IconCheck className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                        <IconX className="w-4 h-4 text-red-500" />
                                                    )
                                                ) : null}
                                            </div>
                                        )}
                                </div>
                                <FieldDescription>
                                    This is your unique namespace ID used in URLs.
                                </FieldDescription>
                                {fieldState.invalid && (
                                    <FieldError errors={[fieldState.error]} />
                                )}
                            </Field>
                        )}
                    />

                    <Controller
                        name="description"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor={field.name}>Channel Description</FieldLabel>
                                <Textarea
                                    {...field}
                                    id={field.name}
                                    value={field.value || ""}
                                    placeholder="Tell viewers what your channel is about..."
                                    className="resize-none min-h-[120px]"
                                    disabled={updateChannelMutation.isPending}
                                />
                                <FieldDescription>
                                    A brief overview visible on your channel page.
                                </FieldDescription>
                                {fieldState.invalid && (
                                    <FieldError errors={[fieldState.error]} />
                                )}
                            </Field>
                        )}
                    />

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            disabled={!isDirty || isSubmitting || (currentHandle !== initialData.handle && handleAvailabilityQuery.data?.success === false)}
                        >
                            {isSubmitting && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save General Metadata
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
