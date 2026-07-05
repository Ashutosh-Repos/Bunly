import redis from "./redis.js";

/**
 * Caches the video status in Redis.
 * This can be used by the API layer to quickly fetch the current state.
 */
export async function cacheVideoStatus(videoId: string, statusData: any) {
    const key = `video:${videoId}:status`;
    // Cache for 24 hours
    await redis.set(key, JSON.stringify(statusData), "EX", 86400);
}

/**
 * Publishes raw video processing events to a Redis PubSub channel.
 */
export async function publishToVideoChannel(videoId: string, eventData: any) {
    const channel = `video:${videoId}:ws`;
    const payload = JSON.stringify({ videoId, ...eventData });

    // Publish to a specific video channel
    await redis.publish(channel, payload);

    // Also publish to a global channel for system-wide monitors
    await redis.publish("video:events:global", payload);
}

/**
 * Tracks and publishes aggregate progress across multiple parallel jobs.
 * Prevents the "Hanging 90%" bug by weighting jobs fairly.
 */
export async function updateAggregateProgress(
    videoId: string,
    jobName: string,
    rawPercent: number,
    metadata?: any,
) {
    const trackerKey = `video:${videoId}:progress:tracker`;

    // Map Job names to tracker fields
    let field = "";
    if (jobName === "probe-and-split") field = "probe";
    else if (jobName === "generate-thumbnails") field = "thumb";
    else if (jobName === "generate-sprite") field = "sprite";
    else if (jobName === "merge-manifest") field = "merge";
    else if (jobName === "transcode-chunk" && metadata?.resolution)
        field = `res:${metadata.resolution}`;

    if (!field) return;

    const luaScript = `
        -- 1. Update the specific field
        redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
        
        -- 2. If it's the probe job and we have a res_count, set it
        if ARGV[1] == 'probe' and ARGV[3] ~= '' then
            redis.call('HSET', KEYS[1], 'res_count', ARGV[3])
        end

        -- 3. Fetch all values for calculation
        local data = redis.call('HGETALL', KEYS[1])
        local map = {}
        for i=1, #data, 2 do
            map[data[i]] = data[i+1]
        end

        local probe = tonumber(map['probe'] or 0)
        local thumb = tonumber(map['thumb'] or 0)
        local sprite = tonumber(map['sprite'] or 0)
        local merge = tonumber(map['merge'] or 0)
        local res_count = tonumber(map['res_count'] or 0)
        local latest = tonumber(map['latest'] or 0)

        local transcodeSum = 0
        local actualResCount = 0
        for k, v in pairs(map) do
            if string.sub(k, 1, 4) == "res:" then
                transcodeSum = transcodeSum + tonumber(v or 0)
                actualResCount = actualResCount + 1
            end
        end

        -- Use res_count if set, else fallback to actualResCount encountered so far
        local div = res_count
        if div <= 0 then div = actualResCount end
        
        local transcodeProgress = 0
        if div > 0 then
            transcodeProgress = transcodeSum / div
        end

        -- Weighted Formula
        local total = (probe * 0.1) + (transcodeProgress * 0.7) + (thumb * 0.05) + (sprite * 0.05) + (merge * 0.1)
        total = math.floor(total + 0.5) -- Round

        -- Ensure monotonicity
        if total > latest then
            redis.call('HSET', KEYS[1], 'latest', total)
            -- Key expires in 1 hour after last update
            redis.call('EXPIRE', KEYS[1], 3600)
            return total
        end
        return -1
    `;

    try {
        const resCount = metadata?.resCount ? String(metadata.resCount) : "";
        const totalProgress = await (redis as any).eval(
            luaScript,
            1,
            trackerKey,
            field,
            String(rawPercent),
            resCount,
        );

        if (totalProgress >= 0) {
            await publishToVideoChannel(videoId, {
                status: "PROCESSING",
                progress: totalProgress,
                type: "update",
            });
        }
    } catch (e) {
        console.error(
            `[PubSub] ⚠️ Aggregate progress failed for ${videoId}:`,
            e,
        );
    }
}

/**
 * Deletes the aggregate tracker from Redis once the job is finished or aborted.
 */
export async function deleteAggregateTracker(videoId: string) {
    const trackerKey = `video:${videoId}:progress:tracker`;
    await redis.del(trackerKey);
}
