"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc-client";
import { IconPlaylist, IconPlus, IconCheck } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

export function SaveToPlaylistModal({ videoId }: { videoId: string }) {
    const [open, setOpen] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    
    const utils = trpc.useUtils();
    
    // Fetch playlists with a specific flag if they contain the videoId
    const { data, isLoading } = trpc.playlist.getUserPlaylists.useQuery(
        { videoId },
        { enabled: open }
    );

    const addMutation = trpc.playlist.addVideoToPlaylist.useMutation({
        onSuccess: () => {
            utils.playlist.getUserPlaylists.invalidate({ videoId });
            toast.success("Added to playlist");
        },
        onError: (err) => toast.error(err.message)
    });

    const removeMutation = trpc.playlist.removeVideoFromPlaylist.useMutation({
        onSuccess: () => {
            utils.playlist.getUserPlaylists.invalidate({ videoId });
            toast.success("Removed from playlist");
        },
        onError: (err) => toast.error(err.message)
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
        createMutation.mutate({ title: newTitle });
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setShowCreate(false); }}>
            <DialogTrigger asChild>
                <Button variant="secondary" className="rounded-full gap-2 shadow-sm border border-border/10 hover:bg-muted/80 px-4">
                    <IconPlaylist size={18} />
                    <span className="font-medium max-sm:hidden">Save</span>
                </Button>
            </DialogTrigger>
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
                                    className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors w-full text-left"
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
