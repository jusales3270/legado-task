
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function inspectUsersTable() {
    try {
        console.log("Inspecting 'users' table schema...");
        const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (error) {
        console.error("Error inspecting table:", error);
    }
    process.exit(0);
}

inspectUsersTable();
