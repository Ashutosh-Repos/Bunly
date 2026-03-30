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

# Allow Fastify to bind to 0.0.0.0
ENV NODE_ENV=production
ENV PORT=4000

# Only production dependencies
# We copy node_modules from builder to avoid re-installing and ensuring we have the generated Prisma client
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Healthcheck for orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

EXPOSE 4000

CMD ["node", "dist/index.js"]
