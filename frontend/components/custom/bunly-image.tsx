"use client";

import { useState, useEffect } from "react";
import Image, { type ImageProps } from "next/image";
import { getMediaUrl, cn } from "@/lib/utils";
import { IconPhotoOff } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";

interface BunlyImageProps extends Omit<ImageProps, "src"> {
    src: string | null | undefined;
    fallbackIcon?: React.ReactNode;
    containerClassName?: string;
    objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
    priority?: boolean;
}

export function BunlyImage({
    src,
    alt,
    className,
    containerClassName,
    fallbackIcon,
    fill,
    width,
    height,
    objectFit = "cover",
    priority = false,
    ...props
}: BunlyImageProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    // Compute URL synchronously — prevents passing "" to Next.js Image during first render
    const resolvedUrl = src ? getMediaUrl(src) : "";

    // Reset error state if src changes
    useEffect(() => {
        setHasError(false);
        setIsLoading(true);
    }, [src]);

    if (!src || hasError || !resolvedUrl) {
        return (
            <div
                className={cn(
                    "flex flex-col items-center justify-center bg-muted/40",
                    fill ? "absolute inset-0" : "",
                    containerClassName,
                    className
                )}
                style={!fill ? { width, height } : undefined}
            >
                {fallbackIcon || <IconPhotoOff className="text-muted-foreground/40" size={fill ? "30%" : 24} />}
                <span className="sr-only">Image failed to load</span>
            </div>
        );
    }

    return (
        <div 
            className={cn(
                "relative overflow-hidden", 
                fill ? "h-full w-full" : "", 
                containerClassName
            )}
            style={!fill ? { width, height } : undefined}
        >
            <AnimatePresence>
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10 bg-muted animate-pulse"
                    />
                )}
            </AnimatePresence>

            <Image
                src={resolvedUrl}
                alt={alt || "Media content"}
                fill={fill}
                width={width}
                height={height}
                priority={priority}
                className={cn(
                    "transition-opacity duration-500",
                    isLoading ? "opacity-0" : "opacity-100",
                    className
                )}
                style={{ objectFit }}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                    setHasError(true);
                    setIsLoading(false);
                }}
                {...props}
            />
        </div>
    );
}
