import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = "client-uploads";

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing keys");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSignedUrl() {
    console.log("Testing createSignedUploadUrl...");

    const fileName = "test_video.mp4";
    const timestamp = Date.now();
    const filePath = `uploads/${timestamp}_${fileName}`;

    try {
        const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUploadUrl(filePath);

        if (error) {
            console.error("❌ Error creating signed URL:", error);
        } else {
            console.log("✅ Success!");
            console.log("Token:", data.token);
            console.log("Signed URL:", data.signedUrl);
            console.log("Path:", data.path);
        }
    } catch (err) {
        console.error("❌ Exception:", err);
    }
}

testSignedUrl();
