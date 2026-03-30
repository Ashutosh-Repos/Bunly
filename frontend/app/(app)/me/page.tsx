"use client";

import { useEffect } from "react";
import { useForm, Controller, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import {
  IconLoader2,
  IconLink,
  IconMapPin,
  IconDeviceTv,
  IconPlus,
  IconUsers,
  IconTrash,
  IconWorld,
  IconMail,
  IconPhone,
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconCake,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";

import { trpc } from "@/lib/trpc-client";
import {
  updateUserSchema,
  socialLinkSchema,
  type UpdateUserFormValues,
} from "@/lib/schema";
import { getMediaUrl } from "@/lib/utils";

import ImageUpload from "@/components/custom/image-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SOCIAL_PLATFORMS = [
  { value: "twitter", label: "Twitter / X" },
  { value: "instagram", label: "Instagram" },
  { value: "github", label: "GitHub" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "twitch", label: "Twitch" },
  { value: "other", label: "Other" },
] as const;

const BIO_MAX_LENGTH = 1000;

export default function MePage() {
  const utils = trpc.useUtils();
  const { data: user, isLoading } = trpc.user.getProfile.useQuery();
  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully");
      utils.user.getProfile.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to update profile");
    },
  });

  // [Bug #1 Fix] Include nested field defaults to prevent isDirty flash
  const form = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: "",
      bio: "",
      location: "",
      websiteUrl: "",
      image: "",
      bannerUrl: "",
      contactInfo: { phone: "", address: "" },
      businessInfo: { inquiryEmail: "" },
      socialLinks: [],
    },
  });

  // Sync form when user data loads
  useEffect(() => {
    if (user) {
      // [Bug #3 Fix] Safe-parse socialLinks through Zod to handle Prisma JsonValue
      const parsedLinks =
        z.array(socialLinkSchema).safeParse(user.socialLinks).data ?? [];

      form.reset(
        {
          name: user.name || "",
          bio: user.bio || "",
          location: user.location || "",
          websiteUrl: user.websiteUrl || "",
          image: user.image || "",
          bannerUrl: user.bannerUrl || "",
          contactInfo: {
            phone: (user.contactInfo as { phone?: string })?.phone || "",
            address: (user.contactInfo as { address?: string })?.address || "",
          },
          businessInfo: {
            inquiryEmail: (user.businessInfo as { inquiryEmail?: string })?.inquiryEmail || "",
          },
          socialLinks: parsedLinks,
        },
        { keepDirty: false, keepDirtyValues: false }
      );
    }
  }, [user, form]);

  const {
    fields: socialFields,
    append: appendSocial,
    remove: removeSocial,
  } = useFieldArray({
    control: form.control,
    name: "socialLinks",
  });

  // [Inconsistency #7 Fix] Extract watched values to prevent double re-renders using `useWatch` for React Compiler
  const bannerUrl = useWatch({ control: form.control, name: "bannerUrl" });
  const avatarUrl = useWatch({ control: form.control, name: "image" });
  const bioValue = useWatch({ control: form.control, name: "bio" });
  const isDirty = form.formState.isDirty;

  // Tab switching is now safe since all tabs stay mounted (forceMount).
  // Form fields persist across tab switches — no data loss possible.

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  function onSubmit(data: UpdateUserFormValues) {
    updateProfile.mutate(data);
  }

  // [Bug #2 Fix] Auto-save only the image field independently, not the whole form
  const handleImageUpdate = (type: "image" | "bannerUrl", key: string) => {
    form.setValue(type, key, { shouldDirty: false });
    // Save only the specific image field to avoid pushing unvalidated form data
    updateProfile.mutate({ [type]: key });
  };

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      {/* Header / Media uploads */}
      <div className="relative rounded-3xl overflow-hidden bg-card border border-border pb-4 shadow-sm">
        {/* Banner */}
        <div className="h-48 md:h-64 w-full relative bg-muted/80">
          {bannerUrl && (
            <Image
              src={getMediaUrl(bannerUrl)}
              alt="Banner"
              fill
              className="object-cover"
            />
          )}
          <ImageUpload
            type="banner"
            value={bannerUrl}
            onChange={(key) => handleImageUpdate("bannerUrl", key)}
            className="w-full h-full"
            variant="overlay"
          />
        </div>

        {/* Avatar */}
        <div className="absolute top-32 left-4 md:top-44 md:left-8">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-card bg-muted shadow-xl relative z-10 hover:ring-2 ring-primary/40 transition-all">
            {avatarUrl && (
              <Image
                src={getMediaUrl(avatarUrl)}
                alt="Avatar"
                fill
                className="object-cover"
              />
            )}
            <ImageUpload
              type="avatar"
              value={avatarUrl}
              onChange={(key) => handleImageUpdate("image", key)}
              className="w-full h-full"
              variant="overlay"
            />
          </div>
        </div>

        {/* [Responsiveness #8 Fix] mt-20 on mobile to clear avatar overflow */}
        <div className="mt-20 md:mt-16 ml-4 md:ml-44 px-4">
          <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </div>
      </div>

      {/* Editor Layout */}
      <div className="w-full">
        <Tabs defaultValue="profile" className="w-full">
          {/* Scrollable container for tabs on smaller screens */}
          <div className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="bg-muted/50 rounded-xl p-1 inline-flex md:grid w-fit md:w-full md:grid-cols-4 min-w-max md:min-w-0">
              <TabsTrigger value="profile">Profile Details</TabsTrigger>
              <TabsTrigger value="contact">Contact & Business</TabsTrigger>
              <TabsTrigger value="socials">Social Links</TabsTrigger>
              <TabsTrigger value="channels">Your Channels</TabsTrigger>
            </TabsList>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            {/* TAB: PROFILE DETAILS */}
            <TabsContent
              value="profile"
              forceMount
              className="outline-none space-y-8 data-[state=inactive]:hidden"
            >
              <Card className="shadow-none border-border/50">
                <CardHeader>
                  <CardTitle>Profile Details</CardTitle>
                  <CardDescription>
                    Update your public-facing information and biography.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Read-Only Account Info Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4 border-b border-border/40">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                        <IconMail className="w-4 h-4" /> Account Email
                      </p>
                      <p className="text-sm break-all">
                        {user.email}{" "}
                        <Badge
                          className="ml-1"
                          variant={
                            user.emailVerified ? "secondary" : "destructive"
                          }
                        >
                          {user.emailVerified ? "Verified" : "Unverified"}
                        </Badge>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                        <IconCalendar className="w-4 h-4" /> Member Since
                      </p>
                      <p className="text-sm">
                        {new Date(user.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    {/* [Design #11] Display dob from payload */}
                    {user.dob && (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                          <IconCake className="w-4 h-4" /> Date of Birth
                        </p>
                        <p className="text-sm">
                          {new Date(user.dob).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    )}
                  </div>

                  <Controller
                    name="name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={field.name}>
                          Display Name
                        </FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          placeholder="Your name"
                          disabled={updateProfile.isPending}
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    name="bio"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={field.name}>Biography</FieldLabel>
                        <Textarea
                          {...field}
                          value={field.value ?? ""}
                          id={field.name}
                          placeholder="Tell us about yourself..."
                          rows={5}
                          disabled={updateProfile.isPending}
                        />
                        {/* [Design #12] Bio character counter */}
                        <div className="flex justify-between items-center">
                          {fieldState.invalid ? (
                            <FieldError errors={[fieldState.error]} />
                          ) : (
                            <span />
                          )}
                          <span
                            className={`text-xs tabular-nums transition-colors ${
                              (bioValue?.length ?? 0) > BIO_MAX_LENGTH * 0.9
                                ? "text-destructive font-semibold"
                                : "text-muted-foreground"
                            }`}
                          >
                            {bioValue?.length ?? 0}/{BIO_MAX_LENGTH}
                          </span>
                        </div>
                      </Field>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Controller
                      name="location"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel
                            htmlFor={field.name}
                            className="flex items-center gap-1.5"
                          >
                            <IconMapPin className="w-4 h-4 text-muted-foreground" />
                            Location
                          </FieldLabel>
                          <Input
                            {...field}
                            id={field.name}
                            placeholder="City, Country"
                            disabled={updateProfile.isPending}
                          />
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />

                    <Controller
                      name="websiteUrl"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel
                            htmlFor={field.name}
                            className="flex items-center gap-1.5"
                          >
                            <IconLink className="w-4 h-4 text-muted-foreground" />
                            Website
                          </FieldLabel>
                          <Input
                            {...field}
                            id={field.name}
                            type="url"
                            placeholder="https://example.com"
                            disabled={updateProfile.isPending}
                          />
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: CONTACT & BUSINESS */}
            <TabsContent
              value="contact"
              forceMount
              className="outline-none space-y-8 data-[state=inactive]:hidden"
            >
              <Card className="shadow-none border-border/50">
                <CardHeader>
                  <CardTitle>Contact & Business</CardTitle>
                  <CardDescription>
                    Provide contact information for business inquiries and
                    networking.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Controller
                    name="businessInfo.inquiryEmail"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel
                          htmlFor={field.name}
                          className="flex items-center gap-1.5"
                        >
                          <IconBuilding className="w-4 h-4 text-muted-foreground" />
                          Business Inquiry Email
                        </FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          type="email"
                          placeholder="business@example.com"
                          disabled={updateProfile.isPending}
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Controller
                      name="contactInfo.phone"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel
                            htmlFor={field.name}
                            className="flex items-center gap-1.5"
                          >
                            <IconPhone className="w-4 h-4 text-muted-foreground" />
                            Public Phone
                          </FieldLabel>
                          <Input
                            {...field}
                            id={field.name}
                            type="tel"
                            placeholder="+1 (555) 000-0000"
                            disabled={updateProfile.isPending}
                          />
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />

                    <Controller
                      name="contactInfo.address"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel
                            htmlFor={field.name}
                            className="flex items-center gap-1.5"
                          >
                            <IconMapPin className="w-4 h-4 text-muted-foreground" />
                            Office Address
                          </FieldLabel>
                          <Input
                            {...field}
                            id={field.name}
                            placeholder="123 Creator St, NY"
                            disabled={updateProfile.isPending}
                          />
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: SOCIAL LINKS */}
            <TabsContent
              value="socials"
              forceMount
              className="outline-none space-y-8 data-[state=inactive]:hidden"
            >
              <Card className="shadow-none border-border/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div className="space-y-1">
                    <CardTitle>Social Links</CardTitle>
                    <CardDescription>
                      Connect your external platforms. Maximum 10 links allowed.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendSocial({ platform: "twitter", url: "", title: "" })
                    }
                    disabled={
                      socialFields.length >= 10 || updateProfile.isPending
                    }
                  >
                    <IconPlus className="h-4 w-4 mr-2" />
                    Add Link
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {socialFields.length === 0 ? (
                    <div className="text-center py-10 rounded-xl border border-dashed border-border/50 bg-muted/20">
                      <IconWorld className="w-8 h-8 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No social links added yet.
                      </p>
                    </div>
                  ) : (
                    socialFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-muted/30 p-3 rounded-xl border border-border/50"
                      >
                        {/* [Design #10 Fix] Shadcn Select instead of raw <select> */}
                        {/* [Responsiveness #9 Fix] w-full on mobile, auto on desktop */}
                        <div className="w-full md:w-auto shrink-0">
                          <Controller
                            name={`socialLinks.${index}.platform`}
                            control={form.control}
                            render={({ field: selectField }) => (
                              <Select
                                value={selectField.value}
                                onValueChange={selectField.onChange}
                                disabled={updateProfile.isPending}
                              >
                                <SelectTrigger className="h-10 w-full md:w-[140px]">
                                  <SelectValue placeholder="Platform" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SOCIAL_PLATFORMS.map((p) => (
                                    <SelectItem key={p.value} value={p.value}>
                                      {p.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>

                        <div className="grow w-full">
                          <Controller
                            name={`socialLinks.${index}.url`}
                            control={form.control}
                            render={({ field: inputField, fieldState }) => (
                              <Field
                                data-invalid={fieldState.invalid}
                                className="space-y-0"
                              >
                                <Input
                                  {...inputField}
                                  placeholder="https://..."
                                  type="url"
                                  disabled={updateProfile.isPending}
                                  className="h-10"
                                />
                              </Field>
                            )}
                          />
                        </div>

                        <div className="shrink-0 self-end md:self-auto">
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            onClick={() => removeSocial(index)}
                            disabled={updateProfile.isPending}
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* GLOBAL SUBMIT ACTIONS */}
            <div className="flex justify-end pt-2 sticky bottom-4 z-20" role="toolbar" aria-label="Profile actions">
              <div className="bg-background/80 backdrop-blur-xl border border-border/50 p-3 rounded-2xl shadow-xl flex gap-4 items-center">
                {isDirty && (
                  <span className="text-sm text-muted-foreground hidden md:inline-block">
                    You have unsaved changes.
                  </span>
                )}
                <Button
                  type="submit"
                  size="lg"
                  disabled={!isDirty || updateProfile.isPending}
                  className="rounded-xl px-8 shadow-sm"
                >
                  {updateProfile.isPending ? (
                    <IconLoader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <IconCheck className="w-4 h-4 mr-2" />
                  )}
                  Save Profile
                </Button>
              </div>
            </div>
          </form>

          {/* TAB: CHANNELS (Separate from form mutations) */}
          <TabsContent
            value="channels"
            className="outline-none pt-4 animate-in fade-in-50 duration-500"
          >
            <Card className="shadow-none border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="space-y-1">
                  <CardTitle>Your Channels</CardTitle>
                  <CardDescription>Manage your content hubs</CardDescription>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-full shadow-sm"
                  asChild
                >
                  <Link href="/studio/create">
                    <IconPlus className="h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {user.channels && user.channels.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {user.channels.map((channel) => (
                      <Link
                        key={channel.id}
                        href={`/@${channel.handle}`}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/60 hover:border-primary/50 hover:shadow-md transition-all group"
                      >
                        <Avatar className="size-14 border-2 border-primary/10 bg-primary/5 group-hover:scale-105 transition-transform">
                          {channel.image && (
                            <AvatarImage
                              src={getMediaUrl(channel.image)}
                              alt={channel.name}
                              className="object-cover"
                            />
                          )}
                          <AvatarFallback className="bg-transparent">
                            <IconDeviceTv className="size-6 text-primary/70" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="overflow-hidden">
                          <p className="text-base font-bold truncate group-hover:text-primary transition-colors">
                            {channel.name}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                            <span>@{channel.handle}</span>
                            <span className="text-border">•</span>
                            <span className="flex items-center gap-1">
                              <IconUsers className="w-3.5 h-3.5 opacity-70" />
                              {channel.subscriberCount}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 px-4 rounded-2xl border-2 border-dashed border-border/50 bg-muted/10">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                      <IconDeviceTv className="w-8 h-8 text-primary/60" />
                    </div>
                    <p className="text-lg font-semibold mb-2">
                      No channels hosted yet
                    </p>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                      Start your journey by creating your first content hub.
                      Broadcast to the world.
                    </p>
                    <Button
                      variant="default"
                      className="rounded-full shadow-md"
                      asChild
                    >
                      <Link href="/studio/create">
                        <IconPlus className="w-4 h-4 mr-2" />
                        Create Hub
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}