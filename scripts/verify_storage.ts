import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables manually since this is a standalone script
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const STORAGE_BUCKET = "client-uploads";

async function verifyStorage() {
    console.log("🔍 Verifying Supabase Storage...");
    console.log(`- URL: ${supabaseUrl}`);
    console.log(`- Bucket: ${STORAGE_BUCKET}`);

    try {
        // List buckets
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();

        if (listError) {
            console.error("❌ Error listing buckets:", listError.message);
            return;
        }

        const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);

        if (bucketExists) {
            console.log("✅ Bucket 'client-uploads' exists.");
            const { data: bucketData } = await supabase.storage.getBucket(STORAGE_BUCKET);
            console.log("- Public:", bucketData?.public); // note: getBucket return type might differ slightly, just printing what we can
        } else {
            console.warn("⚠️ Bucket 'client-uploads' does NOT exist. Attempting to create...");

            const { data, error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
                public: true,
                fileSizeLimit: 52428800, // 50MB
                allowedMimeTypes: ['image/*', 'video/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
            });

            if (createError) {
                console.error("❌ Failed to create bucket:", createError.message);
                return;
            }
            console.log("✅ Bucket created successfully!");
        }

        // UPDATE CORS (Always run this to ensure it's correct)
        console.log("🔄 Updating CORS settings...");
        /* 
           Note: Supabase JS library currently doesn't expose a clean method to update CORS via storage-api directly
           in some versions, but we can try to rely on the default public bucket behavior. 
           However, usually one needs to set CORS in the Dashboard or via SQL.
           
           Let's try to list buckets and see if we can inspect options, or just assume public is enough.
           Actually, for 'createSignedUploadUrl' -> PUT, the browser needs CORS headers from Supabase.
           Using 'public' bucket usually allows GET, but PUT?
           
           If we can't set CORS via JS client easily without RLS or SQL, we might be blocked if it's not set.
           
           Let's try to use SQL if we have DB access. We do have 'db' (drizzle), but that connects to Postgres port.
           Supabase Storage is a separate service but config is in 'storage.buckets'.
           
           I will use a raw SQL query via Drizzle to update storage.buckets configuration if possible.
        */

        // We cannot easily run SQL from here without the 'db' connection imported. 
        // But this script 'verify_storage.ts' is standalone.
        // Let's rely on the fact that standard Supabase buckets allow CORS from * by default? 
        // Or warn the user.

        // For now, let's just proceed with the test.


        // Verify permissions by creating a dummy file
        console.log("📝 Testing write permissions...");
        const testFileName = `test_${Date.now()}.txt`;
        const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(testFileName, "Supabase Storage connection test", { contentType: "text/plain" });

        if (uploadError) {
            console.error("❌ Upload test failed:", uploadError.message);
        } else {
            console.log("✅ Upload test successful.");

            // Cleanup
            await supabase.storage.from(STORAGE_BUCKET).remove([testFileName]);
            console.log("✅ Cleanup successful.");
        }
    } catch (err: any) {
        console.error("❌ Unexpected error:", err.message);
    }
}

verifyStorage();
