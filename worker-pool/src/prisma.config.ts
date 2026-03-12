// Prisma config for worker-pool
// Points to the shared schema in the api package and generates the client locally
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
    schema: "../api/prisma/schema.prisma",
    datasource: {
        url: process.env["DATABASE_URL"],
    },
});
