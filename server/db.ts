import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("CRITICAL: DATABASE_URL is not set. Application will fail to connect limits.");
}

// Use a dummy connection string if DATABASE_URL is not set to prevent startup crash
// This allows the /api/diagnostics endpoint to run and report the error
// Append ?pgbouncer=true to connection string if using Supabase Transaction Pooler (port 6543)
// This disables prepared statements which are not supported in transaction mode
const rawUrl = process.env.DATABASE_URL;
let connectionString = rawUrl || "postgres://param:param@localhost:5432/missing_db_url";

if (rawUrl && rawUrl.includes("6543") && !rawUrl.includes("pgbouncer=true")) {
  connectionString += rawUrl.includes("?") ? "&pgbouncer=true" : "?pgbouncer=true";
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });
