import { z } from "zod";

export const standardCursorPaginationSchema = z.object({
    cursor: z.string().nullish(),
    limit: z.number().min(1).max(100).default(50),
});
