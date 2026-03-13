import { PrismaClient } from "../../generated/prisma/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import config from "./config.js";
const { Pool } = pg;

const globalForPrisma = global as unknown as {
    prisma?: PrismaClient;
    adapter?: PrismaPg;
    pool?: pg.Pool;
};

const pool =
    globalForPrisma.pool ??
    new Pool({
        connectionString: config.db.url,
    });

const adapter = globalForPrisma.adapter ?? new PrismaPg(pool);

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log:
            config.nodeEnv === "development"
                ? ["error", "warn"]
                : ["error"],
        adapter,
    });

if (config.nodeEnv !== "production") {
    globalForPrisma.prisma = prisma;
    globalForPrisma.adapter = adapter;
    globalForPrisma.pool = pool;
}

export default prisma;
