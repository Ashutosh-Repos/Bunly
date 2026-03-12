import { type Redis } from "ioredis";
import { createRedisClient } from "../lib/redis.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StreamMessage = {
    id: string;
    /** Raw field/value array from xreadgroup: [key, value, key, value, ...] */
    fields: string[];
};

export type BatchHandler = (messages: StreamMessage[]) => Promise<void>;

export interface StreamConsumerOptions {
    streamKey: string;
    groupName: string;
    consumerName: string;
    batchSize?: number;
    blockMs?: number;
    /** Idle ms before a PEL entry is retried (default: 30_000) */
    pendingMaxAgeMs?: number;
    /** Max delivery attempts before moving to DLQ (default: 5) */
    dlqMaxDeliveries?: number;
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Resilient Redis Stream consumer with:
 *  - Dedicated Redis connection per instance (no shared-pool starvation)
 *  - Auto consumer-group creation (MKSTREAM)
 *  - PEL recovery (stale messages are re-claimed and retried)
 *  - Dead Letter Queue (DLQ) for poison messages
 *  - Auto-restart on fatal errors (up to maxRestarts)
 *  - Graceful stop()
 */
export class RedisStreamConsumer {
    private client: Redis;
    private stopped = false;
    private restartCount = 0;
    private readonly maxRestarts = 10;
    private readonly restartDelayMs = 5_000;
    private readonly o: Required<StreamConsumerOptions>;

    constructor(opts: StreamConsumerOptions) {
        this.client = createRedisClient(false);
        this.o = {
            batchSize: 200,
            blockMs: 2000,
            pendingMaxAgeMs: 30_000,
            dlqMaxDeliveries: 5,
            ...opts,
        };
    }

    /**
     * Start consuming. Automatically restarts on fatal errors up to maxRestarts.
     * After exhausting restarts, the process exits so the orchestrator (PM2/Docker) can restart it.
     */
    async run(handler: BatchHandler): Promise<void> {
        try {
            await this.ensureGroup();
            console.log(
                `[Stream:${this.o.streamKey}] Started (${this.o.consumerName})`,
            );

            while (!this.stopped) {
                try {
                    await this.recoverPending(handler);
                    const msgs = await this.readNew();
                    if (msgs.length > 0) await handler(msgs);
                    // Reset restart counter on successful iterations
                    this.restartCount = 0;
                } catch (err) {
                    if (!this.stopped) {
                        console.error(
                            `[Stream:${this.o.streamKey}] Loop error:`,
                            err,
                        );
                        await this.sleep(1000);
                    }
                }
            }

            console.log(`[Stream:${this.o.streamKey}] Stopped`);
            await this.client.quit().catch(() => {});
        } catch (fatalErr) {
            // Fatal: ensureGroup failed, Redis connection lost permanently, etc.
            console.error(
                `[Stream:${this.o.streamKey}] Fatal error:`,
                fatalErr,
            );
            await this.client.quit().catch(() => {});

            if (this.stopped) return;

            this.restartCount++;
            if (this.restartCount > this.maxRestarts) {
                console.error(
                    `[Stream:${this.o.streamKey}] Exceeded ${this.maxRestarts} restarts — exiting process`,
                );
                process.exit(1);
            }

            console.warn(
                `[Stream:${this.o.streamKey}] Restarting in ${this.restartDelayMs}ms (attempt ${this.restartCount}/${this.maxRestarts})`,
            );
            await this.sleep(this.restartDelayMs);

            // Recreate client and retry
            this.client = createRedisClient(false);
            return this.run(handler);
        }
    }

    stop(): void {
        this.stopped = true;
        this.client.disconnect();
    }

    async ack(...ids: string[]): Promise<void> {
        if (ids.length > 0)
            await this.client.xack(this.o.streamKey, this.o.groupName, ...ids);
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    private async ensureGroup(): Promise<void> {
        try {
            await this.client.xgroup(
                "CREATE",
                this.o.streamKey,
                this.o.groupName,
                "0",
                "MKSTREAM",
            );
        } catch (e: any) {
            if (!e.message?.includes("BUSYGROUP")) throw e;
        }
    }

    private async readNew(): Promise<StreamMessage[]> {
        const res = await this.client.xreadgroup(
            "GROUP",
            this.o.groupName,
            this.o.consumerName,
            "COUNT",
            this.o.batchSize,
            "BLOCK",
            this.o.blockMs,
            "STREAMS",
            this.o.streamKey,
            ">",
        );
        if (!res) return [];
        const [, msgs] = (res as [string, [string, string[]][]][])[0];
        return msgs.map(([id, fields]) => ({ id, fields }));
    }

    private async recoverPending(handler: BatchHandler): Promise<void> {
        const pel = (await this.client.xpending(
            this.o.streamKey,
            this.o.groupName,
            "-",
            "+",
            10,
        )) as [string, string, number, number][];

        if (!pel?.length) return;

        const stale = pel.filter(([, , idle]) => idle > this.o.pendingMaxAgeMs);
        if (!stale.length) return;

        const claimed = (await this.client.xclaim(
            this.o.streamKey,
            this.o.groupName,
            this.o.consumerName,
            this.o.pendingMaxAgeMs,
            ...stale.map(([id]) => id),
        )) as [string, string[]][];

        if (!claimed?.length) return;

        const deliveryMap = new Map(stale.map(([id, , , dc]) => [id, dc]));
        const toProcess: StreamMessage[] = [];
        const toDLQ: string[] = [];

        for (const [id, fields] of claimed) {
            if ((deliveryMap.get(id) ?? 0) >= this.o.dlqMaxDeliveries) {
                toDLQ.push(id);
                console.warn(`[Stream:${this.o.streamKey}] DLQ: ${id}`);
            } else {
                toProcess.push({ id, fields });
            }
        }

        if (toDLQ.length) {
            const p = this.client.pipeline();
            for (const id of toDLQ) {
                p.xadd(
                    `${this.o.streamKey}:dlq`,
                    "*",
                    "original_id",
                    id,
                    "ts",
                    String(Date.now()),
                );
                p.xack(this.o.streamKey, this.o.groupName, id);
            }
            await p.exec();
        }

        if (toProcess.length) await handler(toProcess);
    }

    private sleep(ms: number) {
        return new Promise((r) => setTimeout(r, ms));
    }
}
