"use client";

import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function VisibilityStep() {
    const { control, watch } = useFormContext();
    const visibility = watch("visibility");

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div>
                <h3 className="text-2xl font-bold mb-1">Visibility</h3>
                <p className="text-sm text-muted-foreground mb-6">Choose who can see your video, or schedule it for publishing later.</p>
            </div>

            <div className="border rounded-lg p-6 bg-card text-card-foreground">
                <h4 className="font-semibold text-base mb-4">Save or publish</h4>
                <p className="text-sm text-muted-foreground mb-6">Make your video public, unlisted, or private</p>

                <FormField
                    control={control}
                    name="visibility"
                    render={({ field }) => (
                        <FormItem className="space-y-4">
                            <FormControl>
                                <RadioGroup
                                    onValueChange={field.onChange}
                                    value={field.value}
                                    className="flex flex-col space-y-2 ml-4"
                                >
                                    <FormItem className="flex items-center space-x-3 space-y-0 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                                        <FormControl>
                                            <RadioGroupItem value="PRIVATE" />
                                        </FormControl>
                                        <div className="grid">
                                            <FormLabel className="font-medium cursor-pointer">Private</FormLabel>
                                            <span className="text-sm text-muted-foreground">Only you and people you choose can watch your video</span>
                                        </div>
                                    </FormItem>

                                    <FormItem className="flex items-center space-x-3 space-y-0 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                                        <FormControl>
                                            <RadioGroupItem value="UNLISTED" />
                                        </FormControl>
                                        <div className="grid">
                                            <FormLabel className="font-medium cursor-pointer">Unlisted</FormLabel>
                                            <span className="text-sm text-muted-foreground">Anyone with the video link can watch your video</span>
                                        </div>
                                    </FormItem>

                                    <FormItem className="flex items-center space-x-3 space-y-0 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                                        <FormControl>
                                            <RadioGroupItem value="PUBLIC" />
                                        </FormControl>
                                        <div className="grid">
                                            <FormLabel className="font-medium cursor-pointer">Public</FormLabel>
                                            <span className="text-sm text-muted-foreground">Everyone can watch your video</span>
                                        </div>
                                    </FormItem>

                                    <div className="h-px bg-border my-2 block" />

                                    <FormItem className="flex items-center space-x-3 space-y-0 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                                        <FormControl>
                                            <RadioGroupItem value="SCHEDULED" />
                                        </FormControl>
                                        <div className="grid">
                                            <FormLabel className="font-medium cursor-pointer">Schedule</FormLabel>
                                            <span className="text-sm text-muted-foreground">Select a date to make your video public</span>
                                        </div>
                                    </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Conditional render for schedule date picker */}
                {visibility === "SCHEDULED" && (
                    <div className="mt-6 ml-12 p-4 border rounded-md bg-muted/20 animate-in fade-in zoom-in-95">
                        <FormField
                            control={control}
                            name="scheduledAt"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Date & Time</FormLabel>
                                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-globe"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                                        Video will be private before publishing
                                    </p>
                                    <FormControl>
                                        <input 
                                            type="datetime-local" 
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={field.value ? new Date(field.value.getTime() - field.value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    field.onChange(new Date(e.target.value));
                                                }
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                )}
            </div>
            
            <div className="p-4 bg-muted/50 rounded-lg border mt-8">
                <h5 className="font-semibold text-sm mb-2">Before you publish, check the following:</h5>
                <p className="text-xs text-muted-foreground">Do kids appear in this video? Make sure to follow our policies to protect minors from harm, exploitation, bullying, and violations of labor law.</p>
            </div>
        </div>
    );
}
