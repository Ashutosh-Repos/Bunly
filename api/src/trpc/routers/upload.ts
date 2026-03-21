import { z } from "zod";
import { router, protectedProcedure } from "../router.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

            const command = new PutObjectCommand({
                Bucket: config.s3.bucket,
                Key: key,
                ContentType: contentType,
            });

            // The URL expires depending on environment configs, usually 1 hour.
            const url = await getSignedUrl(signerClient, command, {
                expiresIn: config.upload.presignedUrlExpiry,
            });

            return {
                success: true,
                url,
                key,
            };
        }),
});
