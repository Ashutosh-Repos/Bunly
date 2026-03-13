import { PrismaClient } from "../../generated/prisma/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import config from "../env.js";

const globalForPrisma = global as unknown as {
    prisma?: PrismaClient;
    adapter?: PrismaPg;
};

const adapter =
    globalForPrisma.adapter ??
    new PrismaPg({
        connectionString: config.db.url,
    });

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
}

export default prisma;
