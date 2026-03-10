var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import prisma from "../src/lib/prisma";
const categories = [
    { name: "Film & Animation", slug: "film-animation" },
    { name: "Autos & Vehicles", slug: "autos-vehicles" },
    { name: "Music", slug: "music" },
    { name: "Pets & Animals", slug: "pets-animals" },
    { name: "Sports", slug: "sports" },
    { name: "Travel & Events", slug: "travel-events" },
    { name: "Gaming", slug: "gaming" },
    { name: "People & Blogs", slug: "people-blogs" },
    { name: "Comedy", slug: "comedy" },
    { name: "Entertainment", slug: "entertainment" },
    { name: "News & Politics", slug: "news-politics" },
    { name: "Howto & Style", slug: "howto-style" },
    { name: "Education", slug: "education" },
    { name: "Science & Technology", slug: "science-technology" },
    { name: "Nonprofits & Activism", slug: "nonprofits-activism" },
];
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🌱 Seeding categories...");
        for (const category of categories) {
            yield prisma.categories.upsert({
                where: { slug: category.slug },
                update: {},
                create: category,
            });
        }
        console.log("✅ Categories seeded successfully.");
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
