
import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function inspectTable() {
    try {
        const result = await db.execute(sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'card_attachments';
        `);
        console.log("Columns:", result.rows);
        process.exit(0);
    } catch (error) {
        console.error("Error inspecting table:", error);
        process.exit(1);
    }
}

inspectTable();
