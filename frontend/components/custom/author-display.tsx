import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { IconCircleCheckFilled } from "@tabler/icons-react";
import { getMediaUrl } from "@/lib/utils";

export interface AuthorDTO {
    id: string;
    name: string | null;
    handle: string | null;
    image: string | null;
    isVerified?: boolean;
}

interface AuthorAvatarProps {
    author: AuthorDTO | null | undefined;
    className?: string; // used to set width/height
    disableLink?: boolean;
}

export function AuthorAvatar({ author, className = "w-9 h-9", disableLink = false }: AuthorAvatarProps) {
    const handleHref = author?.handle ? `/@${author.handle}` : "#";
    const nameFallback = (author?.name || "C").slice(0, 2).toUpperCase();

    const avatarElement = (
        <Avatar className={`${className} border shadow-xs`}>
            {author?.image && (
                <AvatarImage 
                    src={getMediaUrl(author.image)} 
                    alt={author.name ?? ""} 
                    className="object-cover"
                />
            )}
            <AvatarFallback className="text-[10px] font-bold bg-muted text-muted-foreground">
                {nameFallback}
            </AvatarFallback>
        </Avatar>
    );

    if (disableLink) {
        return avatarElement;
    }

    return (
        <Link href={handleHref} className="shrink-0 flex">
            {avatarElement}
        </Link>
    );
}

interface AuthorNameProps {
    author: AuthorDTO | null | undefined;
    className?: string;
    showHandle?: boolean;
    disableLink?: boolean;
}

export function AuthorName({ author, className = "", showHandle = false, disableLink = false }: AuthorNameProps) {
    const handleHref = author?.handle ? `/@${author.handle}` : "#";
    const displayName = showHandle && author?.handle ? `@${author.handle}` : (author?.name || "Unknown User");

    if (disableLink) {
        return (
            <span className={`flex items-center gap-1 ${className}`}>
                <span className="truncate">{displayName}</span>
                {author?.isVerified && (
                    <IconCircleCheckFilled size={14} className="text-muted-foreground shrink-0" />
                )}
            </span>
        );
    }

    return (
        <Link href={handleHref} className={`flex items-center gap-1 hover:text-foreground hover:underline decoration-foreground/30 transition-colors ${className}`}>
            <span className="truncate">{displayName}</span>
            {author?.isVerified && (
                <IconCircleCheckFilled size={14} className="text-muted-foreground shrink-0" />
            )}
        </Link>
    );
}
