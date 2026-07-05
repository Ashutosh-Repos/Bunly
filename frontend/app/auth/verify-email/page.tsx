"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { IconCircleCheck, IconCircleX, IconLoader } from "@tabler/icons-react";

import { authClient } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error"
  );
  const [errorMessage, setErrorMessage] = useState(
    token ? "" : "Missing verification token."
  );

  useEffect(() => {
    if (!token) return;

    async function verify() {
      const { error } = await authClient.verifyEmail({
        query: { token: token! },
      });

      if (error) {
        setStatus("error");
        setErrorMessage(
          error.message ?? "Verification failed. The link may have expired."
        );
        return;
      }

      setStatus("success");
    }

    verify();
  }, [token]);

  return (
    <Card>
      <CardHeader className="items-center text-center">
        {status === "loading" && (
          <>
            <IconLoader className="text-muted-foreground size-10 animate-spin" />
            <CardTitle className="text-lg">Verifying your email…</CardTitle>
            <CardDescription>
              Please wait while we verify your email address.
            </CardDescription>
          </>
        )}
        {status === "success" && (
          <>
            <div className="bg-primary/10 mb-2 flex size-12 items-center justify-center rounded-full">
              <IconCircleCheck className="text-primary size-6" />
            </div>
            <CardTitle className="text-lg">Email verified!</CardTitle>
            <CardDescription>
              Your email has been verified. You&apos;re all set.
            </CardDescription>
          </>
        )}
        {status === "error" && (
          <>
            <div className="bg-destructive/10 mb-2 flex size-12 items-center justify-center rounded-full">
              <IconCircleX className="text-destructive size-6" />
            </div>
            <CardTitle className="text-lg">Verification failed</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </>
        )}
      </CardHeader>
      {status !== "loading" && (
        <CardContent>
          {status === "success" ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                router.push("/");
                router.refresh();
              }}
            >
              Continue to app
            </Button>
          ) : (
            <Button asChild variant="outline" size="lg" className="w-full">
              <Link href="/auth/login">Go to sign in</Link>
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
