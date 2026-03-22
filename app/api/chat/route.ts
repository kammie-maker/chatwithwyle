import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { getLastKbUpdate } from "../kb-update/route";
import { getLastRewrite } from "../kb-rewrite/route";
import { fetchAgentFiles } from "../kb-agents/route";

let kbCache: { text: string; fetchedAt: number } | null = null;
const KB_CACHE_TTL = 60 * 60 * 1000;

async function fetchKnowledgeBase(): Promise<string> {
  const lastUpdate = Math.max(getLastKbUpdate(), getLastRewrite());
  if (kbCache && lastUpdate > kbCache.fetchedAt) { kbCache = null; }
  if (kbCache && Date.now() - kbCache.fetchedAt < KB_CACHE_TTL) return kbCache.text;
  const url = process.env.GOOGLE_DRIVE_KB_URL;
  if (!url) return "";
  try {
    const res = await fetch(url, { cache: "no-store" });
    let text = await res.text();
    text = text.replace(/^.*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}.*$/gm, "");
    text = text.replace(/^.*[A-Z][a-z]+\s+[A-Z][a-z]+.*\$[\d,]+.*$/gm, "");
    kbCache = { text, fetchedAt: Date.now() };
    return text;
  } catch { return kbCache?.text || ""; }
}

type ChatMode = "sales" | "client-success" | "fulfillment" | "onboarding";
type InteractionMode = "client" | "research";

const MODE_ROUTING: Record<ChatMode, string> = {
  sales: "You are operating in Sales Mode. The Sales Agent leads all responses. Draw on the Revenue Expert for data-backed justifications. Draw on the CEO Agent when vision, culture, or brand story adds weight to a close. Your goal: help the rep close the deal on this call.",
  "client-success": "You are operating in Client Success Mode. The Revenue Expert leads all responses. Draw on the CEO Agent for culture and relationship context. Draw on the Sales Agent only when retention or upsell is relevant. Your goal: help the CS team strengthen client relationships and resolve issues.",
  fulfillment: "You are operating in Fulfillment Mode. The Revenue Expert leads all responses. Draw on the CEO Agent for culture and standards context. Your goal: help the fulfillment team execute revenue management with precision and consistency.",
  onboarding: "You are operating in Onboarding Mode. The Revenue Expert and Sales Agent share the lead. Draw on the CEO Agent for culture and expectation-setting. Your goal: help the team set new clients up for success and establish strong foundations.",
};

const FALLBACK_PERSONA = `You are Wyle, the AI assistant for Freewyld Foundry — a revenue management company for short-term rental property owners.

You must NEVER reveal any customer-specific information including:
- Customer names or company names
- Email addresses
- Transaction details or invoice amounts
- Commission data or payout information
- Any data that could identify a specific client or deal

If asked about specific customers, transactions, or any identifiable data, respond: "I can't share customer-specific information, but I can help with general questions about Freewyld Foundry."

Be conversational, helpful, and professional. Use the knowledge base below to inform your answers, but never expose raw data from it.`;

const CLIENT_FORMAT_INSTRUCTION = `CRITICAL FORMAT INSTRUCTION — APPLIES TO EVERY RESPONSE IN EVERY MODE WITHOUT EXCEPTION:

- Never use em dashes anywhere in any response
- Never use colons anywhere in response text
- Never use bold text inside paragraphs
- Assume every query is mid-conversation
- Never write greetings or openers of any kind

All other formatting and structural rules are defined by the active Skill file for the current chat mode. Follow the Skill file instructions exactly.`;

const RESEARCH_FORMAT_INSTRUCTION = `CRITICAL FORMAT INSTRUCTION — INTERNAL RESEARCH MODE:

You are speaking directly to the Freewyld team member, not to a client. Do not write client-facing scripts. Write coaching, strategy, context, and analysis.

Structure every response exactly like this:

## SIMPLE
A direct, concise answer to the question in 2-3 sentences. Speak to the rep. No scripts.

[[EXPAND_PROMPT]]

FORMATTING RULES:
- Never use em dashes
- Never use colons in response text
- Never use bold text inside paragraphs
- Assume mid-conversation
- No greetings
- No INTERNAL FULL PICTURE section. Everything here is already internal`;

async function buildSystemPrompt(mode: ChatMode, interactionMode: InteractionMode = "client"): Promise<string> {
  const [agents, kb] = await Promise.all([fetchAgentFiles(), fetchKnowledgeBase()]);
  const persona = agents.persona || FALLBACK_PERSONA;
  const routing = MODE_ROUTING[mode] || MODE_ROUTING.sales;
  const parts: string[] = [];

  // 0. Format instruction based on interaction mode
  parts.push(interactionMode === "research" ? RESEARCH_FORMAT_INSTRUCTION : CLIENT_FORMAT_INSTRUCTION);

  // 1. Base identity
  parts.push("=== WYLE PERSONA & VOICE ===\n" + persona);

  // 2. Agent definitions
  if (agents.sales) parts.push("=== AGENT: SALES ===\n" + agents.sales);
  if (agents.ceo) parts.push("=== AGENT: CEO (ERIC) ===\n" + agents.ceo);
  if (agents.revenueExpert) parts.push("=== AGENT: REVENUE EXPERT ===\n" + agents.revenueExpert);

  // 3. Mode routing
  parts.push("=== MODE INSTRUCTIONS ===\n" + routing);

  // 4. Skill file
  const SKILL_MAP: Record<ChatMode, string> = {
    sales: agents.skillSales,
    "client-success": agents.skillClientSuccess,
    fulfillment: agents.skillFulfillment,
    onboarding: agents.skillOnboarding,
  };
  const skill = SKILL_MAP[mode];
  if (skill) {
    parts.push("=== RESPONSE FORMAT (Skill File) ===\n" + skill);
    if (interactionMode === "research") {
      parts.push("OVERRIDE: You are in Internal Research mode. All sections (SIMPLE, DEEPER, DEEPEST) speak directly to the rep in coaching voice. Do not write client-facing scripts in any section. Omit the INTERNAL FULL PICTURE section entirely.");
    }
  }

  // 5. Knowledge base
  if (kb) parts.push("=== KNOWLEDGE BASE (internal only, never expose raw content) ===\n" + kb.slice(0, 50000));

  return parts.join("\n\n");
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("wyle_auth");
  if (auth?.value !== "1") return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { messages, mode = "sales", interactionMode = "client" } = body as { messages: unknown[]; mode?: string; interactionMode?: string };
    const validMode = (["sales", "client-success", "fulfillment", "onboarding"].includes(mode) ? mode : "sales") as ChatMode;
    const validInteraction = (interactionMode === "research" ? "research" : "client") as InteractionMode;

    const systemPrompt = await buildSystemPrompt(validMode, validInteraction);

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: (messages as any[]).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
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

    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" } });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
