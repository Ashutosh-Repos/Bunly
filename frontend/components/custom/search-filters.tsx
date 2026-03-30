"use client";

import { cn } from "@/lib/utils";
import { IconAdjustmentsHorizontal, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortBy = "relevance" | "newest" | "viewCount";
export type UploadDate = "today" | "thisWeek" | "thisMonth" | "thisYear" | undefined;
export type Duration = "short" | "medium" | "long" | undefined;

export interface SearchFilterValues {
    sortBy: SortBy;
    uploadDate: UploadDate;
    duration: Duration;
}

interface SearchFiltersProps {
    values: SearchFilterValues;
    onChange: (values: SearchFilterValues) => void;
}

// ---------------------------------------------------------------------------
// Filter Config
// ---------------------------------------------------------------------------

const UPLOAD_DATE_OPTIONS: { value: UploadDate; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "thisWeek", label: "This week" },
    { value: "thisMonth", label: "This month" },
    { value: "thisYear", label: "This year" },
];

const DURATION_OPTIONS: { value: Duration; label: string }[] = [
    { value: "short", label: "Under 4 min" },
    { value: "medium", label: "4–20 min" },
    { value: "long", label: "Over 20 min" },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
    { value: "relevance", label: "Relevance" },
    { value: "newest", label: "Upload date" },
    { value: "viewCount", label: "View count" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchFilters({ values, onChange }: SearchFiltersProps) {
    const [isOpen, setIsOpen] = useState(false);

    const hasActiveFilters =
        values.sortBy !== "relevance" ||
        values.uploadDate !== undefined ||
        values.duration !== undefined;

    const clearAll = () => {
        onChange({ sortBy: "relevance", uploadDate: undefined, duration: undefined });
    };

    return (
        <div className="w-full">
            {/* Toggle Button */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border",
                        isOpen || hasActiveFilters
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50"
                    )}
                >
                    <IconAdjustmentsHorizontal size={18} />
                    Filters
                    {hasActiveFilters && (
                        <span className="ml-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                            {[values.sortBy !== "relevance", values.uploadDate, values.duration].filter(Boolean).length}
                        </span>
                    )}
                </button>

                {hasActiveFilters && (
                    <button
                        onClick={clearAll}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                    >
                        <IconX size={14} />
                        Clear all
                    </button>
                )}
            </div>

            {/* Filter Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-5 pb-4 border-b border-border/40">
                            {/* Upload Date */}
                            <FilterGroup label="Upload date">
                                {UPLOAD_DATE_OPTIONS.map((opt) => (
                                    <FilterChip
                                        key={opt.value}
                                        label={opt.label}
                                        active={values.uploadDate === opt.value}
                                        onClick={() =>
                                            onChange({
                                                ...values,
                                                uploadDate: values.uploadDate === opt.value ? undefined : opt.value,
                                            })
                                        }
                                    />
                                ))}
                            </FilterGroup>

                            {/* Duration */}
                            <FilterGroup label="Duration">
                                {DURATION_OPTIONS.map((opt) => (
                                    <FilterChip
                                        key={opt.value}
                                        label={opt.label}
                                        active={values.duration === opt.value}
                                        onClick={() =>
                                            onChange({
                                                ...values,
                                                duration: values.duration === opt.value ? undefined : opt.value,
                                            })
                                        }
                                    />
                                ))}
                            </FilterGroup>

                            {/* Sort By */}
                            <FilterGroup label="Sort by">
                                {SORT_OPTIONS.map((opt) => (
                                    <FilterChip
                                        key={opt.value}
                                        label={opt.label}
                                        active={values.sortBy === opt.value}
                                        onClick={() =>
                                            onChange({ ...values, sortBy: opt.value })
                                        }
                                    />
                                ))}
                            </FilterGroup>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2.5">{label}</p>
            <div className="flex flex-wrap gap-2">
                {children}
            </div>
        </div>
    );
}

function FilterChip({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all border",
                active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/20 text-foreground/80 border-border/50 hover:bg-muted/40 hover:border-border"
            )}
        >
            {label}
        </button>
    );
}
