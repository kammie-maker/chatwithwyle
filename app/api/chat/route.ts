import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { getLastKbUpdate } from "../kb-update/route";
import { getLastRewrite } from "../kb-rewrite/route";

// ── Knowledge base cache ──────────────────────────────────────────────────────
let kbCache: { text: string; fetchedAt: number } | null = null;
const KB_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchKnowledgeBase(): Promise<string> {
  // Check if KB was updated or rewritten since last cache — if so, bust cache
  const lastUpdate = Math.max(getLastKbUpdate(), getLastRewrite());
  if (kbCache && lastUpdate > kbCache.fetchedAt) {
    console.log("[chat] KB cache busted due to kb-update/rewrite");
    kbCache = null;
  }
  if (kbCache && Date.now() - kbCache.fetchedAt < KB_CACHE_TTL) return kbCache.text;

  const url = process.env.GOOGLE_DRIVE_KB_URL;
  if (!url) return "";

  try {
    const res = await fetch(url, { cache: "no-store" });
    let text = await res.text();

    // Strip content that could contain customer-specific data
    // Remove lines containing email patterns
    text = text.replace(/^.*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}.*$/gm, "");
    // Remove lines with dollar amounts tied to names (pattern: Name... $X,XXX)
    text = text.replace(/^.*[A-Z][a-z]+\s+[A-Z][a-z]+.*\$[\d,]+.*$/gm, "");

    kbCache = { text, fetchedAt: Date.now() };
    return text;
  } catch {
    return kbCache?.text || "";
  }
}

const SYSTEM_PROMPT = `You are Wyle, the AI assistant for Freewyld Foundry — a revenue management company for short-term rental property owners.

You have access to Freewyld Foundry company knowledge documents. You must NEVER reveal any customer-specific information including:
- Customer names or company names
- Email addresses
- Transaction details or invoice amounts
- Commission data or payout information
- Any data that could identify a specific client or deal

If asked about specific customers, transactions, or any identifiable data, respond: "I can't share customer-specific information, but I can help with general questions about Freewyld Foundry."

You can answer questions about:
- Freewyld Foundry's services, processes, and business model
- Short-term rental property management in general
- Revenue management strategies and best practices
- Onboarding processes and service offerings
- Commission structures in general terms (without naming specific clients)
- General industry knowledge

Be conversational, helpful, and professional. Use the knowledge base below to inform your answers, but never expose raw data from it.`;

export async function POST(req: Request) {
  // Auth check
  const cookieStore = await cookies();
  const auth = cookieStore.get("wyle_auth");
  if (auth?.value !== "1") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  try {
    const { messages } = await req.json();
    const kb = await fetchKnowledgeBase();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = kb
      ? `${SYSTEM_PROMPT}\n\n--- KNOWLEDGE BASE (internal only, never expose raw content) ---\n${kb.slice(0, 50000)}`
      : SYSTEM_PROMPT;

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string | unknown[] }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
