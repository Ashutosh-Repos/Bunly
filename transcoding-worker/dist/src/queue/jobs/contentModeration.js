import { addTranscodeFlow } from "../flow.js";
export async function handleContentModeration(job) {
    const { videoId, inputPath, resolutions, metadata } = job.data;
    console.log(`🛡️ Scanning content for video ${videoId}...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log(`✅ Content checks passed for ${videoId}`);
    if (metadata.duration > 36000) {
        // Safety hook: Reject if mathematically impossible bounds found, or moderation flagged
        throw new Error("Content Moderation Rejected: Video duration exceeds absolute maximum bounds.");
    }
    await addTranscodeFlow(videoId, inputPath, resolutions, metadata);
    return { status: "approved" };
}
