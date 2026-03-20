import Anthropic from "@anthropic-ai/sdk";

// Allow up to 5 minutes for the rewrite
export const maxDuration = 300;

let lastRewriteTimestamp = 0;
export function getLastRewrite() { return lastRewriteTimestamp; }

const REWRITE_PROMPT = `You are compiling a knowledge base for Wyle, an AI assistant for Freewyld Foundry. Below are the contents of multiple source documents (transcripts, company docs, manual updates, etc.).

Please compile all of these into a single, clean, well-organized knowledge base document in Markdown format that:
- Synthesizes all information from all source documents
- Organizes content by topic with clear headers
- Removes contradictions (prefer information from "Manual Updates" or more recent docs)
- Eliminates duplicates
- Preserves all important facts, processes, and company knowledge
- Never includes customer names, emails, transaction data, or any client-specific information
- Includes a "Last compiled: [current date]" line at the top

Return only the compiled knowledge base document. No preamble, no explanation.`;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { password, trigger = "manual" } = body as { password?: string; trigger?: string };

    // Auth
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCron) {
      const correctPassword = process.env.WYLE_PASSWORD;
      if (!correctPassword) return Response.json({ error: "Password not configured" }, { status: 500 });
      if (password !== correctPassword) return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const effectiveTrigger = isCron ? "auto" : trigger;
    console.log(`[kb-rewrite] Starting rewrite (trigger: ${effectiveTrigger})`);

    const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
    if (!webhookUrl) return Response.json({ error: "WYLE_KB_WEBHOOK_URL not configured" }, { status: 500 });
    if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

    // Step 1: Fetch ALL source documents from the KB folder (NOT the master .md)
    console.log("[kb-rewrite] Fetching all source documents from KB folder...");
    const sourcesRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all_sources" }),
      redirect: "follow",
    });

    const sourcesRaw = await sourcesRes.text();
    let sources: { name: string; content: string }[] = [];
    try {
      const parsed = JSON.parse(sourcesRaw);
      if (parsed.error) return Response.json({ error: `Apps Script error: ${parsed.error}` }, { status: 502 });
      sources = parsed.sources || [];
    } catch {
      return Response.json({ error: "Failed to parse source documents response" }, { status: 502 });
    }

    if (sources.length === 0) return Response.json({ error: "No source documents found in KB folder" }, { status: 500 });

    // Compile all source docs into one string
    let compiledSources = "";
    sources.forEach(s => {
      compiledSources += `\n\n=== SOURCE: ${s.name} ===\n\n${s.content}`;
    });

    console.log(`[kb-rewrite] Fetched ${sources.length} source docs, total ${compiledSources.length} chars`);

    // Step 2: Send to Claude for compilation
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let rewrittenContent: string;
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 16384,
        system: REWRITE_PROMPT,
        messages: [{ role: "user", content: compiledSources.slice(0, 150000) }],
      });

      rewrittenContent = response.content
        .filter(b => b.type === "text")
        .map(b => b.type === "text" ? b.text : "")
        .join("");

      if (!rewrittenContent.trim()) {
        console.error("[kb-rewrite] Claude returned empty content");
        return Response.json({ error: "Rewrite produced empty content — master KB preserved" }, { status: 500 });
      }

      console.log(`[kb-rewrite] Compiled KB: ${rewrittenContent.length} chars`);
    } catch (err) {
      console.error("[kb-rewrite] Claude error:", err);
      return Response.json({ error: `Claude compilation failed: ${err}. Master KB preserved.` }, { status: 500 });
    }

    // Step 3: Write compiled content to the master .md file (overwrite)
    const writeRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "overwrite", note: rewrittenContent }),
    });

    if (!writeRes.ok) {
      const errText = await writeRes.text().catch(() => `HTTP ${writeRes.status}`);
      console.error("[kb-rewrite] Write error:", writeRes.status, errText);
      return Response.json({ error: `Drive write failed: ${writeRes.status}. Master KB may be preserved.` }, { status: 502 });
    }

    // Step 4: Log the rewrite
    const timestamp = new Date().toISOString();
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log",
          note: `triggered by: ${effectiveTrigger} — ${sources.length} source docs compiled`,
        }),
      });
    } catch (logErr) {
      console.error("[kb-rewrite] Log write failed:", logErr);
    }

    // Step 5: Bust cache
    lastRewriteTimestamp = Date.now();

    console.log(`[kb-rewrite] Complete: ${effectiveTrigger} trigger at ${timestamp}, ${sources.length} sources compiled`);

    return Response.json({
      success: true,
      trigger: effectiveTrigger,
      timestamp,
      sources_compiled: sources.length,
      message: "Knowledge base compiled successfully from source documents",
    });
  } catch (err) {
    console.error("[kb-rewrite] Error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
