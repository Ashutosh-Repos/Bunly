var _a, _b;
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import config from "./config.js";
const { Pool } = pg;
const globalForPrisma = global;
const pool = (_a = globalForPrisma.pool) !== null && _a !== void 0 ? _a : new Pool({
    connectionString: config.db.url,
    max: config.nodeEnv === "production" ? 20 : 10, // Increased for high-load SPA resilience
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
const adapter = (_b = globalForPrisma.adapter) !== null && _b !== void 0 ? _b : new PrismaPg(pool);
export const prisma = globalForPrisma.prisma ||
    new PrismaClient({
        log: config.nodeEnv === "development"
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
