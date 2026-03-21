import os from "os";
import { prisma } from "../lib/prisma.js";
import redis from "../lib/redis.js";
import {
    RedisStreamConsumer,
    type StreamMessage,
} from "../lib/StreamingConsumer.js";
import { STREAMS } from "./definitions.js";

const GROUP = "notification_workers";
const CONSUMER_NAME = `worker:${os.hostname()}:${process.pid}:notifications`;

async function handleNotificationBatch(
    messages: StreamMessage[],
    consumer: RedisStreamConsumer,
): Promise<void> {
    const ids: string[] = [];
    
    for (const { id, fields } of messages) {
        ids.push(id);
        try {
            const raw = fields[1];
            const data = JSON.parse(raw);
            
            // Standardize Prisma insert data
            const notificationData = {
                userId: data.userId,
                actorId: data.actorId,
                type: data.type,
                title: data.title,
                message: data.message,
                videoId: data.videoId,
                commentId: data.commentId,
                channelId: data.channelId,
                thumbnailUrl: data.thumbnailUrl,
                actionUrl: data.actionUrl,
                metadata: data.metadata || undefined,
                groupKey: data.groupKey || undefined,
            };

            const record = await prisma.notifications.create({
                data: notificationData,
                include: {
                    user_notifications_actorIdTouser: {
                        select: { id: true, name: true, image: true },
                    },
                },
            });

            // Rehydrate the web UI proactively via native Redis Pub/Sub
            await redis.publish(`user:notifications:${record.userId}`, JSON.stringify(record)).catch((e) => {
                console.warn("[NotificationWorker] PubSub Drop:", e);
            });

        } catch (err) {
            console.warn("[NotificationWorker] Failed to process message:", id, err);
        }
    }

    if (ids.length > 0) {
        await consumer.ack(...ids);
        console.log(`[NotificationWorker] Processed and dispatched ${ids.length} notifications`);
    }
}

export function startNotificationWorker(): () => void {
    const consumer = new RedisStreamConsumer({
        streamKey: STREAMS.NOTIFICATIONS,
        groupName: GROUP,
        consumerName: CONSUMER_NAME,
        pendingMaxAgeMs: 60_000,
    });

    consumer.run((msgs) => handleNotificationBatch(msgs, consumer)).catch((err: unknown) => {
        console.error("[NotificationWorker] Consumer crashed:", err);
    });

    console.log("[NotificationWorker] Started — consuming:", STREAMS.NOTIFICATIONS);

    return () => consumer.stop();
}
