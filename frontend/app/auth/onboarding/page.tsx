"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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
} from "@/components/ui/card";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { IconLoader } from "@tabler/icons-react";

const onboardingSchema = z.object({
  dob: z.string().min(1, "Date of birth is required").refine(
    (val) => {
      const date = new Date(val);
      if (isNaN(date.getTime())) return false;
      const now = new Date();
      let age = now.getFullYear() - date.getFullYear();
      const monthDiff = now.getMonth() - date.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
        age--;
      }
      return age >= 13;
    },
    { message: "You must be at least 13 years old" }
  ),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { dob: "" },
  });

  function onSubmit(data: OnboardingValues) {
    startTransition(async () => {
      const { error } = await authClient.updateUser({
        dob: data.dob,
      } as Record<string, unknown>);

      if (error) {
        toast.error(error.message ?? "Failed to save date of birth");
        return;
      }

      toast.success("Welcome to Bunly!");
      router.push("/");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Complete your profile</CardTitle>
        <CardDescription>
          Just one more step — tell us your date of birth to finish setting up
          your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <Controller
            name="dob"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Date of birth</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="date"
                  aria-invalid={fieldState.invalid}
                  disabled={isPending}
                  max={new Date().toISOString().split("T")[0]}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending && <IconLoader className="size-4 animate-spin" />}
            Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
