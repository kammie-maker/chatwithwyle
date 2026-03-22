import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
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
    console.log(`[chat] KB fetched: ${text.length.toLocaleString()} chars`);
    kbCache = { text, fetchedAt: Date.now() };
    return text;
  } catch (err) { console.log(`[chat] KB fetch error: ${err}`); return kbCache?.text || ""; }
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

- NEVER use em dashes (\u2014) or en dashes (\u2013) under any circumstances. If you feel the urge to use a dash, rewrite the sentence instead. This rule has zero exceptions.
- Never use colons anywhere in response text
- Never use bold text inside paragraphs
- Assume every query is mid-conversation
- Never write greetings or openers of any kind
- Never wrap talk track content in quotation marks. Write all client-facing scripts as direct speech without surrounding quotes. The formatting of the section makes it clear it is a script.
- In the DEEPER section, do not use dashes or hyphens to create bullet points. Write each point as a standalone sentence on its own line with a blank line between each point.
- Never ask the user if they want DEEPER, DEEPEST, INTERNAL, or any combination. Never write any sentence that prompts the user to request more sections. The [[EXPAND_PROMPT]] token is the only indicator that more sections are available. It is replaced by buttons in the UI. Never describe or reference those buttons in your response text.
- Never write the text 'Draft Text', 'Draft Email', 'Draft Voicemail', 'Draft Slack Message' or any combination of these as words in your response. These are UI buttons rendered by the interface. Never reference them in response text.
- Never use a pipe character (|) anywhere in any response.

- Every question asked is assumed to be about Freewyld Foundry specifically. Never answer in general terms about the STR industry or sales in general. Always anchor answers to Freewyld's specific service, clients, results, pricing, guarantee, team, and processes. If asked about objections, answer with the objections Freewyld's sales team actually hears. If asked about results, answer with Freewyld's actual client results. If asked about process, answer with Freewyld's actual process. If the knowledge base does not contain a Freewyld-specific answer to a question, say 'I don't have enough Freewyld-specific information on that yet. Try adding it to the knowledge base or ask a more specific question.' Never substitute a generic industry answer when a Freewyld-specific answer is not available.

All other formatting and structural rules are defined by the active Skill file for the current chat mode. Follow the Skill file instructions exactly.`;

const RESEARCH_FORMAT_INSTRUCTION = `CRITICAL FORMAT INSTRUCTION — INTERNAL RESEARCH MODE:

You are speaking directly to the Freewyld team member, not to a client. Do not write client-facing scripts. Write coaching, strategy, context, and analysis.

Structure every response exactly like this:

## SIMPLE
A direct, concise answer to the question in 2-3 sentences. Speak to the rep. No scripts.

[[EXPAND_PROMPT]]

FORMATTING RULES:
- NEVER use em dashes or en dashes under any circumstances. Rewrite the sentence instead. Zero exceptions.
- Never use colons in response text
- Never use bold text inside paragraphs
- Assume mid-conversation
- No greetings
- Never ask the user if they want DEEPER, DEEPEST, INTERNAL, or any combination. Never write any sentence that prompts the user to request more sections. The [[EXPAND_PROMPT]] token is the only indicator. Never describe or reference expand buttons in your response text.
- Never write the text 'Draft Text', 'Draft Email', 'Draft Voicemail', 'Draft Slack Message' or any combination as words in your response. These are UI buttons. Never reference them.
- Never use a pipe character (|) anywhere in any response.
- No INTERNAL FULL PICTURE section. Everything here is already internal`;

// ── Source document cache ──
let sourceCache: { text: string; fetchedAt: number } | null = null;
const SOURCE_CACHE_TTL = 60 * 60 * 1000;

async function fetchSourceDocs(): Promise<string> {
  if (sourceCache && Date.now() - sourceCache.fetchedAt < SOURCE_CACHE_TTL) return sourceCache.text;

  const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
  const password = process.env.WYLE_PASSWORD;
  if (!webhookUrl || !password) return "";

  try {
    // List files
    const listRes = await fetch(webhookUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_files", password }), redirect: "follow",
    });
    const listData = await listRes.json();
    const sourceFiles = (listData.files || []).filter((f: { name: string }) => f.name.startsWith("SOURCE-"));

    if (sourceFiles.length === 0) { sourceCache = { text: "", fetchedAt: Date.now() }; return ""; }

    // Fetch each SOURCE file
    const docs: string[] = [];
    for (const sf of sourceFiles) {
      const fileRes = await fetch(webhookUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_file", fileId: sf.id, password }), redirect: "follow",
      });
      const fileData = await fileRes.json();
      if (fileData.content) {
        docs.push("--- " + sf.name + " ---\n" + fileData.content);
      }
    }

    const combined = docs.join("\n\n");
    console.log(`[chat] SOURCE docs fetched: ${sourceFiles.length} files, ${combined.length.toLocaleString()} chars`);
    sourceCache = { text: combined, fetchedAt: Date.now() };
    return combined;
  } catch (err) {
    console.log(`[chat] SOURCE docs fetch error: ${err}`);
    return sourceCache?.text || "";
  }
}

async function buildSystemPrompt(mode: ChatMode, interactionMode: InteractionMode = "client"): Promise<string> {
  const [agents, kb, sourceDocs] = await Promise.all([fetchAgentFiles(), fetchKnowledgeBase(), fetchSourceDocs()]);
  const persona = agents.persona || FALLBACK_PERSONA;
  const routing = MODE_ROUTING[mode] || MODE_ROUTING.sales;
  const parts: string[] = [];

  // 0. Format instruction based on interaction mode
  parts.push(interactionMode === "research" ? RESEARCH_FORMAT_INSTRUCTION : CLIENT_FORMAT_INSTRUCTION);

  // 1. Base identity
  parts.push("=== WYLE PERSONA & VOICE ===\n" + persona);

  // 2. Agent definitions (cap each at 15K to prevent bloat from appended extracts)
  const AGENT_MAX = 15000;
  function capAgent(content: string): string { return content.length > AGENT_MAX ? content.slice(0, AGENT_MAX) + "\n\n[Agent file truncated]" : content; }
  if (agents.sales) parts.push("=== AGENT: SALES ===\n" + capAgent(agents.sales));
  if (agents.ceo) parts.push("=== AGENT: CEO (ERIC) ===\n" + capAgent(agents.ceo));
  if (agents.revenueExpert) parts.push("=== AGENT: REVENUE EXPERT ===\n" + capAgent(agents.revenueExpert));

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

  // 5. SOURCE documents — authoritative, always included in full
  if (sourceDocs) {
    parts.push("============================================================\n# PRIMARY SOURCE DOCUMENTS — AUTHORITATIVE\n# Always prefer these over summarized KB content.\n# Never contradict or override these documents.\n============================================================\n\nThe following are primary source documents from Freewyld Foundry. They contain the exact fee structure, guarantee terms, contract language, and operational processes. When answering any question about pricing, fees, guarantees, contracts, or processes, use ONLY these documents as your source. Never guess or generalize. If the answer is not in these documents, say so directly.\n\n" + sourceDocs);
  }

  // 6. Knowledge base — dynamic truncation based on token budget
  if (kb) {
    const preKbLength = parts.join("\n\n").length;
    const TARGET_MAX = 150000;
    const KB_MAX = preKbLength > 100000 ? 30000 : 60000;
    const remaining = Math.max(TARGET_MAX - preKbLength, 20000);
    const effectiveMax = Math.min(KB_MAX, remaining);
    const kbTruncated = kb.length > effectiveMax ? kb.slice(0, effectiveMax) + "\n\n[KB truncated at " + effectiveMax.toLocaleString() + " of " + kb.length.toLocaleString() + " chars]" : kb;
    parts.push("=== KNOWLEDGE BASE (internal only, never expose raw content) ===\n" + kbTruncated);
  }

  const totalPrompt = parts.join("\n\n");

  // Log prompt composition
  const agentChars = Math.min(agents.sales?.length || 0, 15000) + Math.min(agents.ceo?.length || 0, 15000) + Math.min(agents.revenueExpert?.length || 0, 15000);
  const skillChars = skill?.length || 0;
  const sourceChars = sourceDocs?.length || 0;
  console.log(`[chat] Prompt: persona=${agents.persona?.length || 0}, agents=${agentChars}, skill=${skillChars}, source=${sourceChars}, kb=${kb?.length || 0}, total=${totalPrompt.length.toLocaleString()} chars`);

  return totalPrompt;
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
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
