"use client";

import { useEffect, useState } from "react";
import { useForm, Controller, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { IconLoader2, IconPlus, IconTrash, IconX, IconLink, IconTag } from "@tabler/icons-react";

import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RouterOutputs } from "@/lib/trpc-client";

const linkSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(100, "Too long"),
    url: z.string().url("Please enter a valid URL (https://...)"),
});

const discoverySettingsSchema = z.object({
    links: z.array(linkSchema).max(20, "Maximum 20 links allowed").optional(),
    tags: z.array(z.string().trim()).max(50, "Maximum 50 tags allowed").optional(),
});

type DiscoverySettingsFormValues = z.infer<typeof discoverySettingsSchema>;

type ChannelData = NonNullable<RouterOutputs["channel"]["getChannelById"]>["channel"];

interface DiscoverySettingsProps {
    initialData: ChannelData;
}

export function DiscoverySettings({ initialData }: DiscoverySettingsProps) {
    const utils = trpc.useUtils();
    const [tagInput, setTagInput] = useState("");

    const initialTags = initialData.tags?.map((t) => t.name) || [];
    const initialLinks = Array.isArray(initialData.links)
        ? (initialData.links as { title: string; url: string }[])
        : [];

    const form = useForm<DiscoverySettingsFormValues>({
        resolver: zodResolver(discoverySettingsSchema),
        defaultValues: {
            links: initialLinks,
            tags: initialTags,
        },
    });

    const { fields: linkFields, append: appendLink, remove: removeLink } = useFieldArray({
        control: form.control,
        name: "links",
    });

    useEffect(() => {
        const fetchedTags = initialData.tags?.map((t) => t.name) || [];
        const fetchedLinks = Array.isArray(initialData.links) ? (initialData.links as { title: string; url: string }[]) : [];

        form.reset({
            links: fetchedLinks,
            tags: fetchedTags,
        });
    }, [initialData, form]);

    const { isDirty, isSubmitting } = form.formState;

    const updateChannelMutation = trpc.channel.updateChannel.useMutation({
        onSuccess: async () => {
            toast.success("Discovery metadata updated successfully.");
            await Promise.all([
                utils.channel.getChannelById.invalidate({ channelId: initialData.id }),
                utils.channel.getUserChannels.invalidate(),
            ]);
            form.reset(form.getValues());
        },
        onError: (error) => {
            toast.error(error.message || "Failed to sync metadata");
        },
    });

    async function onSubmit(data: DiscoverySettingsFormValues) {
        if (!isDirty) return;

        const filteredLinks = data.links?.filter(l => l.title.trim().length > 0 && l.url.trim().length > 0) || [];

        await updateChannelMutation.mutateAsync({
            channelId: initialData.id,
            links: filteredLinks,
            tags: data.tags || [],
        });
    }

    const currentTags = useWatch({ control: form.control, name: "tags" }) || [];

    const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();

            const rawTag = tagInput.trim();
            if (!rawTag) return;
            if (currentTags.length >= 50) {
                toast.error("Maximum 50 tags allowed.");
                return;
            }
            if (currentTags.includes(rawTag)) {
                toast.error("Tag already exists");
                return;
            }

            form.setValue("tags", [...currentTags, rawTag], { shouldDirty: true });
            setTagInput("");
        }
    };

    const removeTag = (tagToRemove: string) => {
        form.setValue("tags", currentTags.filter((t) => t !== tagToRemove), { shouldDirty: true });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Discovery & Links</CardTitle>
                <CardDescription>
                    Help viewers discover your channel through SEO tags and social networks.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                    {/* SEO TAGS */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                            <IconTag className="w-4 h-4 text-muted-foreground" />
                            Search Tags
                        </h4>

                        <div className="flex flex-wrap gap-2 mb-4">
                            {currentTags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="px-3 py-1 flex items-center gap-1 group">
                                    {tag}
                                    <button
                                        type="button"
                                        onClick={() => removeTag(tag)}
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <IconX className="w-3 h-3" />
                                    </button>
                                </Badge>
                            ))}
                            {currentTags.length === 0 && (
                                <span className="text-sm text-muted-foreground italic">No tags added yet.</span>
                            )}
                        </div>

                        <div className="relative max-w-sm">
                            <Input
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleAddTag}
                                placeholder="Type a tag and hit Enter..."
                                disabled={currentTags.length >= 50}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Add up to 50 tags. Used for internal search indexing.
                        </p>
                    </div>

                    {/* EXTERNAL LINKS */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                            <IconLink className="w-4 h-4 text-muted-foreground" />
                            External Links
                        </h4>

                        <div className="space-y-4">
                            {linkFields.map((linkField, index) => (
                                <div key={linkField.id} className="flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/20 relative group">
                                    <div className="flex-1 space-y-4">
                                        <Controller
                                            name={`links.${index}.title`}
                                            control={form.control}
                                            render={({ field, fieldState }) => (
                                                <Field data-invalid={fieldState.invalid}>
                                                    <FieldLabel htmlFor={field.name} className="text-xs">Link Title</FieldLabel>
                                                    <Input
                                                        {...field}
                                                        id={field.name}
                                                        placeholder="e.g. My Twitter"
                                                        disabled={updateChannelMutation.isPending}
                                                    />
                                                    {fieldState.invalid && (
                                                        <FieldError errors={[fieldState.error]} />
                                                    )}
                                                </Field>
                                            )}
                                        />
                                        <Controller
                                            name={`links.${index}.url`}
                                            control={form.control}
                                            render={({ field, fieldState }) => (
                                                <Field data-invalid={fieldState.invalid}>
                                                    <FieldLabel htmlFor={field.name} className="text-xs">URL</FieldLabel>
                                                    <Input
                                                        {...field}
                                                        id={field.name}
                                                        placeholder="https://..."
                                                        disabled={updateChannelMutation.isPending}
                                                    />
                                                    {fieldState.invalid && (
                                                        <FieldError errors={[fieldState.error]} />
                                                    )}
                                                </Field>
                                            )}
                                        />
                                    </div>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeLink(index)}
                                        className="text-muted-foreground hover:text-destructive shrink-0 mt-6"
                                    >
                                        <IconTrash className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => appendLink({ title: "", url: "" })}
                            disabled={linkFields.length >= 20}
                        >
                            <IconPlus className="w-4 h-4 mr-2" />
                            Add Link
                        </Button>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-border">
                        <Button type="submit" disabled={!isDirty || isSubmitting}>
                            {isSubmitting && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Metadata
                        </Button>
                    </div>

                </form>
            </CardContent>
        </Card>
    );
}
