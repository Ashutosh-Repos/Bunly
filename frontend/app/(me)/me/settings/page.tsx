"use client";

import Link from "next/link";
import {
  IconArrowLeft,
  IconLoader2,
  IconSettings,
} from "@tabler/icons-react";

import { trpc } from "@/lib/trpc-client";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import { ConnectedAccounts } from "./_components/connected-accounts";
import { Security } from "./_components/security";
import { ActiveSessions } from "./_components/active-sessions";
import { DangerZone } from "./_components/danger-zone";

export default function SettingsPage() {
  const { data: accounts, isLoading } = trpc.auth.listAccounts.useQuery();

  type AccountItem = NonNullable<typeof accounts>[number];

  // Determine if user has a credential (password-based) account
  const hasPassword =
    Array.isArray(accounts) &&
    accounts.some((acc: AccountItem) => acc.providerId === "credential");

  // Normalize accounts to the shape our components expect
  const normalizedAccounts: { id: string; providerId: string; accountId: string }[] =
    Array.isArray(accounts)
      ? accounts.map((acc: AccountItem) => ({
          id: acc.id ?? "",
          providerId: acc.providerId ?? "",
          accountId: acc.accountId ?? acc.id ?? "",
        }))
      : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full shrink-0 mt-1"
          asChild
        >
          <Link href="/me">
            <IconArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <IconSettings className="w-6 h-6 text-primary" />
            Account Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your account security, active sessions, and connected
            devices.
          </p>
        </div>
      </div>

      <Separator />

      {/* Connected Accounts */}
      <ConnectedAccounts
        accounts={normalizedAccounts}
        hasPassword={hasPassword}
      />

      {/* Security / Password */}
      <Security hasPassword={hasPassword} />

      {/* Active Sessions */}
      <ActiveSessions />

      <Separator />

      {/* Danger Zone */}
      <DangerZone />
    </div>
  );
}
