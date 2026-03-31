import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getMediaUrl(key: string | null | undefined) {
    if (!key) return "";
    if (key.startsWith("http")) return key;
    if (key.startsWith("/")) return key;
    if (key.startsWith("blob:")) return key;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const cleanKey = key.replace(/^\/+/, "");

    // Use absolute wildcard routing so browser URL resolution math works correctly.
    // Replace spaces and URI encode standard components, but keep slashes intact.
    const encodedKey = cleanKey.split("/").map(encodeURIComponent).join("/");
    return `${baseUrl}/api/media/${encodedKey}`;
}

export function formatDuration(seconds: number | null | undefined): string {
    if (seconds == null || isNaN(seconds) || seconds < 0) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
}