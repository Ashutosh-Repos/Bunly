import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be under 128 characters"),
});

export const signUpSchema = z
  .object({
    name: z
      .string()
      .min(1, "Full name is required")
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be under 100 characters"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be under 128 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type SignUpFormValues = z.infer<typeof signUpSchema>;

export const socialLinkSchema = z.object({
  platform: z.string(),
  url: z.string().url(),
  title: z.string().optional(),
});

export const businessInfoSchema = z.object({
  inquiryEmail: z.string().email().optional().or(z.literal("")),
});

export const contactInfoSchema = z.object({
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  bio: z.string().max(1000, "Bio cannot exceed 1000 characters").optional(),
  websiteUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  location: z.string().max(100, "Location cannot exceed 100 characters").optional(),
  image: z.string().optional().or(z.literal("")),
  bannerUrl: z.string().optional().or(z.literal("")),
  socialLinks: z.array(socialLinkSchema).max(10).optional(),
  businessInfo: businessInfoSchema.optional(),
  contactInfo: contactInfoSchema.optional(),
});

export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;


export const UploadTypeSchema = z.enum([
    "avatar",
    "banner",
    "channel-logo",
    "channel-banner",
    "thumbnail",
    "playlist-thumbnail",
]);

export type UploadType = z.infer<typeof UploadTypeSchema>;

export const ContentTypeSchema = z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
]);

export const MaxSizes: Record<UploadType, number> = {
    avatar: 5 * 1024 * 1024,
    banner: 10 * 1024 * 1024,
    "channel-logo": 5 * 1024 * 1024,
    "channel-banner": 10 * 1024 * 1024,
    thumbnail: 5 * 1024 * 1024,
    "playlist-thumbnail": 5 * 1024 * 1024,
};

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];

export const AllowedMimeTypes: Record<UploadType, string[]> = {
    avatar: IMAGE_MIMES,
    banner: IMAGE_MIMES,
    "channel-logo": IMAGE_MIMES,
    "channel-banner": IMAGE_MIMES,
    thumbnail: IMAGE_MIMES,
    "playlist-thumbnail": IMAGE_MIMES,
};
