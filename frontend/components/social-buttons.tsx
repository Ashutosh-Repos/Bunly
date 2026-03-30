"use client";

import { useState } from "react";
import { IconBrandGoogle, IconBrandGithub, IconLoader } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth";

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";
const GITHUB_ENABLED = process.env.NEXT_PUBLIC_GITHUB_ENABLED === "true";

interface SocialButtonsProps {
  callbackURL?: string;
}

export function SocialButtons({ callbackURL = "/" }: SocialButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  if (!GOOGLE_ENABLED && !GITHUB_ENABLED) return null;

  const handleSocial = (provider: "google" | "github") => {
    setLoadingProvider(provider);
    authClient.signIn.social({ provider, callbackURL });
    // No await — browser redirects away to OAuth provider
  };

  return (
    <div className="flex flex-col gap-2">
      {GOOGLE_ENABLED && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={!!loadingProvider}
          onClick={() => handleSocial("google")}
        >
          {loadingProvider === "google" ? (
            <IconLoader className="size-4 animate-spin" />
          ) : (
            <IconBrandGoogle className="size-4" />
          )}
          Continue with Google
        </Button>
      )}
      {GITHUB_ENABLED && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={!!loadingProvider}
          onClick={() => handleSocial("github")}
        >
          {loadingProvider === "github" ? (
            <IconLoader className="size-4 animate-spin" />
          ) : (
            <IconBrandGithub className="size-4" />
          )}
          Continue with GitHub
        </Button>
      )}
    </div>
  );
}
