"use client";

import { trpc } from "@/lib/trpc-client";
import { format } from "date-fns";
import { 
    IconPlaylist, 
    IconTrash, 
    IconEdit, 
    IconDotsVertical,
    IconLoader2,
    IconEye,
    IconEyeOff
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import Image from "next/image";
import { getMediaUrl } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function StudioPlaylistsTab({ channelId, search }: { channelId: string, search: string }) {
    const utils = trpc.useUtils();
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingPlaylist, setEditingPlaylist] = useState<{ id: string, title: string, visibility: "PUBLIC" | "PRIVATE" } | null>(null);

    const { data: playlistsData, isLoading } = trpc.playlist.getPublicChannelPlaylists.useQuery(
        { channelId },
        { enabled: !!channelId }
    );

    // Filter by search client-side since this lists all
    const playlists = (playlistsData?.playlists || []).filter(p => 
        search ? p.title.toLowerCase().includes(search.toLowerCase()) : true
    );

    const updateMutation = trpc.playlist.updatePlaylistDetails.useMutation({
        onSuccess: () => {
            toast.success("Playlist updated");
            utils.playlist.getPublicChannelPlaylists.invalidate({ channelId });
            setEditModalOpen(false);
        },
        onError: (err) => toast.error(err.message)
    });

    const deleteMutation = trpc.playlist.deletePlaylist.useMutation({
        onSuccess: () => {
            toast.success("Playlist deleted");
            utils.playlist.getPublicChannelPlaylists.invalidate({ channelId });
        },
        onError: (err) => toast.error(err.message)
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleEdit = (e: React.MouseEvent, p: any) => {
        e.stopPropagation();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setEditingPlaylist({ id: p.id, title: p.title, visibility: p.visibility as any });
        setEditModalOpen(true);
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this playlist?")) {
            deleteMutation.mutate({ playlistId: id });
        }
    };

    const submitEdit = () => {
        if (!editingPlaylist || !editingPlaylist.title.trim()) return;
        updateMutation.mutate({ 
            playlistId: editingPlaylist.id, 
            title: editingPlaylist.title,
            visibility: editingPlaylist.visibility
        });
    };

    return (
        <>
            <div className="border rounded-lg overflow-hidden bg-card">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[400px]">Playlist</TableHead>
                            <TableHead>Visibility</TableHead>
                            <TableHead>Last updated</TableHead>
                            <TableHead className="text-right">Video count</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                                    <IconLoader2 className="animate-spin mx-auto mb-2" />
                                    Loading playlists...
                                </TableCell>
                            </TableRow>
                        ) : playlists.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <IconPlaylist size={32} className="opacity-20 mb-2" />
                                        <p>No playlists found</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            playlists.map((playlist) => (
                                <TableRow 
                                    key={playlist.id} 
                                    className="group cursor-default hover:bg-muted/30 transition-colors"
                                >
                                    <TableCell className="font-medium">
                                        <div className="flex gap-4 items-center">
                                            <div className="relative aspect-video w-28 bg-muted rounded overflow-hidden shrink-0 flex items-center justify-center">
                                                {playlist.firstVideoThumbnail ? (
                                                    <Image 
                                                        src={getMediaUrl(playlist.firstVideoThumbnail)} 
                                                        alt={playlist.title} 
                                                        fill
                                                        className="object-cover"
                                                        sizes="(max-width: 768px) 112px, 112px"
                                                    />
                                                ) : (
                                                    <IconPlaylist size={20} className="text-muted-foreground/30" />
                                                )}
                                                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/80 to-transparent flex items-end justify-end p-1 px-1.5">
                                                    <span className="text-white text-[10px] font-medium flex items-center gap-1">
                                                        <IconPlaylist size={10} />
                                                        {playlist._count.playlist_videos}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="truncate block font-semibold text-sm mb-0.5" title={playlist.title}>
                                                    {playlist.title}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-xs capitalize font-medium flex items-center gap-1 ${playlist.visibility === "PUBLIC" ? "text-green-500" : "text-muted-foreground"}`}>
                                            {playlist.visibility === "PUBLIC" ? <IconEye size={14} /> : <IconEyeOff size={14} />}
                                            {playlist.visibility.toLowerCase()}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        <div className="flex flex-col text-xs text-muted-foreground">
                                            <span>{format(new Date(playlist.updatedAt), "MMM d, yyyy")}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                        {playlist._count.playlist_videos}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                                                    <span className="sr-only">Open menu</span>
                                                    <IconDotsVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/playlist/${playlist.id}`} className="cursor-pointer">
                                                        <IconPlaylist className="mr-2 h-4 w-4" />
                                                        View on Bunly
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => handleEdit(e, playlist)}>
                                                    <IconEdit className="mr-2 h-4 w-4" />
                                                    Edit title & visibility
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={(e) => handleDelete(e, playlist.id)}
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    <IconTrash className="mr-2 h-4 w-4" />
                                                    Delete playlist
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Playlist</DialogTitle>
                    </DialogHeader>
                    {editingPlaylist && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Title</label>
                                <Input 
                                    value={editingPlaylist.title}
                                    onChange={e => setEditingPlaylist({ ...editingPlaylist, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Visibility</label>
                                <select 
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                    value={editingPlaylist.visibility}
                                    onChange={e => setEditingPlaylist({ ...editingPlaylist, visibility: e.target.value as "PUBLIC" | "PRIVATE" })}
                                >
                                    <option value="PUBLIC">Public</option>
                                    <option value="PRIVATE">Private</option>
                                </select>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button disabled={updateMutation.isPending || !editingPlaylist.title.trim()} onClick={submitEdit}>
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
