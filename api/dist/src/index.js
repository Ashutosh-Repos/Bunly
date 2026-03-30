var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import "dotenv/config";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyWebsocket from "@fastify/websocket";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { auth } from "./lib/auth.js";
import { appRouter } from "./trpc/appRouter.js";
import { createContext } from "./trpc/context.js";
import { env } from "./env.js";
import { prisma } from "./lib/prisma.js";
import redis, { bullMQRedis } from "./lib/redis.js";
import { redisSubscriptionManager } from "./lib/ws/redisSubscription.js";
import { REDIS_KEYS } from "./lib/ws/definitions.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import config from "./lib/config.js";
import { getPresignedGetUrl } from "./lib/storage.js";
// Shared S3Client for media proxy — avoids creating a new client per .m3u8 request
const mediaProxyS3 = new S3Client({
    region: config.s3.region,
    endpoint: config.s3.endpoint,
    credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
    },
    forcePathStyle: true,
});
const port = env.PORT;
const origin = env.CORS_ORIGIN;
const server = Fastify({
    logger: true,
});
// Configure CORS for Next.js frontend
server.register(fastifyCors, {
    origin: origin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});
// Basic security headers
server.register(fastifyHelmet, {
    crossOriginResourcePolicy: false, // adjust if hosting images
});
// Required for Better-Auth and session handling
server.register(fastifyCookie);
// Required for TRPC Subscriptions and Live Video Processing updates
server.register(fastifyWebsocket);
// Global Rate Limiting for overall API protection (using generic Redis connection)
server.register(fastifyRateLimit, {
    max: 500, // global 500 requests per IP...
    timeWindow: "1 minute",
    redis: redis || undefined, // use Redis if securely bound, otherwise fallback to local RAM
    allowList: ["127.0.0.1", "localhost"], // Optional: exclude internal microservices or load balancers here
});
// Better-Auth catch-all route mapping
server.route({
    method: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    url: "/api/auth/*",
    handler(request, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Construct request URL using strict BETTER_AUTH_URL for reliability
                const url = new URL(request.url, env.BETTER_AUTH_URL);
                // Convert Fastify headers to standard Headers object
                const headers = new Headers();
                Object.entries(request.headers).forEach(([key, value]) => {
                    if (value)
                        headers.append(key, value.toString());
                });
                // Create Fetch API-compatible request
                const req = new Request(url.toString(), Object.assign({ method: request.method, headers }, (request.body &&
                    request.method !== "GET" &&
                    request.method !== "HEAD"
                    ? { body: JSON.stringify(request.body) }
                    : {})));
                // Process authentication request
                const response = yield auth.handler(req);
                // Forward response to client
                reply.status(response.status);
                // Handle standard Fetch API array of Set-Cookies safely
                const setCookies = response.headers.getSetCookie();
                if (setCookies && setCookies.length > 0) {
                    reply.header("set-cookie", setCookies);
                }
                response.headers.forEach((value, key) => {
                    if (key.toLowerCase() !== "set-cookie") {
                        reply.header(key, value);
                    }
                });
                const text = response.body ? yield response.text() : null;
                // Native sending of stringified JSON from better-auth
                if (text &&
                    ((_a = response.headers
                        .get("content-type")) === null || _a === void 0 ? void 0 : _a.includes("application/json"))) {
                    reply.type("application/json").send(text);
                }
                else {
                    reply.send(text);
                }
            }
            catch (error) {
                server.log.error(error, "Authentication Error");
                reply.status(500).send({
                    error: "Internal authentication error",
                    code: "AUTH_FAILURE",
                });
            }
        });
    },
});
// tRPC Fastify Adapter mapping
server.register(fastifyTRPCPlugin, {
    prefix: "/api/trpc",
    useWSS: true, // Enables WebSocket Subscription support natively
    trpcOptions: {
        router: appRouter,
        createContext,
        onError({ path, error }) {
            console.error(`❌ tRPC Error on '${path}'`, error);
        },
    },
});
// Native WebSocket Handler for Video Upload Progress
server.get("/ws/videos", { websocket: true }, (socket /* WebSocket */, req /* FastifyRequest */) => {
    const query = req.query;
    const videoId = query.id;
    if (!videoId) {
        socket.send(JSON.stringify({ error: "Missing video id" }));
        socket.close(1008, "Policy Violation"); // 1008 Generic Auth/Policy Failure
        return;
    }
    const channel = REDIS_KEYS.videoWsChannel(videoId);
    console.log(`[WS] Client attached to ${channel}`);
    // Define our listener callback
    const messageHandler = (data) => {
        if (socket.readyState === 1) {
            // OPEN
            socket.send(JSON.stringify(data));
        }
    };
    // Hook into the shared Redis Pub/Sub multiplexer
    redisSubscriptionManager.on(channel, messageHandler);
    socket.on("close", () => {
        console.log(`[WS] Client detached from ${channel}`);
        redisSubscriptionManager.removeListener(channel, messageHandler);
    });
    socket.on("error", (err) => {
        console.error(`[WS] Socket error on ${channel}`, err);
        redisSubscriptionManager.removeListener(channel, messageHandler);
    });
});
// Media Proxy: Generates Transient Presigned GET URLs for Private Bucket Objects
// Also acts as a Lazy HLS Router to support relative WHATWG URL resolution.
server.get("/api/media/*", (req, reply) => __awaiter(void 0, void 0, void 0, function* () {
    const rawKey = req.params["*"];
    if (!rawKey) {
        return reply.status(400).send({ error: "Missing key parameter" });
    }
    // Decode in case of URL encoded components
    const key = decodeURIComponent(rawKey);
    try {
        // HLS Text Manifests (.m3u8) MUST be downloaded and served as text by Fastify
        // This ensures the browser's base URL is the Fastify domain for relative chunk resolution.
        if (key.endsWith(".m3u8")) {
            const command = new GetObjectCommand({
                Bucket: config.s3.bucket,
                Key: key,
            });
            const s3Response = yield mediaProxyS3.send(command);
            if (!s3Response.Body) {
                return reply.status(404).send({ error: "Manifest empty or not found" });
            }
            // Stream it directly to the browser
            reply.header("Content-Type", "application/vnd.apple.mpegurl");
            // Cache text manifests briefly for performance (too long risks breaking live playlists)
            reply.header("Cache-Control", "public, max-age=60");
            const stream = s3Response.Body;
            return reply.send(stream);
        }
        // EVERYTHING ELSE (Photos, Avatars, .ts chunks, .vtt sprites) 
        // Generates a Pre-Signed URL and returns a 302 Redirect (Zero Egress!)
        const url = yield getPresignedGetUrl(key);
        // Cache the redirect for 50 minutes (presigned URLs expire in 60m)
        // Include CORS headers defensively for HLS .ts segment cross-origin requests
        return reply
            .header("Cache-Control", "public, max-age=3000")
            .header("Access-Control-Allow-Origin", origin)
            .redirect(url);
    }
    catch (error) {
        if (error.name === "NoSuchKey") {
            return reply.status(404).send({ error: "Media not found" });
        }
        server.log.error(error, "Media Proxy Error");
        return reply.status(500).send({ error: "Failed to fetch media" });
    }
}));
// Basic health check outside of tRPC
server.get("/health", () => __awaiter(void 0, void 0, void 0, function* () {
    return { status: "ok", timestamp: new Date().toISOString() };
}));
const start = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield server.listen({ port, host: "0.0.0.0" });
        console.log(`Server listening on ${origin.replace("3000", port.toString())}`);
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
});
start();
const shutdown = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Shutting down API server gracefully...");
    try {
        yield server.close();
        yield prisma.$disconnect();
        redis === null || redis === void 0 ? void 0 : redis.disconnect();
        bullMQRedis === null || bullMQRedis === void 0 ? void 0 : bullMQRedis.disconnect();
        console.log("Cleanup complete. Exiting.");
        process.exit(0);
    }
    catch (err) {
        console.error("Error during shutdown:", err);
        process.exit(1);
    }
});
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
