import { getServerSession } from "next-auth";

// Reference to the KB cache in /api/chat — we'll export a cache-bust timestamp
// that /api/chat checks on each request
let lastKbUpdate = 0;
export function getLastKbUpdate() { return lastKbUpdate; }

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text } = body;

    const session = await getServerSession();
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!text || typeof text !== "string" || !text.trim()) {
      return Response.json({ error: "text is required" }, { status: 400 });
    }

    const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
    if (!webhookUrl) {
      return Response.json({ error: "WYLE_KB_WEBHOOK_URL not configured. Set up a Google Apps Script web app to write to the KB doc." }, { status: 500 });
    }

    // Format the update with timestamp
    const timestamp = new Date().toISOString();
    const formattedText = `--- Update ${timestamp} ---\n${text.trim()}\n`;

    // POST to Google Apps Script webhook — append to separate "Wyle Manual Updates.md"
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "append_updates", note: formattedText }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      console.error("[kb-update] Webhook error:", res.status, errText);
      return Response.json({ error: `Drive write failed: ${res.status}` }, { status: 502 });
    }

    // Bust the KB cache by updating the global timestamp
    lastKbUpdate = Date.now();
    console.log(`[kb-update] KB updated at ${timestamp}, cache busted`);

    return Response.json({
      success: true,
      message: "Knowledge base updated",
      timestamp,
    });
  } catch (err) {
    console.error("[kb-update] Error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
