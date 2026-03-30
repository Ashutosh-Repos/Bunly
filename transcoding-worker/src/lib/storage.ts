import {
    S3Client,
    GetObjectCommand,
    CreateMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    CompletedPart,
    UploadPartCommand,
    ListPartsCommand,
    AbortMultipartUploadCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    HeadObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import * as fs from "fs";
import config from "../env.js";

// Internal endpoint for server-to-server operations (download, upload, delete)
const internalEndpoint = config.s3.endpoint;

const s3Client = new S3Client({
    region: config.s3.region,
    endpoint: internalEndpoint,
    credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
    },
    forcePathStyle: true,
});

// Browser-facing public endpoint removed during refactoring

const BUCKET_NAME = config.s3.bucket;

// --- Helpers ---

/**
 * Robust Exponential Backoff Retry wrapper for network requests
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 5,
    baseDelayMs: number = 1000
): Promise<T> {
    let attempt = 0;
    while (true) {
        try {
            return await operation();
        } catch (error: any) {
            attempt++;
            if (attempt > maxRetries) {
                console.error(`[Retry] Operation failed after ${maxRetries} attempts.`);
                throw error;
            }
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            console.warn(`[Retry] Attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`);
            await new Promise((r) => setTimeout(r, delay));
        }
    }
}

/**
 * Download file from S3 to local path with robust error handling
 */
export async function downloadFile(
    key: string,
    localPath: string,
): Promise<void> {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
        throw new Error(`Failed to download ${key}: Body is empty`);
    }

    const writer = fs.createWriteStream(localPath);

    if (response.Body instanceof Readable) {
        try {
            await pipeline(response.Body, writer);
        } catch (err) {
            // Cleanup partial file on error
            if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
            throw err;
        }
    } else {
        // For some SDK versions/environments (like browser), Body might be a Blob or other type.
        // In Node environment with valid client config, it should be a stream.
        // Fallback or explicit error for safety.
        throw new Error(`S3 Body is not a Readable stream.`);
    }
}

export async function uploadFile(
    key: string,
    localPath: string,
    contentType: string,
): Promise<void> {
    const fileStream = fs.createReadStream(localPath);

    const upload = new Upload({
        client: s3Client,
        params: {
            Bucket: BUCKET_NAME,
            Key: key,
            Body: fileStream,
            ContentType: contentType,
        },
    });

    await upload.done();
}

/**
 * Upload buffer or stream directly
 */
export async function uploadStream(
    key: string,
    body: Buffer | Readable,
    contentType: string,
): Promise<void> {
    const upload = new Upload({
        client: s3Client,
        params: {
            Bucket: BUCKET_NAME,
            Key: key,
            Body: body,
            ContentType: contentType,
        },
    });

    await upload.done();
}

/**
 * Helper to ensure local directory exists
 */
export function ensureDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Browser-only multipart helpers removed (createMultipartUpload, getPresignedPartUrl, completeMultipartUpload, listUploadedParts, abortMultipartUpload)

/**
 * Delete all objects under a given S3 prefix
 * Used for cleaning up orphaned assets on job failure
 */
export async function deleteS3Prefix(prefix: string): Promise<number> {
    let deletedCount = 0;
    let continuationToken: string | undefined;

    console.log(`[S3] 🗑️ Deleting all objects under prefix: ${prefix}`);

    do {
        const listCommand = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix,
            ContinuationToken: continuationToken,
        });

        const listResponse = await s3Client.send(listCommand);

        if (listResponse.Contents && listResponse.Contents.length > 0) {
            const deleteCommand = new DeleteObjectsCommand({
                Bucket: BUCKET_NAME,
                Delete: {
                    Objects: listResponse.Contents.map((obj) => ({
                        Key: obj.Key!,
                    })),
                    Quiet: true,
                },
            });

            await s3Client.send(deleteCommand);
            deletedCount += listResponse.Contents.length;
        }

        continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    console.log(`[S3] ✅ Deleted ${deletedCount} objects under ${prefix}`);
    return deletedCount;
}

/**
 * Check if an object exists in S3 (User for recovery)
 */
export async function headObject(key: string): Promise<boolean> {
    try {
        const command = new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });
        await s3Client.send(command);
        return true;
    } catch (error: any) {
        if (
            error.name === "NotFound" ||
            error.$metadata?.httpStatusCode === 404
        ) {
            return false;
        }
        throw error;
    }
}
