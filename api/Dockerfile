# ─── Build Stage ──────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Corepack to manage pnpm versions natively in node
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ─── Runtime Stage ────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Allow Fastify to bind to 0.0.0.0
ENV NODE_ENV=production
ENV PORT=4000

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Only production dependencies
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --prod --frozen-lockfile

# Compiled code from builder
COPY --from=builder /app/dist ./dist
# Prisma generated client
COPY --from=builder /app/prisma ./prisma
RUN pnpm exec prisma generate

# Healthcheck for orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

EXPOSE 4000

CMD ["node", "dist/index.js"]
