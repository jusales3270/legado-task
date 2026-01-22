import OpenAI from "openai";
import fs from "fs";
import path from "path";
import os from "os";

// Initialize OpenAI client lazily to avoid issues with basic import
let openai: OpenAI | null = null;

function getOpenAIClient() {
    if (!openai) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is not set");
        }
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    return openai;
}

export async function transcribeAudio(fileUrl: string): Promise<string> {
    try {
        const client = getOpenAIClient();

        console.log("Transcribing file:", fileUrl);

        // If fileUrl is a remote URL, we might need to download it first.
        // However, if the file is stored locally (as seen in routes.ts uploads),
        // we might have a local path or we need to handle the download.
        // Looking at routes.ts, uploads seem to go to specific dirs or Supabase.
        // If Supabase, we need to download.

        // For now, assuming we might need to handle both, but let's assume it's accessible.
        // If it's a URL, we fetch it.

        let filePath = fileUrl;
        let tempFile = false;

        if (fileUrl.startsWith('http')) {
            // Download to temp file
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);

            const buffer = await response.arrayBuffer();
            // Try to deduce extension from URL or content-type
            const urlExt = path.extname(fileUrl).split('?')[0];
            const ext = urlExt || '.mp3'; // Default to mp3 if no extension found

            const tempPath = path.join(os.tmpdir(), `transcribe_${Date.now()}${ext}`);
            fs.writeFileSync(tempPath, Buffer.from(buffer));
            filePath = tempPath;
            tempFile = true;
        }

        // Call Whisper API
        const transcription = await client.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: "whisper-1",
        });

        // Cleanup temp file
        if (tempFile) {
            fs.unlinkSync(filePath);
        }

        return transcription.text;
    } catch (error: any) {
        console.error("OpenAI Whisper Error:", error);
        throw new Error(`Transcription failed: ${error.message}`);
    }
}
