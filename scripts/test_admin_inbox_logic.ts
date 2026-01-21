import "dotenv/config";
import { db } from "../server/db.js";
import { clientSubmissions, users, submissionAttachments } from "../shared/schema.js";
import { desc, eq } from "drizzle-orm";

async function verifyInboxLogic() {
    console.log("Verifying Admin Inbox Logic...");

    try {
        const allSubmissions = await db
            .select()
            .from(clientSubmissions)
            .orderBy(desc(clientSubmissions.createdAt));

        console.log(`Found ${allSubmissions.length} submissions.`);

        const result = await Promise.all(
            allSubmissions.map(async (submission) => {
                const [client] = await db
                    .select({ id: users.id, name: users.name, email: users.email })
                    .from(users)
                    .where(eq(users.id, submission.clientId));

                const attachments = await db
                    .select()
                    .from(submissionAttachments)
                    .where(eq(submissionAttachments.submissionId, submission.id));

                return {
                    id: submission.id,
                    title: submission.title,
                    client: client ? client.name : "Unknown",
                    attachmentsCount: attachments.length,
                    attachmentNames: attachments.map(a => a.fileName)
                };
            })
        );

        console.log("Inbox Data Preview:");
        console.table(result);

    } catch (error) {
        console.error("Logic failed:", error);
    } finally {
        process.exit(0);
    }
}

verifyInboxLogic();
