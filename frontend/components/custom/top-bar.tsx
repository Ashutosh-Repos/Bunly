import { RabbitIcon } from "../ui/rabbit";
import Link from "next/link";

export const TopBar = ({ children }: { children?: React.ReactNode }) => {
    return (
        <header className="w-full h-14 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 bg-background/95 backdrop-blur-md border-b border-border/60 sticky top-0 z-50 shrink-0">
            <Link
                href="/"
                prefetch={false}
                className="flex items-center gap-1.5 sm:gap-2 shrink-0 select-none group cursor-pointer"
            >
                <RabbitIcon className="h-5 w-5 text-foreground transition-transform duration-300 group-hover:scale-110" />
                <span className="text-base font-bold tracking-tight text-foreground hidden sm:inline">
                    Bunly
                </span>
            </Link>

            <div className="flex items-center justify-between flex-1 gap-2 sm:gap-4 min-w-0">
                {children}
            </div>
        </header>
    );
};

