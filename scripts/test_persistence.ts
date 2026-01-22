
import "dotenv/config";


const API_BASE = "http://localhost:3001";
// Use a board ID that has cards with attachments. 
// From previous steps, card 5 has an attachment. We need to find which board card 5 belongs to.
// Or we can just list boards and pick one.

async function verifyBoardPersistence() {
    console.log("🚀 Verifying Board Persistence...");

    // 1. Get User Boards
    console.log("Fetching boards for user 1...");
    const boardsRes = await fetch(`${API_BASE}/api/boards?userId=1`);
    const boards = await boardsRes.json();

    if (!Array.isArray(boards) || boards.length === 0) {
        console.error("❌ No boards found for user 1");
        process.exit(1);
    }

    const boardId = boards[0].id;
    console.log(`Checking Board ID: ${boardId}`);

    // 2. Fetch Board Details
    const boardDetailRes = await fetch(`${API_BASE}/api/boards/${boardId}`);
    const boardData = await boardDetailRes.json();

    console.log(`Board has ${boardData.cards?.length} cards.`);

    // 3. Check for attachments
    let foundAttachment = false;
    for (const card of boardData.cards) {
        if (card.attachments && card.attachments.length > 0) {
            console.log(`✅ Card ${card.id} has ${card.attachments.length} attachments.`);
            console.log("Sample Attachment:", card.attachments[0]);
            foundAttachment = true;
        }
    }

    if (foundAttachment) {
        console.log("✅ SUCCESS: Attachments are persisting in board fetch!");
    } else {
        console.warn("⚠️ No attachments found in this board. You might need to add one first.");
    }
}

verifyBoardPersistence();
