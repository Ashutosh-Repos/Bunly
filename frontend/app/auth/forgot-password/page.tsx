"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  CardFooter,
} from "@/components/ui/card";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { IconLoader, IconMailCheck } from "@tabler/icons-react";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(data: ForgotPasswordValues) {
    startTransition(async () => {
      const { error } = await authClient.requestPasswordReset({
        email: data.email,
      });

      if (error) {
        toast.error(error.message ?? "Failed to send reset email");
        return;
      }

      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <div className="bg-primary/10 mb-2 flex size-12 items-center justify-center rounded-full">
            <IconMailCheck className="text-primary size-6" />
          </div>
          <CardTitle className="text-lg">Check your email</CardTitle>
          <CardDescription>
            If an account exists with that email, we&apos;ve sent a password
            reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href="/auth/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Forgot password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a reset link
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={fieldState.invalid}
                  disabled={isPending}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending && <IconLoader className="size-4 animate-spin" />}
            Send reset link
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <Link
          href="/auth/login"
          className="text-muted-foreground hover:text-primary text-sm"
        >
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
