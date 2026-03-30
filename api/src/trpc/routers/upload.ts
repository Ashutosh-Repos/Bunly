import { z } from "zod";
import { router, protectedProcedure } from "../router.js";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import config from "../../lib/config.js";

// We use the same public endpoint configuration as storage.ts
// so the frontend is given URLs it can directly hit from the browser.
const publicEndpoint = config.s3.publicUrl || config.s3.endpoint;

// Initialize a signer client dedicated for generating browser-facing URLs
const signerClient = new S3Client({
    region: config.s3.region,
    endpoint: publicEndpoint,
    credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
    },
    forcePathStyle: true,
});

export const uploadRouter = router({
    getPresignedUrl: protectedProcedure
        .input(
            z.object({
                filename: z.string().min(1),
                contentType: z.string().startsWith("image/"),
                type: z.enum([
                    "avatar",
                    "banner",
                    "channel-logo",
                    "channel-banner",
                    "thumbnail",
                    "playlist-thumbnail",
                    "community-post",
                ]),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { filename, contentType, type } = input;
            const userId = ctx.session.user.id;

            // Generate a secure, unique object key grouped by type and user
            const timestamp = Date.now();
            const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
            const key = `uploads/${type}/${userId}/${timestamp}-${cleanFilename}`;

            // Enforce hard 5MB limit for images
            const MAX_FILE_SIZE = 5 * 1024 * 1024; 

            const { url, fields } = await createPresignedPost(signerClient, {
                Bucket: config.s3.bucket,
                Key: key,
                Conditions: [
                    ["content-length-range", 0, MAX_FILE_SIZE],
                    ["starts-with", "$Content-Type", contentType],
                ],
                Fields: {
                    "Content-Type": contentType,
                },
                Expires: config.upload.presignedUrlExpiry,
            });

            return {
                success: true,
                url,
                fields,
                key,
            };
        }),
});
