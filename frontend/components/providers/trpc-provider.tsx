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
          url: `${API_URL.replace(/^http/, "ws")}/api/trpc`,
        })
      : null;

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
