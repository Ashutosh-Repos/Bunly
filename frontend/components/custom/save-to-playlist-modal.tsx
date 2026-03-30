"use client";

import { useState, ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc-client";
import { IconPlus, IconCheck } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SaveToPlaylistModalProps {
    videoId: string;
    channelId?: string;
    trigger?: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function SaveToPlaylistModal({ 
    videoId,
    channelId,
    trigger,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
}: SaveToPlaylistModalProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? controlledOnOpenChange : setInternalOpen;
    
    const utils = trpc.useUtils();
    
    // Fetch playlists with a specific flag if they contain the videoId
    const { data, isLoading } = trpc.playlist.getUserPlaylists.useQuery(
        { videoId },
        { enabled: open }
    );

    const addMutation = trpc.playlist.addVideoToPlaylist.useMutation({
        onMutate: async ({ playlistId }) => {
            await utils.playlist.getUserPlaylists.cancel({ videoId });
            const prev = utils.playlist.getUserPlaylists.getData({ videoId });
            if (prev) {
                utils.playlist.getUserPlaylists.setData(
                    { videoId },
                    {
                        ...prev,
                        playlists: prev.playlists.map(p => 
                            p.id === playlistId ? { ...p, containsVideo: true, videoCount: p.videoCount + 1 } : p
                        )
                    }
                );
            }
            return { prev };
        },
        onError: (err, _, context) => {
            if (context?.prev) utils.playlist.getUserPlaylists.setData({ videoId }, context.prev);
            toast.error(err.message);
        },
        onSettled: () => {
            utils.playlist.getUserPlaylists.invalidate({ videoId });
        }
    });

    const removeMutation = trpc.playlist.removeVideoFromPlaylist.useMutation({
        onMutate: async ({ playlistId }) => {
            await utils.playlist.getUserPlaylists.cancel({ videoId });
            const prev = utils.playlist.getUserPlaylists.getData({ videoId });
            if (prev) {
                utils.playlist.getUserPlaylists.setData(
                    { videoId },
                    {
                        ...prev,
                        playlists: prev.playlists.map(p => 
                            p.id === playlistId ? { ...p, containsVideo: false, videoCount: p.videoCount - 1 } : p
                        )
                    }
                );
            }
            return { prev };
        },
        onError: (err, _, context) => {
            if (context?.prev) utils.playlist.getUserPlaylists.setData({ videoId }, context.prev);
            toast.error(err.message);
        },
        onSettled: () => {
            utils.playlist.getUserPlaylists.invalidate({ videoId });
        }
    });

    const createMutation = trpc.playlist.createPlaylist.useMutation({
        onSuccess: (res) => {
            // Immediately add to the newly created playlist
            addMutation.mutate({ playlistId: res.playlist.id, videoId });
            setNewTitle("");
            setShowCreate(false);
        },
        onError: (err) => toast.error(err.message)
    });

    const togglePlaylist = (playlistId: string, contains: boolean) => {
        if (contains) {
            removeMutation.mutate({ playlistId, videoId });
        } else {
            addMutation.mutate({ playlistId, videoId });
        }
    };

    const handleCreate = () => {
        if (!newTitle.trim()) return;
        createMutation.mutate({ 
            title: newTitle,
            channelId: channelId || undefined,
        });
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen?.(v); if (!v) setShowCreate(false); }}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Save to playlist</DialogTitle>
                </DialogHeader>
                
                {isLoading ? (
                    <div className="py-8 flex justify-center">
                        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <ScrollArea className="max-h-[300px] w-full pr-4 my-2">
                        <div className="flex flex-col gap-1">
                            {data?.playlists.map((pl) => (
                                <button 
                                    key={pl.id} 
                                    onClick={() => togglePlaylist(pl.id, pl.containsVideo)}
                                    disabled={addMutation.isPending || removeMutation.isPending}
                                    className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors w-full text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div 
                                        className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                            pl.containsVideo 
                                                ? "bg-primary border-primary text-primary-foreground" 
                                                : "border-input bg-transparent"
                                        }`}
                                    >
                                        {pl.containsVideo && <IconCheck size={14} stroke={3} />}
                                    </div>
                                    <span className="flex-1 text-sm font-medium leading-none select-none">
                                        {pl.title}
                                    </span>
                                </button>
                            ))}
                            {data?.playlists.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    You don&apos;t have any playlists yet.
                                </p>
                            )}
                        </div>
                    </ScrollArea>
                )}

                <div className="pt-2 border-t">
                    {!showCreate ? (
                        <button 
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors p-2 w-full justify-center"
                        >
                            <IconPlus size={18} />
                            Create new playlist
                        </button>
                    ) : (
                        <div className="flex flex-col gap-3 py-2 animate-in fade-in slide-in-from-bottom-2">
                            <Input 
                                placeholder="Enter playlist title..." 
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                autoFocus
                                className="h-9"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleCreate();
                                }}
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                                <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim() || createMutation.isPending}>
                                    Create
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
