"use client";

import { trpc } from "@/lib/trpc-client";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IconAlertTriangle, IconCheck, IconTrash, IconEye, IconRefresh } from "@tabler/icons-react";
import { toast } from "sonner";
import Link from "next/link";
enum AdminContentStatus {
    NORMAL = "NORMAL",
    AGE_RESTRICTED = "AGE_RESTRICTED",
    SENSITIVE_CONTENT = "SENSITIVE_CONTENT",
    TAKEN_DOWN = "TAKEN_DOWN",
    COPYRIGHT_BLOCKED = "COPYRIGHT_BLOCKED"
}

export default function AdminDashboardPage() {
    const { data: statsData, refetch: refetchStats } = trpc.admin.getStats.useQuery();
    
    // We fetch reports to review
    const { data: reportsData, refetch: refetchReports, isLoading } = trpc.report.list.useInfiniteQuery(
        { status: "PENDING", limit: 20 },
        { getNextPageParam: (l) => l.nextCursor }
    );

    const reports = reportsData?.pages.flatMap(p => p.items) || [];

    const reviewReport = trpc.report.review.useMutation({
        onSuccess: () => {
            toast.success("Report actioned successfully.");
            refetchReports();
            refetchStats();
        }
    });

    const setVideoAdminStatus = trpc.admin.setVideoAdminStatus.useMutation();

    const handleAction = (reportId: string, videoId: string | null, action: "DISMISS" | "REMOVE_VIDEO") => {
        if (action === "DISMISS") {
            reviewReport.mutate({ reportId, status: "DISMISSED" });
        } else if (action === "REMOVE_VIDEO" && videoId) {
            if (confirm("Are you sure you want to administratively block this video globally?")) {
                setVideoAdminStatus.mutate(
                    { videoId, status: AdminContentStatus.TAKEN_DOWN, reason: "TOS_VIOLATION" },
                    {
                        onSuccess: () => {
                            toast.success("Video blocked globally.");
                            reviewReport.mutate({ reportId, status: "RESOLVED" });
                        }
                    }
                );
            }
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter uppercase mb-2">Trust & Safety</h1>
                    <p className="text-muted-foreground">Review flagged content and manage platform integrity.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { refetchStats(); refetchReports(); }}>
                    <IconRefresh size={16} className="mr-2" /> Refresh
                </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-6 border-border/30 bg-muted/10">
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-1">Pending Reports</div>
                    <div className="text-3xl font-black">{statsData?.pendingReports || 0}</div>
                </Card>
                <Card className="p-6 border-border/30 bg-muted/10">
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-1">Total Users</div>
                    <div className="text-3xl font-black">{statsData?.users?.toLocaleString() || 0}</div>
                </Card>
                <Card className="p-6 border-border/30 bg-muted/10">
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-1">Total Videos</div>
                    <div className="text-3xl font-black">{statsData?.videos?.toLocaleString() || 0}</div>
                </Card>
                <Card className="p-6 border-border/30 bg-muted/10">
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-1">Active Strikes</div>
                    <div className="text-3xl font-black">{statsData?.activeStrikes || 0}</div>
                </Card>
            </div>

            {/* Reports Queue */}
            <div className="border border-border/40 bg-surface-1 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border/20 bg-muted/30 font-bold flex items-center gap-2">
                    <IconAlertTriangle className="text-amber-500" size={18} /> Review Queue
                </div>
                
                <div className="divide-y divide-border/20">
                    {isLoading ? (
                        <div className="p-12 text-center text-muted-foreground animate-pulse">Loading queue...</div>
                    ) : reports.length === 0 ? (
                        <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center">
                            <IconCheck size={48} className="text-green-500/30 mb-4" />
                            <p className="font-bold text-lg">Inbox Zero</p>
                            <p className="text-sm">There are no pending reports to review.</p>
                        </div>
                    ) : (
                        reports.map((report) => (
                            <div key={report.id} className="p-5 flex flex-col md:flex-row gap-6 hover:bg-muted/10 transition-colors">
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Badge variant="destructive" className="uppercase font-bold tracking-wider text-[10px] rounded-sm truncate">
                                            {report.reason}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground font-semibold">
                                            Reported {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                    
                                    {report.description && (
                                        <div className="p-3 bg-muted/20 border-l-2 border-amber-500/50 text-sm rounded-r-md">
                                            <span className="font-bold block text-xs mb-1 text-muted-foreground">USER NOTE:</span>
                                            {report.description}
                                        </div>
                                    )}

                                    {/* Target Information */}
                                    <div className="text-sm">
                                        {report.videoId ? (
                                            <div className="flex items-center gap-3 bg-background border border-border/30 p-2 rounded-lg max-w-sm">
                                                <div className="bg-muted w-16 h-10 rounded flex items-center justify-center shrink-0">
                                                    <IconEye size={16} className="text-muted-foreground" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-xs truncate">Video ID: {report.videoId}</p>
                                                    <Link href={`/watch/${report.videoId}`} target="_blank" className="text-[11px] text-primary hover:underline">
                                                        Open video →
                                                    </Link>
                                                </div>
                                            </div>
                                        ) : report.commentId ? (
                                            <p className="font-semibold">Target: Comment {report.commentId}</p>
                                        ) : (
                                            <p className="font-semibold">Target: User {report.reportedUserId}</p>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex flex-row md:flex-col gap-2 shrink-0 justify-center">
                                    <Button 
                                        variant="default" 
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700" 
                                        onClick={() => handleAction(report.id, report.videoId, "DISMISS")}
                                    >
                                        <IconCheck size={16} className="mr-2" /> Dismiss
                                    </Button>
                                    
                                    {report.videoId && (
                                        <Button 
                                            variant="destructive" 
                                            size="sm" 
                                            onClick={() => handleAction(report.id, report.videoId, "REMOVE_VIDEO")}
                                        >
                                            <IconTrash size={16} className="mr-2" /> Block Video
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
