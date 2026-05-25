"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { IconTrash, IconPlus } from "@tabler/icons-react";

interface ChapterField {
    id: string;
    title: string;
    startTime: number;
}

function parseTimeToSeconds(value: string): number {
    const parts = value.trim().split(":").map(Number);
    if (parts.length === 2) {
        const [m, s] = parts;
        return (m || 0) * 60 + (s || 0);
    }
    if (parts.length === 3) {
        const [h, m, s] = parts;
        return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    }
    return 0;
}

function formatSecondsToTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ElementsStep() {
    const { control } = useFormContext();
    const { fields, append, remove } = useFieldArray({ control, name: "chapters" });

    const [showAddChapter, setShowAddChapter] = useState(false);
    const [newChapterTitle, setNewChapterTitle] = useState("");
    const [newChapterTime, setNewChapterTime] = useState("0:00");
    const [timeError, setTimeError] = useState("");

    const handleAddChapter = () => {
        const seconds = parseTimeToSeconds(newChapterTime);
        if (!newChapterTitle.trim()) return;

        // Validate time format loosely
        if (!/^\d+:\d{2}(:\d{2})?$/.test(newChapterTime.trim())) {
            setTimeError("Use mm:ss format (e.g. 1:30)");
            return;
        }

        append({ title: newChapterTitle.trim(), startTime: seconds });
        setNewChapterTitle("");
        setNewChapterTime("0:00");
        setTimeError("");
        setShowAddChapter(false);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div>
                <h3 className="text-2xl font-bold mb-1">Video Elements</h3>
                <p className="text-sm text-muted-foreground mb-6">Use cards and an end screen to show viewers related videos, websites, and calls to action.</p>
            </div>

            <div className="flex flex-col gap-4">
                {/* Chapters Section */}
                <div className="border rounded-lg p-6 bg-card text-card-foreground">
                    <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                            <div className="w-16 h-10 bg-muted rounded flex items-center justify-center shrink-0">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-list-video text-muted-foreground"><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/><path d="m16 12 5 3-5 3v-6Z"/></svg>
                            </div>
                            <div>
                                <h4 className="font-semibold text-lg">Video chapters</h4>
                                <p className="text-sm text-muted-foreground">Make it easier for viewers to navigate by adding chapter titles and timestamps.</p>
                            </div>
                        </div>
                        <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => setShowAddChapter(v => !v)}
                            className="shrink-0"
                        >
                            <IconPlus size={16} className="mr-1" /> ADD
                        </Button>
                    </div>

                    {/* Inline add chapter form */}
                    {showAddChapter && (
                        <div className="mt-4 pt-4 border-t flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Chapter title"
                                    value={newChapterTitle}
                                    onChange={e => setNewChapterTitle(e.target.value)}
                                    className="flex-1"
                                    maxLength={200}
                                />
                                <div className="flex flex-col gap-1 w-28">
                                    <Input
                                        placeholder="0:00"
                                        value={newChapterTime}
                                        onChange={e => { setNewChapterTime(e.target.value); setTimeError(""); }}
                                        className={timeError ? "border-destructive" : ""}
                                    />
                                    {timeError && <span className="text-xs text-destructive">{timeError}</span>}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" onClick={handleAddChapter} disabled={!newChapterTitle.trim()}>Add Chapter</Button>
                                <Button size="sm" variant="ghost" onClick={() => { setShowAddChapter(false); setTimeError(""); }}>Cancel</Button>
                            </div>
                        </div>
                    )}

                    {/* Chapter list */}
                    {fields.length > 0 && (
                        <div className="mt-4 pt-4 border-t flex flex-col gap-2">
                            {(fields as unknown as ChapterField[]).map((field, index) => (
                                <div key={field.id} className="flex items-center justify-between py-2 px-3 bg-muted/40 rounded-md">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-mono text-muted-foreground w-10 shrink-0">
                                            {formatSecondsToTime(field.startTime)}
                                        </span>
                                        <span className="text-sm font-medium">{field.title}</span>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(index)}>
                                        <IconTrash size={14} />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Cards — Coming Soon */}
                <div className="border rounded-lg p-6 flex items-center justify-between bg-card text-card-foreground opacity-50 cursor-not-allowed">
                    <div className="flex gap-4">
                        <div className="w-16 h-10 bg-muted rounded flex items-center justify-center shrink-0">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-presentation text-muted-foreground"><path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/></svg>
                        </div>
                        <div>
                            <h4 className="font-semibold text-lg">Add cards</h4>
                            <p className="text-sm text-muted-foreground">Promote related content during your video</p>
                            <span className="text-xs text-orange-500 font-medium">Coming Soon</span>
                        </div>
                    </div>
                    <Button variant="secondary" disabled>ADD</Button>
                </div>
            </div>
        </div>
    );
}
