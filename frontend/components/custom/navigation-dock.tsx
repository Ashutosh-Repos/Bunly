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
        <aside className="sm:w-20 sm:h-full w-full h-16 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center sm:p-2 gap-4 sm:py-8 border-t sm:border-t-0 sm:border-r border-border sticky bottom-0 sm:top-16 z-40">
            {/* main nav */}
            <nav className="w-full h-max flex items-center justify-evenly sm:flex-col gap-3">
                {navLinks.map((item: NavItem, idx: number) => {
                    const Icon = typeof item.icon === "string" 
                        ? (STUDIO_ICONS[item.icon] || IconArrowLeft) 
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
                                        "group flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 relative border border-border/40",
                                        isActive 
                                            ? "bg-primary text-primary-foreground shadow-lg scale-105 border-primary/50" 
                                            : "hover:bg-muted text-muted-foreground/70 hover:text-foreground"
                                    )}
                                >
                                    <Icon />
                                    {isActive && (
                                        <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary rounded-full sm:block hidden shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_50%,transparent)]" />
                                    )}
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent
                                side="right"
                                className="font-extrabold text-[10px] uppercase tracking-widest bg-popover/90 backdrop-blur-xl border-border/20 text-popover-foreground py-2 px-3 rounded-lg shadow-xl"
                            >
                                {item.title}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}

                <BackButton
                    className="flex items-center justify-center w-12 h-12 rounded-2xl transition-all hover:bg-muted text-muted-foreground/60 hover:text-foreground hover:scale-105 active:scale-95"
                    iconClassName="w-5 h-5 flex-shrink-0"
                    hoverDialog
                />
            </nav>
        </aside>
    );
};

export const BackButton = ({
  className,
  hoverDialog,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
  hoverDialog?: boolean;
}) => {
  const router = useRouter();
  const pathname = usePathname();

  // Hide if on home page
  if (pathname === "/") return null;

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className={cn("relative group", className)}>
      <IconArrowLeft
        onClick={handleBack}
        className={cn(
          iconClassName,
          "cursor-pointer"
        )}
      />
      {hoverDialog && (
        <span className="w-max h-max absolute opacity-0 z-20 bg-sidebar/15 invert backdrop-blur-2xl right-0 translate-x-full py-1 px-2 text-[0.6rem] rounded-l-full rounded-r-full group-hover:opacity-100 transition-all duration-700 max-sm:hidden">
          Go back
        </span>
      )}
    </div>
  );
};
