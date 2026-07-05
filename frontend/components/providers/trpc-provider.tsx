"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  httpBatchLink,
  splitLink,
  wsLink,
  createWSClient,
} from "@trpc/client";
import React, { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import superjson from "superjson";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// We route WebSocket connections through the Next.js rewrite proxy.
// This forces the browser to treat the connection as same-origin, 
// securely attaching the SameSite: "lax" session cookies.
const WS_URL = API_URL.replace(/^http/, "ws");

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

function makeTRPCClient() {
  const wsClient =
    typeof window !== "undefined"
      ? createWSClient({
          url: `${WS_URL}/api/trpc`,
        })
      : null;

  // HTTP requests go through the Next.js rewrite proxy (same-origin for cookies)
  const httpLink = httpBatchLink({
    url: `${API_URL}/api/trpc`,
    transformer: superjson,
    fetch: (url, options) =>
      fetch(url, { ...options, credentials: "include" }),
  });

  return trpc.createClient({
    links: [
      splitLink({
        condition: (op) => op.type === "subscription",
        true: wsClient ? wsLink({ client: wsClient, transformer: superjson }) : httpLink,
        false: httpLink,
      }),
    ],
  });
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const [trpcClient] = useState(makeTRPCClient);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
