# Architecture Notes for the Future 🔮

- **Database Connection Pooling:** The worker-pool uses a direct Prisma connection. Since workers keep long-lived persistent connections, if you ever scale horizontally to multiple worker machines, you will quickly hit PostgreSQL's max connection limit. You will need PgBouncer or Prisma Accelerate then.

- **Heavy Ranking SQL:** The personalized algorithms in `FeedService.ts` running `LOG10(affinity)` and `EXTRACT(EPOCH)` on hundreds of candiate rows is viable for launch, but as your video catalog grows to thousands, you'll need to offload this to a search engine like ElasticSearch or Typesense.

- **Not implemented:** #10 (NEW_VIDEO_NOTIFICATIONS consumer) — requires designing subscriber fan-out logic, a feature addition best planned separately.

- **Distributed Download Coordination (`inputCache.ts`):** The transcoding worker's `inputCache.ts` uses **local filesystem `.downloading` lock files** to coordinate parallel S3 downloads between co-located workers on the same node. This is safe for single-node deployment, but would break if you horizontally scale the transcoding-worker across multiple machines. To fix: replace the file-based lock with a Redis-based download lock (similar to the `waitForLockRelease` pattern already used in `transcodeChunk.ts`).

- **Prisma Text Search (`search.ts`):** The global search uses Prisma's `search` operator with `OR` grouping for titles and descriptions, which evaluates two independent full-text scans. As the catalog scales past ~100k videos, replace with a raw SQL `to_tsvector` query on a combined indexed column for significantly better performance.
