"use client";

import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc-client";
import { useUpload } from "@/components/providers/upload-provider";
import { BunlyImage } from "@/components/custom/bunly-image";

export function DetailsStep() {
    const { control, setValue, watch } = useFormContext();
    const [showMore, setShowMore] = useState(false);
    const [customThumbnailUrl, setCustomThumbnailUrl] = useState<string | null>(null);
    const { videoId } = useUpload();
    const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation();

    const { data: videoData } = trpc.video.getVideo.useQuery(
        { videoId: videoId as string },
        { enabled: !!videoId }
    );

    // M4: Fetch categories for the picker
    const { data: categoryResponse } = trpc.category.getCategories.useQuery();
    const categories = categoryResponse?.categories || [];

    const currentThumbnail = watch("thumbnailUrl");
    const generatedOptions = videoData?.thumbnailOptions || [];
    const isProcessing = videoData?.processingStatus === "PROCESSING" || videoData?.processingStatus === "UPLOADING";

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div>
                <h3 className="text-2xl font-bold mb-1">Details</h3>
                <p className="text-sm text-muted-foreground mb-6">Add details that describe your video.</p>
            </div>

            <FormField
                control={control}
                name="title"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Title (required)</FormLabel>
                        <FormControl>
                            <Input placeholder="Add a title that describes your video" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                            <Textarea 
                                placeholder="Tell viewers about your video" 
                                className="min-h-[120px] resize-y" 
                                {...field} 
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* Thumbnail Picker */}
            <div>
                <h4 className="text-sm font-semibold mb-2">Thumbnail</h4>
                <p className="text-sm text-muted-foreground mb-4">Select or upload a picture that shows what&apos;s in your video. A good thumbnail stands out and draws viewers&apos; attention.</p>
                <div className="flex gap-4 flex-wrap">
                    <label htmlFor="thumbnail-upload" className="border border-dashed aspect-video w-40 flex flex-col gap-2 items-center justify-center rounded bg-muted/50 cursor-pointer hover:bg-muted duration-200">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-image-plus text-muted-foreground"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><line x1="16" x2="22" y1="5" y2="5"/><line x1="19" x2="19" y1="2" y2="8"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                        <span className="text-xs font-medium text-muted-foreground">Upload File</span>
                        <input id="thumbnail-upload" type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                                // Use the standard upload presigned URL flow
                                const res = await getPresignedUrl.mutateAsync({
                                    filename: file.name,
                                    contentType: file.type,
                                    type: "thumbnail",
                                });

                                const formData = new FormData();
                                Object.entries(res.fields).forEach(([key, value]) => {
                                    formData.append(key, value as string);
                                });
                                formData.append("file", file);

                                await fetch(res.url, {
                                    method: "POST",
                                    body: formData,
                                });

                                setValue("thumbnailUrl", res.key);
                                setCustomThumbnailUrl(URL.createObjectURL(file));
                            } catch {
                                // Silently fail — toast could be added
                            }
                        }} />
                    </label>
                    {/* Custom uploaded thumbnail preview */}
                    {(customThumbnailUrl || (currentThumbnail && !generatedOptions.includes(currentThumbnail))) && (
                        <div 
                            className={`relative border aspect-video w-40 flex items-center justify-center rounded overflow-hidden cursor-pointer duration-200 ring-2 ring-primary border-primary`}
                        >
                            <BunlyImage 
                                src={customThumbnailUrl || currentThumbnail} 
                                alt="Custom Thumbnail" 
                                fill
                                className="object-cover" 
                                priority={true}
                            />
                            <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5 z-20">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                        </div>
                    )}
                    {/* Dynamic generated thumbnails */}
                    {generatedOptions.length > 0 ? (
                        generatedOptions.map((key, i) => (
                            <div 
                                key={i} 
                                onClick={() => setValue("thumbnailUrl", key)}
                                className={`relative border aspect-video w-40 flex items-center justify-center rounded overflow-hidden cursor-pointer duration-200 ${currentThumbnail === key ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'}`}
                            >
                                <BunlyImage 
                                    src={key} 
                                    alt={`Thumbnail option ${i + 1}`} 
                                    fill
                                    className="object-cover"
                                    priority={true}
                                />
                                {currentThumbnail === key && (
                                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5 z-20">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : isProcessing ? (
                        /* Static placeholders for generated thumbnails while processing */
                        [1, 2, 3].map(i => (
                            <div key={i} className="border aspect-video w-40 flex items-center justify-center rounded bg-secondary/10 animate-pulse">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-image text-muted-foreground/30"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                            </div>
                        ))
                    ) : null}
                </div>
            </div>

            {/* M4: Category picker */}
            {categories && categories.length > 0 && (
                <FormField
                    control={control}
                    name="categoryId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select
                                onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                                value={field.value ?? "none"}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="none">No category</SelectItem>
                                    {categories.map((cat: { id: string; name: string }) => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            <div className="pt-4 border-t">
                {showMore ? (
                    <div className="space-y-6 pt-4 animate-in slide-in-from-top-4 fade-in">
                        <FormField
                            control={control}
                            name="tags"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tags</FormLabel>
                                    <p className="text-xs text-muted-foreground mb-2">Tags can be useful if content in your video is commonly misspelled. Otherwise, tags play a minimal role in helping viewers find your video.</p>
                                    <FormControl>
                                        <Input 
                                            placeholder="Add tags (comma separated)" 
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                field.onChange(val.split(",").map(t => t.trim()).filter(Boolean));
                                            }}
                                            value={field.value?.join(", ") || ""}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={control}
                            name="isAgeRestricted"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5 mb-0">
                                        <FormLabel className="text-base">Age Restriction</FormLabel>
                                        <p className="text-sm text-muted-foreground">
                                            Restrict my video to viewers over 18
                                        </p>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={control}
                            name="allowComments"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5 mb-0">
                                        <FormLabel className="text-base">Allow Comments</FormLabel>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <Button variant="ghost" className="w-full text-foreground/70" onClick={() => setShowMore(false)}>SHOW LESS</Button>
                    </div>
                ) : (
                    <Button variant="secondary" className="w-full" onClick={() => setShowMore(true)}>SHOW MORE</Button>
                )}
            </div>
        </div>
    );
}
