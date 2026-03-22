import { cache } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../api/src/trpc/appRouter";
import superjson from "superjson";
import { headers } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Server-side tRPC client — deduplicated per request via React.cache().
 *
 * Multiple calls to getTrpcServer() within the same request lifecycle
 * return the same client instance, avoiding redundant client creation.
 */
export const getTrpcServer = cache(async () => {
  const heads = await headers();
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${API_URL}/api/trpc`,
        transformer: superjson,
        headers() {
          return {
            cookie: heads.get("cookie") || "",
          };
        },
      }),
    ],
  });
});
