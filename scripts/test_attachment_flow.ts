
import "dotenv/config";

import { db } from "../server/db";
import { cardAttachments } from "../shared/schema";
import { eq } from "drizzle-orm";

const API_BASE = "http://localhost:3001";
const CARD_ID = 5; // Using card ID 5 from previous list

async function testAttachmentFlow() {
    console.log("🚀 Starting Attachment Flow Verification...");

    // 1. Link Attachment
    console.log(`\n1. Linking attachment to Card ${CARD_ID}...`);
    const attachmentData = {
        name: "test_alarm.ogg",
        url: "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg",
        type: "audio",
        size: 1024,
        thumbnailUrl: null
    };

    let attachmentId;
    try {
        const res = await fetch(`${API_BASE}/api/cards/${CARD_ID}/attachments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attachmentData)
        });

        if (!res.ok) {
            throw new Error(`Failed to link attachment: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        console.log("✅ Attachment Linked:", data);
        attachmentId = data.id;
    } catch (error) {
        console.error("❌ Failed to link attachment:", error);
        process.exit(1);
    }

    // 2. Trigger Transcription
    console.log(`\n2. Triggering Transcription for Attachment ${attachmentId}...`);
    try {
        const res = await fetch(`${API_BASE}/api/cards/attachments/${attachmentId}/transcribe`, {
            method: 'POST'
        });

        if (!res.ok) {
            throw new Error(`Failed to trigger transcription: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        console.log("✅ Transcription Triggered:", data);
    } catch (error) {
        console.error("❌ Failed to trigger transcription:", error);
        process.exit(1);
    }

    // 3. Wait and Verify DB
    console.log("\n3. Waiting 10 seconds for transcription to complete...");
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log("Checking database...");
    try {
        const [attachment] = await db
            .select()
            .from(cardAttachments)
            .where(eq(cardAttachments.id, attachmentId));

        if (!attachment) {
            console.error("❌ Attachment not found in DB!");
            process.exit(1);
        }

        console.log("Attachment State:", {
            id: attachment.id,
            status: attachment.transcriptionStatus,
            transcriptionLength: attachment.transcription?.length
        });

        if (attachment.transcriptionStatus === 'completed' && attachment.transcription) {
            console.log("✅ Verification SUCCESS: Transcription completed and saved.");
            console.log("Transcription Preview:", attachment.transcription.substring(0, 100));
        } else {
            console.error("❌ Verification FAILED: Transcription not completed or missing.");
            process.exit(1);
        }

    } catch (error) {
        console.error("❌ DB Check Failed:", error);
        process.exit(1);
    }
}

testAttachmentFlow();
