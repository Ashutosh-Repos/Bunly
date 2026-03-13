import "dotenv/config";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyWebsocket from "@fastify/websocket";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { auth } from "./lib/auth.js";
import { appRouter } from "./trpc/router.js";
import { createContext } from "./trpc/context.js";
import { env } from "./env.js";
import { prisma } from "./lib/prisma.js";
import redis, { bullMQRedis } from "./lib/redis.js";
import { redisSubscriptionManager } from "./lib/ws/redisSubscription.js";
import { REDIS_KEYS } from "./lib/ws/definitions.js";

const port = env.PORT;
const origin = env.CORS_ORIGIN;

const server = Fastify({
    logger: true,
    maxParamLength: 5000,
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
    async handler(request, reply) {
        try {
            // Construct request URL
            const url = new URL(request.url, `http://${request.headers.host}`);

            // Convert Fastify headers to standard Headers object
            const headers = new Headers();
            Object.entries(request.headers).forEach(([key, value]) => {
                if (value) headers.append(key, value.toString());
            });

            // Create Fetch API-compatible request
            const req = new Request(url.toString(), {
                method: request.method,
                headers,
                ...(request.body &&
                request.method !== "GET" &&
                request.method !== "HEAD"
                    ? { body: JSON.stringify(request.body) }
                    : {}),
            });

            // Process authentication request
            const response = await auth.handler(req);

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

            const text = response.body ? await response.text() : null;
            // Native sending of stringified JSON from better-auth
            if (
                text &&
                response.headers
                    .get("content-type")
                    ?.includes("application/json")
            ) {
                reply.type("application/json").send(text);
            } else {
                reply.send(text);
            }
        } catch (error) {
            server.log.error(error, "Authentication Error");
            reply.status(500).send({
                error: "Internal authentication error",
                code: "AUTH_FAILURE",
            });
        }
    },
});

// tRPC Fastify Adapter mapping
server.register(fastifyTRPCPlugin, {
    prefix: "/api/trpc",
    useWSS: true, // Enables WebSocket Subscription support natively
    trpcOptions: {
        router: appRouter,
        createContext,
        onError({ path, error }: { path?: string; error: any }) {
            console.error(`❌ tRPC Error on '${path}'`, error);
        },
    },
});

// Native WebSocket Handler for Video Upload Progress
server.get(
    "/ws/videos",
    { websocket: true },
    (socket /* WebSocket */, req /* FastifyRequest */) => {
        const query = req.query as { id?: string };
        const videoId = query.id;

        if (!videoId) {
            socket.send(JSON.stringify({ error: "Missing video id" }));
            socket.close(1008, "Policy Violation"); // 1008 Generic Auth/Policy Failure
            return;
        }

        const channel = REDIS_KEYS.videoWsChannel(videoId);
        console.log(`[WS] Client attached to ${channel}`);

        // Define our listener callback
        const messageHandler = (data: any) => {
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

        socket.on("error", (err: any) => {
            console.error(`[WS] Socket error on ${channel}`, err);
            redisSubscriptionManager.removeListener(channel, messageHandler);
        });
    },
);

// Basic health check outside of tRPC
server.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
});

const start = async () => {
    try {
        await server.listen({ port, host: "0.0.0.0" });
        console.log(
            `Server listening on ${origin.replace("3000", port.toString())}`,
        );
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();

const shutdown = async () => {
    console.log("Shutting down API server gracefully...");
    try {
        await server.close();
        await prisma.$disconnect();
        redis?.disconnect();
        bullMQRedis?.disconnect();
        console.log("Cleanup complete. Exiting.");
        process.exit(0);
    } catch (err) {
        console.error("Error during shutdown:", err);
        process.exit(1);
    }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
