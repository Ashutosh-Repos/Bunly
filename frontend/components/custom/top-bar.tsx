import { RabbitIcon } from "../ui/rabbit";
import Link from "next/link";

export const TopBar = ({ children }: { children?: React.ReactNode }) => {
    return (
        <header className="w-full h-16 flex items-center justify-between gap-4 px-6 bg-background/95 backdrop-blur-md border-b border-border sticky top-0 z-50 shadow-xs">
            <Link
                href="/"
                prefetch={false}
                className="flex items-center gap-2 shrink-0 select-none group cursor-pointer"
            >
                <RabbitIcon className="h-6 w-6 text-foreground animate-pulse" />
                <span className="text-lg font-bold tracking-tight text-foreground">
                    Bunly
                </span>
            </Link>

            <div className="flex items-center justify-between flex-1 gap-4">
                {children}
            </div>
        </header>
    );
};
