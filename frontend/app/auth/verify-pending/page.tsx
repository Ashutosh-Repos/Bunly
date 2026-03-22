"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { IconMailCheck, IconLoader } from "@tabler/icons-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";

function VerifyPendingContent() {
  const searchParams = useSearchParams();
  const emailFromParams = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailFromParams);
  const [isPending, startTransition] = useTransition();
  const [emailError, setEmailError] = useState("");

  function handleResend() {
    setEmailError("");

    if (!email || !email.includes("@")) {
      setEmailError("Please enter a valid email address");
      return;
    }

    startTransition(async () => {
      const { error } = await authClient.sendVerificationEmail({
        email,
      });

      if (error) {
        toast.error(
          error.message ?? "Failed to resend verification email"
        );
        return;
      }

      toast.success("Verification email sent! Check your inbox.");
    });
  }

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="bg-primary/10 mb-2 flex size-12 items-center justify-center rounded-full">
          <IconMailCheck className="text-primary size-6" />
        </div>
        <CardTitle className="text-lg">Check your email</CardTitle>
        <CardDescription>
          We&apos;ve sent a verification link to your email address. Click the
          link to verify your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field data-invalid={!!emailError}>
          <FieldLabel htmlFor="resend-email">Email address</FieldLabel>
          <Input
            id="resend-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isPending}
            aria-invalid={!!emailError}
          />
          {emailError && <FieldError>{emailError}</FieldError>}
        </Field>

        <Button
          size="lg"
          className="w-full"
          disabled={isPending}
          onClick={handleResend}
        >
          {isPending && <IconLoader className="size-4 animate-spin" />}
          Resend verification email
        </Button>

        <p className="text-muted-foreground text-center text-xs">
          Didn&apos;t receive the email? Check your spam folder or enter your
          email and click resend.
        </p>

        <div className="text-center">
          <Link
            href="/auth/login"
            className="text-muted-foreground hover:text-primary text-sm"
          >
            Back to sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyPendingPage() {
  return (
    <Suspense>
      <VerifyPendingContent />
    </Suspense>
  );
}
