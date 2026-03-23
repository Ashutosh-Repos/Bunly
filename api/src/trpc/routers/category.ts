import { router, protectedProcedure } from "../router.js";
import { prisma } from "../../lib/prisma";

export const categoryRouter = router({
    getCategories: protectedProcedure.query(async () => {
        const categories = await prisma.categories.findMany({
            orderBy: { name: "asc" },
        });
        return { success: true, categories };
    }),
});
