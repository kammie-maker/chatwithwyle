import Anthropic from "@anthropic-ai/sdk";
import { getLastKbUpdate } from "../kb-update/route";

// Allow up to 5 minutes for the rewrite (Claude processing + Drive writes)
export const maxDuration = 300;

// Make cache-bust accessible
let lastRewriteTimestamp = 0;
export function getLastRewrite() { return lastRewriteTimestamp; }

const REWRITE_PROMPT = `You are maintaining a knowledge base for Wyle, an AI assistant for Freewyld Foundry. Below is the current knowledge base followed by recent updates. Please rewrite the entire knowledge base as a single, clean, well-organized document that:
- Incorporates all new information from recent updates
- Removes any contradictions (always prefer newer info)
- Removes outdated or superseded information
- Eliminates duplicates
- Keeps all content organized by topic with clear headers
- Never includes customer names, emails, transaction data, or any client-specific information
Return only the rewritten knowledge base document. No preamble, no explanation.`;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { password, trigger = "manual" } = body as { password?: string; trigger?: string };

    // Auth: Vercel cron sends Authorization header
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCron) {
      // Manual call — verify password
      const correctPassword = process.env.WYLE_PASSWORD;
      if (!correctPassword) return Response.json({ error: "Password not configured" }, { status: 500 });
      if (password !== correctPassword) return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const effectiveTrigger = isCron ? "auto" : trigger;

    console.log(`[kb-rewrite] Starting rewrite (trigger: ${effectiveTrigger})`);

    const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
    if (!webhookUrl) return Response.json({ error: "WYLE_KB_WEBHOOK_URL not configured" }, { status: 500 });

    // Step 1: Fetch current KB content directly from Google Drive
    const kbFileId = "1IjtO_gdiK2-lFevZ66E6KRTuzy-J89xp";
    const driveUrl = `https://drive.google.com/uc?export=download&id=${kbFileId}`;

    console.log("[kb-rewrite] Fetching KB from Google Drive...");
    let currentKb = "";

    // Google Drive download URLs redirect — need to follow
    const kbRes = await fetch(driveUrl, { redirect: "follow" });
    if (kbRes.ok) {
      const text = await kbRes.text();
      // Check it's not an HTML error/virus scan page
      if (text && !text.trimStart().startsWith("<")) {
        currentKb = text;
      }
    }

    // Fallback: try via Apps Script
    if (!currentKb.trim()) {
      console.log("[kb-rewrite] Drive direct failed, trying Apps Script...");
      if (webhookUrl) {
        try {
          const scriptRes = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "read_kb" }),
            redirect: "follow",
          });
          const raw = await scriptRes.text();
          try {
            const parsed = JSON.parse(raw);
            currentKb = parsed.content || "";
          } catch {
            if (raw && !raw.trimStart().startsWith("<")) currentKb = raw;
          }
        } catch (e) {
          console.error("[kb-rewrite] Apps Script read failed:", e);
        }
      }
    }

    if (!currentKb.trim()) return Response.json({ error: "Failed to fetch KB content" }, { status: 502 });
    console.log(`[kb-rewrite] KB fetched: ${currentKb.length} chars`);

    console.log(`[kb-rewrite] Fetched KB: ${currentKb.length} chars`);

    // Step 2: Send to Claude for rewriting
    if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let rewrittenContent: string;
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: REWRITE_PROMPT,
        messages: [{ role: "user", content: currentKb.slice(0, 80000) }],
      });

      rewrittenContent = response.content
        .filter(b => b.type === "text")
        .map(b => b.type === "text" ? b.text : "")
        .join("");

      if (!rewrittenContent.trim()) {
        console.error("[kb-rewrite] Claude returned empty content");
        return Response.json({ error: "Rewrite produced empty content — original KB preserved" }, { status: 500 });
      }

      console.log(`[kb-rewrite] Rewritten: ${rewrittenContent.length} chars`);
    } catch (err) {
      console.error("[kb-rewrite] Claude error:", err);
      return Response.json({ error: `Claude rewrite failed: ${err}. Original KB preserved.` }, { status: 500 });
    }

    // Step 3: Write rewritten content back to KB doc (overwrite)
    const writeRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "overwrite", note: rewrittenContent }),
    });

    if (!writeRes.ok) {
      const errText = await writeRes.text().catch(() => `HTTP ${writeRes.status}`);
      console.error("[kb-rewrite] Write error:", writeRes.status, errText);
      return Response.json({ error: `Drive write failed: ${writeRes.status}. Original KB may be preserved.` }, { status: 502 });
    }

    // Step 4: Write rewrite log entry
    const timestamp = new Date().toISOString();
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log",
          note: `Rewrite completed: ${timestamp} — triggered by: ${effectiveTrigger}`,
        }),
      });
    } catch (logErr) {
      console.error("[kb-rewrite] Log write failed:", logErr);
      // Non-fatal — rewrite already succeeded
    }

    // Step 5: Bust cache
    lastRewriteTimestamp = Date.now();
    // Also bust the kb-update cache by importing and triggering
    // (the chat route checks getLastKbUpdate which is separate)

    console.log(`[kb-rewrite] Complete: ${effectiveTrigger} trigger at ${timestamp}`);

    return Response.json({
      success: true,
      trigger: effectiveTrigger,
      timestamp,
      message: "Knowledge base rewritten successfully",
    });
  } catch (err) {
    console.error("[kb-rewrite] Error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
