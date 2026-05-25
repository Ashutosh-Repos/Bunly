"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { IconLoader2 } from "@tabler/icons-react";

import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import { RouterOutputs } from "@/lib/trpc-client";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

const contactSettingsSchema = z.object({
    contactEmail: z
        .string()
        .email("Requires a valid email address")
        .optional()
        .or(z.literal("")),
    location: z.string().trim().max(100, "Location is too long").optional(),
});

type ContactSettingsFormValues = z.infer<typeof contactSettingsSchema>;

type ChannelData = NonNullable<RouterOutputs["channel"]["getChannelById"]>["channel"];

interface ContactSettingsProps {
    initialData: ChannelData;
}

export function ContactSettings({ initialData }: ContactSettingsProps) {
    const utils = trpc.useUtils();

    const form = useForm<ContactSettingsFormValues>({
        resolver: zodResolver(contactSettingsSchema),
        defaultValues: {
            contactEmail: initialData.contactEmail || "",
            location: initialData.location || "",
        },
    });

    useEffect(() => {
        form.reset({
            contactEmail: initialData.contactEmail || "",
            location: initialData.location || "",
        });
    }, [initialData, form]);

    const { isDirty, isSubmitting } = form.formState;

    const updateChannelMutation = trpc.channel.updateChannel.useMutation({
        onSuccess: async () => {
            toast.success("Contact settings updated successfully");

            await Promise.all([
                utils.channel.getChannelById.invalidate({ channelId: initialData.id }),
                utils.channel.getUserChannels.invalidate(),
            ]);

            form.reset(form.getValues());
        },
        onError: (error) => {
            toast.error(error.message || "Failed to update contact settings");
        },
    });

    async function onSubmit(data: ContactSettingsFormValues) {
        if (!isDirty) return;

        await updateChannelMutation.mutateAsync({
            channelId: initialData.id,
            contactEmail: data.contactEmail,
            location: data.location === "" ? undefined : data.location,
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Business & Contact Info</CardTitle>
                <CardDescription>
                    Provide public avenues for sponsors to reach your network.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Controller
                        name="contactEmail"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor={field.name}>Inquiry Email Address</FieldLabel>
                                <Input
                                    {...field}
                                    id={field.name}
                                    type="email"
                                    value={field.value || ""}
                                    placeholder="sponsors@yourdomain.com"
                                    disabled={updateChannelMutation.isPending}
                                />
                                <FieldDescription>
                                    This email will be fully public on your channel profile page.
                                </FieldDescription>
                                {fieldState.invalid && (
                                    <FieldError errors={[fieldState.error]} />
                                )}
                            </Field>
                        )}
                    />

                    <Controller
                        name="location"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor={field.name}>Studio Base Region</FieldLabel>
                                <Input
                                    {...field}
                                    id={field.name}
                                    value={field.value || ""}
                                    placeholder="e.g. San Francisco, CA"
                                    disabled={updateChannelMutation.isPending}
                                />
                                {fieldState.invalid && (
                                    <FieldError errors={[fieldState.error]} />
                                )}
                            </Field>
                        )}
                    />

                    <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={!isDirty || isSubmitting}>
                            {isSubmitting && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Contact Info
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
