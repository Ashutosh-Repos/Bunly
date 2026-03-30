"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { authClient } from "@/lib/auth";
import { toast } from "sonner";
import {
  IconBrandGoogle,
  IconBrandGithub,
  IconLoader2,
  IconLink,
  IconLinkOff,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Account {
  id: string;
  providerId: string;
  accountId: string;
}

interface ConnectedAccountsProps {
  accounts: Account[];
  hasPassword: boolean;
}

const PROVIDERS = [
  {
    id: "google",
    name: "Google",
    icon: IconBrandGoogle,
    description: "Sign in with your Google account",
  },
  {
    id: "github",
    name: "GitHub",
    icon: IconBrandGithub,
    description: "Sign in with your GitHub account",
  },
] as const;

export function ConnectedAccounts({
  accounts,
  hasPassword,
}: ConnectedAccountsProps) {
  const utils = trpc.useUtils();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const isConnected = (providerId: string) =>
    accounts.some((acc) => acc.providerId === providerId);

  const handleLink = async (provider: "google" | "github") => {
    setLoadingProvider(provider);
    try {
      await authClient.linkSocial({
        provider,
        callbackURL: "/me/settings",
      });
      // The client SDK automatically redirects the browser.
    } catch {
      toast.error(`Failed to link ${provider} account`);
      setLoadingProvider(null);
    }
  };

  const handleUnlink = async (provider: string) => {
    const oauthAccounts = accounts.filter(
      (a) => a.providerId !== "credential"
    );
    if (!hasPassword && oauthAccounts.length <= 1) {
      toast.error(
        "Cannot disconnect your only sign-in method. Please set a password first."
      );
      return;
    }
    
    setLoadingProvider(provider);
    try {
      await authClient.unlinkAccount({
        providerId: provider,
      });
      toast.success("Account disconnected");
      utils.auth.listAccounts.invalidate();
    } catch {
      toast.error("Failed to disconnect account");
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <Card className="shadow-none border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconLink className="w-5 h-5 text-primary" />
          Connected Accounts
        </CardTitle>
        <CardDescription>
          Connect your accounts for faster sign-in and account recovery.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {PROVIDERS.map((provider) => {
          const connected = isConnected(provider.id);
          const isLoading = loadingProvider === provider.id;
          const Icon = provider.icon;

          return (
            <div
              key={provider.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-4 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/80">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">{provider.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {connected ? (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Connected
                      </Badge>
                    ) : (
                      provider.description
                    )}
                  </p>
                </div>
              </div>

              {connected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnlink(provider.id)}
                  disabled={isLoading}
                  className="rounded-lg"
                >
                  {isLoading ? (
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <IconLinkOff className="h-4 w-4 mr-1.5" />
                      Disconnect
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() =>
                    handleLink(provider.id as "google" | "github")
                  }
                  disabled={isLoading}
                  className="rounded-lg"
                >
                  {isLoading ? (
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Connect"
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
