
import "dotenv/config";
import { db } from "../server/db";
import { cards } from "../shared/schema";

async function listCards() {
    try {
        const result = await db.select().from(cards).limit(5);
        console.log("Cards:", JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error("Error listing cards:", error);
        process.exit(1);
    }
}

listCards();
