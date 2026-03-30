"use client";

import { useState } from "react";
import { UAParser } from "ua-parser-js";
import { toast } from "sonner";
import {
  IconDeviceLaptop,
  IconDeviceMobile,
  IconWorld,
  IconLoader2,
  IconLogout,
} from "@tabler/icons-react";

import { trpc } from "@/lib/trpc-client";
import { authClient } from "@/lib/auth";
import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ActiveSessions() {
  const utils = trpc.useUtils();
  const { session: currentSession } = useSession();
  const { data: sessions, isLoading } = trpc.auth.listSessions.useQuery();
  type SessionItem = NonNullable<typeof sessions>[number];
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleRevoke = async (token: string) => {
    setLoadingId(token);
    try {
      await authClient.revokeSession({ token });
      toast.success("Session revoked");
      utils.auth.listSessions.invalidate();
    } catch {
      toast.error("Failed to revoke session");
    } finally {
      setLoadingId(null);
    }
  };

  const handleRevokeAll = async () => {
    setLoadingId("all");
    try {
      await authClient.revokeOtherSessions();
      toast.success("All other sessions signed out");
      utils.auth.listSessions.invalidate();
    } catch {
      toast.error("Failed to sign out other sessions");
    } finally {
      setLoadingId(null);
    }
  };

  const getDeviceIcon = (deviceType?: string) => {
    if (deviceType === "mobile" || deviceType === "tablet") {
      return <IconDeviceMobile className="h-5 w-5" />;
    }
    return <IconDeviceLaptop className="h-5 w-5" />;
  };

  if (isLoading) {
    return (
      <Card className="shadow-none border-border/50">
        <CardContent className="flex items-center justify-center py-12">
          <IconLoader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!sessions || sessions.length === 0) return null;

  return (
    <Card className="shadow-none border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconDeviceLaptop className="w-5 h-5 text-primary" />
          Active Sessions
        </CardTitle>
        <CardDescription>
          Manage devices where you are currently signed in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.map((session: SessionItem, i: number) => {
          const parser = new UAParser(session.userAgent || "");
          const result = parser.getResult();
          const sessionKey = session.token || session.id || `session-${i}`;
          const isCurrent = currentSession?.token === session.token;

          const browserName = result.browser.name || "Unknown Browser";
          const osName = result.os.name || "Unknown OS";
          const deviceType = result.device.type;

          return (
            <div
              key={sessionKey}
              className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
                isCurrent
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/60 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="rounded-full bg-muted/80 p-2.5 shrink-0">
                  {getDeviceIcon(deviceType)}
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">
                      {browserName} on {osName}
                    </p>
                    {isCurrent && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 shrink-0"
                      >
                        This device
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground gap-1.5 flex-wrap">
                    <IconWorld className="h-3 w-3 shrink-0 opacity-70" />
                    <span>{session.ipAddress || "Unknown IP"}</span>
                    <span className="text-border">•</span>
                    <span>
                      Last active:{" "}
                      {new Date(session.updatedAt).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {!isCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(session.token || session.id || "")}
                  disabled={
                    loadingId === (session.token || session.id) ||
                    loadingId === "all"
                  }
                  className="shrink-0 rounded-lg text-destructive hover:text-destructive"
                >
                  {loadingId === (session.token || session.id) ? (
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <IconLogout className="h-4 w-4 mr-1" />
                      Revoke
                    </>
                  )}
                </Button>
              )}
            </div>
          );
        })}

        {sessions.length > 1 && (
          <div className="flex justify-end pt-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRevokeAll}
              disabled={loadingId !== null}
              className="rounded-xl"
            >
              {loadingId === "all" && (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Sign out all other devices
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
