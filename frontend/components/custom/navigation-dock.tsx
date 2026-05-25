"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { 
    IconArrowLeft,
    IconLayoutDashboard,
    IconVideo,
    IconMessageCircle,
    IconUsers,
    IconSettings,
    IconLogout,
    IconUser,
    IconHistory,
    IconBell
} from "@tabler/icons-react";

const STUDIO_ICONS: Record<string, React.ElementType> = {
    dashboard: IconLayoutDashboard,
    content: IconVideo,
    comments: IconMessageCircle,
    community: IconUsers,
    settings: IconSettings,
    exit: IconLogout,
    profile: IconUser,
    history: IconHistory,
    bell: IconBell,
};

export interface NavItem {
    icon: React.ElementType | string;
    title: string;
    href: string;
}

export const NavigationDock = ({ navLinks }: { navLinks: NavItem[] }) => {
    const pathname = usePathname();

    return (
        <aside className="sm:w-16 sm:h-full w-full h-14 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center sm:py-6 border-t sm:border-t-0 sm:border-r border-border/60 sticky bottom-0 sm:top-0 z-40">
            {/* main nav */}
            <nav className="w-full h-max flex items-center justify-evenly sm:flex-col gap-1.5 sm:gap-1.5 px-2 sm:px-0">
                {navLinks.map((item: NavItem, idx: number) => {
                    const Icon = typeof item.icon === "string" 
                        ? (STUDIO_ICONS[item.icon] || IconLayoutDashboard) 
                        : item.icon;
                    const hasLongerMatch = navLinks.some(link => 
                        link.href !== item.href && 
                        link.href.startsWith(item.href + "/") && 
                        pathname.startsWith(link.href)
                    );
                    const isActive = hasLongerMatch 
                        ? false 
                        : item.href === "/"
                            ? pathname === "/"
                            : pathname === item.href || pathname.startsWith(item.href + "/");

                    return (
                        <Tooltip key={idx + item.title}>
                            <TooltipTrigger asChild>
                                <Link
                                    prefetch={false}
                                    href={item.href}
                                    className={cn(
                                        "group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                                        isActive 
                                            ? "bg-foreground/10 text-foreground" 
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <Icon className="h-[18px] w-[18px]" size={18} />
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-foreground rounded-r-full hidden sm:block" />
                                    )}
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent
                                side="right"
                                className="text-xs font-semibold bg-popover/95 backdrop-blur-xl border-border/40 text-popover-foreground py-1.5 px-3 rounded-lg shadow-lg"
                            >
                                {item.title}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}

                <BackButton
                    className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 hover:bg-muted text-muted-foreground hover:text-foreground"
                    iconClassName="h-[18px] w-[18px]"
                    hoverDialog
                />
            </nav>
        </aside>
    );
};

export const BackButton = ({
    className,
    iconClassName,
    hoverDialog = false,
}: {
    className?: string;
    iconClassName?: string;
    hoverDialog?: boolean;
}) => {
    const router = useRouter();

    const button = (
        <button
            onClick={() => router.back()}
            className={cn("cursor-pointer", className)}
            aria-label="Go back"
        >
            <IconArrowLeft className={iconClassName} />
        </button>
    );

    if (!hoverDialog) return button;

    return (
        <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent
                side="right"
                className="text-xs font-semibold bg-popover/95 backdrop-blur-xl border-border/40 text-popover-foreground py-1.5 px-3 rounded-lg shadow-lg"
            >
                Go back
            </TooltipContent>
        </Tooltip>
    );
};
