import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    // Neon-Vercel integration injects DATABASE_URL_UNPOOLED (direct TCP).
    // Migrations must use a direct connection — pooled PgBouncer connections
    // can serialize DDL statements in unexpected ways.
    url: (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)!,
  },
});
