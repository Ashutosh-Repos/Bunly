import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMediaUrl } from "@/lib/utils";
import { IconCircleCheckFilled } from "@tabler/icons-react";

export interface AuthorDTO {
    id: string;
    name: string;
    handle: string;
    image: string | null;
    isVerified?: boolean;
}

interface AuthorAvatarProps {
    author: AuthorDTO | null | undefined;
    className?: string; // used to set width/height
}

export function AuthorAvatar({ author, className = "w-9 h-9" }: AuthorAvatarProps) {
    const handleHref = author?.handle ? `/@${author.handle}` : "#";
    const nameFallback = (author?.name || "C").slice(0, 2).toUpperCase();

    if (!author?.image) {
        return (
            <Link href={handleHref} className="shrink-0 flex">
                <div className={`${className} rounded-full bg-primary/10 flex items-center justify-center border shadow-sm`}>
                    <span className="text-primary text-[10px] font-bold">
                        {nameFallback}
                    </span>
                </div>
            </Link>
        );
    }

    return (
        <Link href={handleHref} className="shrink-0 flex">
            <Avatar className={`${className} border shadow-sm`}>
                <AvatarImage src={getMediaUrl(author.image)} alt={author.name} />
                <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                    {nameFallback}
                </AvatarFallback>
            </Avatar>
        </Link>
    );
}

interface AuthorNameProps {
    author: AuthorDTO | null | undefined;
    className?: string;
    showHandle?: boolean;
}

export function AuthorName({ author, className = "", showHandle = false }: AuthorNameProps) {
    const handleHref = author?.handle ? `/@${author.handle}` : "#";
    const displayName = showHandle && author?.handle ? `@${author.handle}` : (author?.name || "Unknown User");

    return (
        <Link href={handleHref} className={`flex items-center gap-1 hover:text-foreground hover:underline decoration-foreground/30 transition-colors ${className}`}>
            <span className="truncate">{displayName}</span>
            {author?.isVerified && (
                <IconCircleCheckFilled size={14} className="text-muted-foreground shrink-0" />
            )}
        </Link>
    );
}
