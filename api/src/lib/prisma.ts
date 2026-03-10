import { PrismaClient } from "../../generated/prisma/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
const { Pool } = pg;

const globalForPrisma = global as unknown as {
    prisma?: PrismaClient;
    adapter?: PrismaPg;
    pool?: pg.Pool;
};

const pool =
    globalForPrisma.pool ??
    new Pool({
        connectionString: process.env.DATABASE_URL,
    });

const adapter = globalForPrisma.adapter ?? new PrismaPg(pool);

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log:
            process.env.NODE_ENV === "development"
                ? ["error", "warn"]
                : ["error"],
        adapter,
    });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
    globalForPrisma.adapter = adapter;
    globalForPrisma.pool = pool;
}

export default prisma;
