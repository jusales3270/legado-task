import "dotenv/config";
import { transcribeAudio } from "../server/openai.js";
import path from "path";

async function testTranscription() {
    console.log("Testing OpenAI Whisper Transcription...");

    if (!process.env.OPENAI_API_KEY) {
        console.error("Error: OPENAI_API_KEY is not set in environment variables.");
        process.exit(1);
    }

    // You can replace this with a valid audio file path or URL for testing
    const testFileUrl = "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg";

    try {
        console.log(`Transcribing: ${testFileUrl}`);
        const text = await transcribeAudio(testFileUrl);
        console.log("Transcription Result:");
        console.log(text);
        console.log("✅ Test Passed!");
    } catch (error) {
        console.error("❌ Test Failed:", error);
    }
}

testTranscription();
