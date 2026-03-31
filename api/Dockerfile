# ─── Build Stage ──────────────────────────────────────────────────
FROM node:22.14.0-alpine AS builder

WORKDIR /app

# Corepack to manage pnpm versions natively in node
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Copy manifest files specifically for caching
COPY pnpm-lock.yaml package.json ./

# Install ALL dependencies (including devDependencies)
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Generate Prisma Client and Build TypeScript
RUN pnpm exec prisma generate
RUN pnpm build

# Sanity Check: Ensure the entry point exists before pruning
RUN [ -f dist/index.js ] || (echo "Building produced incorrect structure! dist/index.js not found." && ls -R dist && exit 1)

# Prune to production only dependencies
RUN pnpm prune --prod

# ─── Runtime Stage ────────────────────────────────────────────────
FROM node:22.14.0-alpine AS runner

WORKDIR /app

# Production environment settings
ENV NODE_ENV=production
ENV PORT=4000

# Copy minimal files required for execution
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma/schema.prisma ./prisma/
COPY --from=builder /app/prisma/migrations ./prisma/migrations
COPY --from=builder /app/prisma.config.js ./

# Healthcheck for orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

EXPOSE 4000

CMD ["node", "dist/index.js"]
