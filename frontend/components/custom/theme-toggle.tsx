"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { IconSun, IconMoon } from "@tabler/icons-react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
    className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
    const { setTheme, resolvedTheme } = useTheme();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const isDark = resolvedTheme === "dark";

    const toggleTheme = useCallback(async () => {
        if (!buttonRef.current) return;

        const newTheme = isDark ? "light" : "dark";

        // Fallback for browsers that don't support View Transitions
        if (!document.startViewTransition) {
            flushSync(() => {
                setTheme(newTheme);
            });
            return;
        }

        const { top, left, width, height } = buttonRef.current.getBoundingClientRect();
        const x = left + width / 2;
        const y = top + height / 2;
        const endRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );

        const transition = document.startViewTransition(() => {
            flushSync(() => {
                setTheme(newTheme);
            });
        });

        await transition.ready;

        document.documentElement.animate(
            {
                clipPath: [
                    `circle(0px at ${x}px ${y}px)`,
                    `circle(${endRadius}px at ${x}px ${y}px)`,
                ],
            },
            {
                duration: 400,
                easing: "ease-in-out",
                pseudoElement: "::view-transition-new(root)",
            }
        );
    }, [isDark, setTheme]);

    return (
        <button
            ref={buttonRef}
            onClick={toggleTheme}
            className={cn(
                "relative inline-flex items-center justify-center rounded-full w-9 h-9 transition-colors cursor-pointer hover:bg-muted",
                className
            )}
            aria-label="Toggle theme"
        >
            {!mounted ? (
                <div className="h-[1.1rem] w-[1.1rem]" />
            ) : isDark ? (
                <IconSun className="h-[1.1rem] w-[1.1rem] text-foreground" />
            ) : (
                <IconMoon className="h-[1.1rem] w-[1.1rem] text-foreground" />
            )}
            <span className="sr-only">Toggle theme</span>
        </button>
    );
}

