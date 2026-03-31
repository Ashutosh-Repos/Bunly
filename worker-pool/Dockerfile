# ─── Build Stage ──────────────────────────────────────────────────
FROM node:22.14.0-alpine AS builder

WORKDIR /app

# Corepack to manage pnpm versions natively in node
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Copy manifest files specifically for caching
COPY pnpm-lock.yaml package.json ./
COPY prisma ./prisma/
COPY prisma.config.js ./

# Install ALL dependencies (including devDependencies)
# This will now trigger your "postinstall": "prisma generate" successfully!
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Build TypeScript
RUN pnpm build

# Prune to production only dependencies (ignore scripts so it doesn't re-trigger prisma generate without the devDependency installed)
RUN pnpm prune --prod --ignore-scripts

# ─── Runtime Stage ────────────────────────────────────────────────
FROM node:22.14.0-alpine AS runner

WORKDIR /app

# Production environment settings
ENV NODE_ENV=production

# Install dumb-init for graceful shutdown signal forwarding
RUN apk add --no-cache dumb-init

# Create secure workspace
RUN mkdir -p /app && chown -R node:node /app

# Switch to non-privileged user to protect container host
USER node

# Copy minimal files required for execution (chowned securely)
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma/schema.prisma ./prisma/
COPY --from=builder --chown=node:node /app/prisma.config.js ./

# Healthcheck for orchestrators (Port 4001)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4001/health || exit 1

EXPOSE 4001

# Start the worker with dumb-init to reap zombie child processes
CMD ["dumb-init", "node", "dist/index.js"]
