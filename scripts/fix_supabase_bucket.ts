import "dotenv/config";
import { supabase, STORAGE_BUCKET } from "../server/supabase.js";

async function fixBucket() {
    console.log(`Updating bucket: ${STORAGE_BUCKET}`);

    if (!supabase) {
        console.error("Supabase client not initialized.");
        process.exit(1);
    }

    // Update bucket to allow common mime types or all
    const { data, error } = await supabase.storage.updateBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/webm',
            'video/quicktime',
            'audio/mpeg',
            'audio/wav',
            'audio/ogg',
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
    });

    if (error) {
        console.error("❌ Failed to update bucket:", error.message);
    } else {
        console.log("✅ Bucket updated successfully!");
        console.log("Details:", data);
    }
}

fixBucket();
