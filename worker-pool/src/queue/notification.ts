import os from "os";
import { prisma } from "../lib/prisma.js";
import { NotificationService } from "../services/NotificationService.js";
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
            
            // Dispatch via consolidated service to handle aggregation & settings
            await NotificationService.notify(data);

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
