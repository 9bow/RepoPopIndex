/**
 * Production-safe migration script.
 *
 * Uses a PostgreSQL session-level advisory lock so that concurrent Vercel
 * preview builds targeting the same database do not race each other.
 * The lock is automatically released when the connection closes.
 *
 * Env priority (highest first):
 *   DATABASE_URL_UNPOOLED  — Neon direct connection (set by Neon-Vercel integration)
 *   DATABASE_URL           — fallback (may be pooled)
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(__dirname, "..", "drizzle");

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("❌  DATABASE_URL_UNPOOLED or DATABASE_URL is required");
  process.exit(1);
}

// Two-int4 advisory lock key (classid, objid) uniquely identifying this project.
const LOCK_CLASS = 5938;
const LOCK_OBJ = 2716;

const sql = postgres(url, { max: 1, connect_timeout: 30, ssl: "require" });
const db = drizzle(sql);

try {
  // pg_advisory_lock blocks until the lock is available — prevents two
  // concurrent migrations from corrupting __drizzle_migrations.
  await sql`SELECT pg_advisory_lock(${LOCK_CLASS}, ${LOCK_OBJ})`;
  console.log("🔒  Migration lock acquired");

  console.log("⏳  Applying migrations from", migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log("✅  Migrations complete");
} catch (err) {
  console.error("❌  Migration failed:", err.message ?? err);
  process.exit(1);
} finally {
  // Release advisory lock explicitly before closing so that a crash doesn't
  // hold the lock for the remainder of the session.
  await sql`SELECT pg_advisory_unlock(${LOCK_CLASS}, ${LOCK_OBJ})`.catch(() => {});
  await sql.end({ timeout: 3 });
}
