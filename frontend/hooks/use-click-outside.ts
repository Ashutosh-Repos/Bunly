"use client";

import { RefObject, useEffect } from "react";

/**
 * Detects clicks outside a referenced element and fires a callback.
 *
 * Usage:
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useClickOutside(ref, () => setOpen(false));
 * ```
 */
export const useClickOutside = (
    ref: RefObject<HTMLElement | undefined | null>,
    callback: () => void,
    addEventListener = true,
) => {
    useEffect(() => {
        if (!addEventListener) return;

        const handleClick = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as HTMLElement)) {
                callback();
            }
        };

        document.addEventListener("click", handleClick);
        return () => {
            document.removeEventListener("click", handleClick);
        };
    }, [ref, callback, addEventListener]);
};
