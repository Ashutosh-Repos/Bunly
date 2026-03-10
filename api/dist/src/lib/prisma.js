var _a, _b;
import { PrismaClient } from "../../generated/prisma/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
const { Pool } = pg;
const globalForPrisma = global;
const pool = (_a = globalForPrisma.pool) !== null && _a !== void 0 ? _a : new Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = (_b = globalForPrisma.adapter) !== null && _b !== void 0 ? _b : new PrismaPg(pool);
export const prisma = globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === "development"
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
