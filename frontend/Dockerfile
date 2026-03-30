# ─── Build Stage ──────────────────────────────────────────────────
FROM node:22.14.0-alpine AS builder

WORKDIR /app

# Corepack to manage pnpm versions natively in node
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Build-time envs for Next.js (Injection)
# These are required because Next.js bakes them into the client-side JS at build time.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BETTER_AUTH_URL
ARG NEXT_PUBLIC_S3_BUCKET_NAME
ARG NEXT_PUBLIC_S3_REGION
ARG NEXT_PUBLIC_GOOGLE_ENABLED
ARG NEXT_PUBLIC_GITHUB_ENABLED

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL
ENV NEXT_PUBLIC_S3_BUCKET_NAME=$NEXT_PUBLIC_S3_BUCKET_NAME
ENV NEXT_PUBLIC_S3_REGION=$NEXT_PUBLIC_S3_REGION
ENV NEXT_PUBLIC_GOOGLE_ENABLED=$NEXT_PUBLIC_GOOGLE_ENABLED
ENV NEXT_PUBLIC_GITHUB_ENABLED=$NEXT_PUBLIC_GITHUB_ENABLED

COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ─── Runtime Stage ────────────────────────────────────────────────
FROM node:22.14.0-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Next.js standalone server defaults to port 3000
ENV PORT=3000

# Next.js 16 standalone output doesn't require node_modules at runtime
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Healthcheck for orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

EXPOSE 3000

CMD ["node", "server.js"]
