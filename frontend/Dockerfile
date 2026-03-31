# ─── Build Stage ──────────────────────────────────────────────────
FROM node:22.14.0-alpine AS builder

WORKDIR /app

# Corepack to manage pnpm versions natively in node
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Copy API to install dependencies for frontend type-checking
COPY api/package.json api/pnpm-lock.yaml ./api/
COPY api/prisma ./api/prisma/
WORKDIR /app/api
RUN pnpm install --frozen-lockfile
COPY api ./

# Switch context to frontend
WORKDIR /app/frontend

# Copy frontend manifest and install
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build-time envs for Next.js (Injection)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BETTER_AUTH_URL
ARG NEXT_PUBLIC_GOOGLE_ENABLED
ARG NEXT_PUBLIC_GITHUB_ENABLED
ARG API_ORIGIN

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL
ENV NEXT_PUBLIC_GOOGLE_ENABLED=$NEXT_PUBLIC_GOOGLE_ENABLED
ENV NEXT_PUBLIC_GITHUB_ENABLED=$NEXT_PUBLIC_GITHUB_ENABLED
ENV API_ORIGIN=$API_ORIGIN

# Copy frontend source
COPY frontend ./

RUN pnpm build

# ─── Runtime Stage ────────────────────────────────────────────────
FROM node:22.14.0-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Next.js standalone server defaults to port 3000
ENV PORT=3000

# Next.js 16 standalone output doesn't require node_modules at runtime
COPY --from=builder /app/frontend/public ./public
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./.next/static

# Healthcheck for orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

EXPOSE 3000

CMD ["node", "server.js"]
