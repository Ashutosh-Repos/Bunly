var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { S3Client, GetObjectCommand, CreateMultipartUploadCommand, CompleteMultipartUploadCommand, UploadPartCommand, ListPartsCommand, AbortMultipartUploadCommand, ListObjectsV2Command, DeleteObjectsCommand, HeadObjectCommand, } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import * as fs from "fs";
import config from "./config";
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
// Public endpoint for browser-facing presigned URLs
// On Railway: PUBLIC_S3_URL = "https://t3.storageapi.dev"
// Locally: falls back to the same internal endpoint
const publicEndpoint = config.s3.publicUrl || internalEndpoint;
const signerClient = new S3Client({
    region: config.s3.region,
    endpoint: publicEndpoint,
    credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
    },
    forcePathStyle: true,
});
const BUCKET_NAME = config.s3.bucket;
// --- Helpers ---
/**
 * Download file from S3 to local path with robust error handling
 */
export function downloadFile(key, localPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });
        const response = yield s3Client.send(command);
        if (!response.Body) {
            throw new Error(`Failed to download ${key}: Body is empty`);
        }
        const writer = fs.createWriteStream(localPath);
        if (response.Body instanceof Readable) {
            try {
                yield pipeline(response.Body, writer);
            }
            catch (err) {
                // Cleanup partial file on error
                if (fs.existsSync(localPath))
                    fs.unlinkSync(localPath);
                throw err;
            }
        }
        else {
            // For some SDK versions/environments (like browser), Body might be a Blob or other type.
            // In Node environment with valid client config, it should be a stream.
            // Fallback or explicit error for safety.
            throw new Error(`S3 Body is not a Readable stream.`);
        }
    });
}
export function uploadFile(key, localPath, contentType) {
    return __awaiter(this, void 0, void 0, function* () {
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
        yield upload.done();
    });
}
/**
 * Upload buffer or stream directly
 */
export function uploadStream(key, body, contentType) {
    return __awaiter(this, void 0, void 0, function* () {
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: BUCKET_NAME,
                Key: key,
                Body: body,
                ContentType: contentType,
            },
        });
        yield upload.done();
    });
}
/**
 * Helper to ensure local directory exists
 */
export function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
/**
 * Start a new Multipart Upload Session
 */
export function createMultipartUpload(videoId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Ensure we use generic 'source' key for format-agnostic upload
        const key = `raw-videos/${videoId}/source`;
        const command = new CreateMultipartUploadCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: "application/octet-stream", // Generic binary stream
        });
        const response = yield s3Client.send(command);
        if (!response.UploadId)
            throw new Error("Failed to create multipart upload");
        return response.UploadId;
    });
}
/**
 * Get a Presigned URL for a specific Part
 */
export function getPresignedPartUrl(videoId, uploadId, partNumber, contentMd5) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = `raw-videos/${videoId}/source`;
        const command = new UploadPartCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
        });
        // Expire in 1 hour (plenty for a 5MB chunk)
        // Use signerClient so the URL contains the public hostname
        return yield getSignedUrl(signerClient, command, { expiresIn: 3600 });
    });
}
/**
 * Complete the Multipart Upload
 */
export function completeMultipartUpload(videoId, uploadId, parts) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = `raw-videos/${videoId}/source`;
        // Sort parts by PartNumber (Critical for S3)
        const sortedParts = parts.sort((a, b) => (a.PartNumber || 0) - (b.PartNumber || 0));
        const command = new CompleteMultipartUploadCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: sortedParts,
            },
        });
        yield s3Client.send(command);
    });
}
/**
 * List already uploaded parts (for Resume)
 */
export function listUploadedParts(videoId, uploadId) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = `raw-videos/${videoId}/source`;
        const allParts = [];
        let partNumberMarker;
        // S3 ListParts returns max 1000 per call — paginate if needed
        do {
            const command = new ListPartsCommand(Object.assign({ Bucket: BUCKET_NAME, Key: key, UploadId: uploadId }, (partNumberMarker ? { PartNumberMarker: partNumberMarker } : {})));
            const response = yield s3Client.send(command);
            if (response.Parts) {
                allParts.push(...response.Parts);
            }
            if (response.IsTruncated && response.NextPartNumberMarker) {
                partNumberMarker = String(response.NextPartNumberMarker);
            }
            else {
                break;
            }
        } while (true);
        return allParts;
    });
}
/**
 * Abort a Multipart Upload
 */
export function abortMultipartUpload(videoId, uploadId) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = `raw-videos/${videoId}/source`;
        const command = new AbortMultipartUploadCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
        });
        yield s3Client.send(command);
    });
}
/**
 * Delete all objects under a given S3 prefix
 * Used for cleaning up orphaned assets on job failure
 */
export function deleteS3Prefix(prefix) {
    return __awaiter(this, void 0, void 0, function* () {
        let deletedCount = 0;
        let continuationToken;
        console.log(`[S3] 🗑️ Deleting all objects under prefix: ${prefix}`);
        do {
            const listCommand = new ListObjectsV2Command({
                Bucket: BUCKET_NAME,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            });
            const listResponse = yield s3Client.send(listCommand);
            if (listResponse.Contents && listResponse.Contents.length > 0) {
                const deleteCommand = new DeleteObjectsCommand({
                    Bucket: BUCKET_NAME,
                    Delete: {
                        Objects: listResponse.Contents.map((obj) => ({
                            Key: obj.Key,
                        })),
                        Quiet: true,
                    },
                });
                yield s3Client.send(deleteCommand);
                deletedCount += listResponse.Contents.length;
            }
            continuationToken = listResponse.NextContinuationToken;
        } while (continuationToken);
        console.log(`[S3] ✅ Deleted ${deletedCount} objects under ${prefix}`);
        return deletedCount;
    });
}
/**
 * Check if an object exists in S3 (User for recovery)
 */
export function headObject(key) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const command = new HeadObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            });
            yield s3Client.send(command);
            return true;
        }
        catch (error) {
            if (error.name === "NotFound" ||
                ((_a = error.$metadata) === null || _a === void 0 ? void 0 : _a.httpStatusCode) === 404) {
                return false;
            }
            throw error;
        }
    });
}
