import "dotenv/config";
import { db } from "../server/db.js";
import { clientSubmissions, submissionAttachments } from "../shared/schema.js";
import { supabase, STORAGE_BUCKET } from "../server/supabase.js";

async function verify() {
    console.log("=== VERIFICATION STARTED ===");

    // 1. Check DB Submissions
    console.log("\n--- Database: Client Submissions ---");
    const subs = await db.select().from(clientSubmissions);
    console.log(`Total Submissions: ${subs.length}`);
    subs.forEach(s => console.log(`- [${s.id}] ${s.title} (${s.status})`));

    // 2. Check DB Attachments
    console.log("\n--- Database: Submission Attachments ---");
    const attachments = await db.select().from(submissionAttachments);
    console.log(`Total Attachments: ${attachments.length}`);
    attachments.forEach(a => console.log(`- [id:${a.id}] Sub:${a.submissionId} | ${a.fileName} | ${a.fileUrl}`));

    // 3. Check Supabase Storage
    console.log("\n--- Supabase Storage: 'client-uploads' ---");
    if (!supabase) {
        console.error("Supabase client not initialized (missing env vars?)");
        return;
    }

    const { data: files, error } = await supabase.storage.from(STORAGE_BUCKET).list('uploads');

    if (error) {
        console.error("Storage Error:", error);
    } else {
        console.log(`Files found in 'uploads/' folder: ${files?.length || 0}`);
        files?.forEach(f => console.log(`- ${f.name} (${(f.metadata?.size / 1024).toFixed(1)} KB)`));
    }

    // 4. Cross Reference
    console.log("\n--- Cross Reference ---");
    attachments.forEach(att => {
        // url format: .../client-uploads/uploads/timestamp_name
        // extraction depends on how url is saved.
        const urlPart = att.fileUrl.split('/').pop();
        const foundInStorage = files?.some(f => f.name === urlPart);
        // Note: This matches simple filename. Depending on folder structure might need tweaking.
        // But logging the list above is sufficient for manual check.
    });

    process.exit(0);
}

verify();
