# ─── Build Stage ──────────────────────────────────────────────────
FROM node:22.14.0-alpine AS builder

WORKDIR /app

# Corepack to manage pnpm versions natively in node
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec prisma generate
RUN pnpm build

# ─── Runtime Stage ────────────────────────────────────────────────
FROM node:22.14.0-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Only production dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

# Healthcheck for orchestrators (Port 4001)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4001/health || exit 1

EXPOSE 4001

CMD ["node", "dist/index.js"]
