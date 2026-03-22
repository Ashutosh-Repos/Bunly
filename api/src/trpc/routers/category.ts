import { router, publicProcedure } from "../router.js";
import { prisma } from "../../lib/prisma";

export const categoryRouter = router({
    getCategories: publicProcedure.query(async () => {
        const categories = await prisma.categories.findMany({
            orderBy: { name: "asc" },
        });
        return { success: true, categories };
    }),
});
