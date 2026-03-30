import { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { auth } from "../lib/auth.js";

/**
 * Creates context for an incoming request
 * @link https://trpc.io/docs/v11/context
 */
export async function createContext({ req, res }: CreateFastifyContextOptions) {
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
        if (value) {
            if (Array.isArray(value)) {
                value.forEach((v) => headers.append(key, v));
            } else {
                headers.set(key, value as string);
            }
        }
    });

    // Pass Fastify's raw IP to Better-Auth rate limiting
    // Note: Fastify's req.ip is already processed by its 'trustProxy' setting
    if (req.ip) {
        headers.set("X-Forwarded-For", req.ip);
    }

    const session = await auth.api.getSession({
        headers: headers,
    });

    return {
        req,
        res,
        headers,
        session,
    };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
