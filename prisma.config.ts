import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// The Prisma CLI (migrate, studio, seed) uses the DIRECT (unpooled) Neon URL.
// The running app uses the pooled DATABASE_URL through the Neon adapter (lib/db.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
