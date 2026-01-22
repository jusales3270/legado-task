import "dotenv/config";
import { uploadToSupabase, ensureBucketExists } from "../server/supabase.js";
import fs from "fs";
import path from "path";
import os from "os";

async function testUpload() {
    console.log("Testing Supabase Upload...");

    // Check Bucket
    console.log("Checking bucket existence...");
    const bucketReady = await ensureBucketExists();
    if (!bucketReady) {
        console.error("❌ Bucket check failed. Check credentials or permissions.");
        return;
    }
    console.log("✅ Bucket check passed.");

    // Create dummy file
    const buffer = Buffer.from("This is a test file for upload debugging.");
    const fileName = `debug_upload_${Date.now()}.txt`;

    console.log(`Attempting to upload: ${fileName}`);

    try {
        const result = await uploadToSupabase(buffer, fileName, "text/plain");

        if (result) {
            console.log("✅ Upload successful!");
            console.log("URL:", result.url);
            console.log("Path:", result.path);
        } else {
            console.error("❌ Upload failed. Result is null.");
        }
    } catch (error) {
        console.error("❌ Upload failed with error:", error);
    }
}

testUpload();
