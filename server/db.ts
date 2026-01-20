import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("CRITICAL: DATABASE_URL is not set. Application will fail to connect limits.");
}

// Use a dummy connection string if DATABASE_URL is not set to prevent startup crash
// This allows the /api/diagnostics endpoint to run and report the error
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://param:param@localhost:5432/missing_db_url",
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });
