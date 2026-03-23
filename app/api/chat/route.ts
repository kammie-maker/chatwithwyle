import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { getLastKbUpdate } from "../kb-update/route";
import { getLastRewrite } from "../kb-rewrite/route";

// ── Unified file cache — fetch all needed files in ONE call ──
interface CachedFiles {
  persona: string;
  sales: string;
  ceo: string;
  revenueExpert: string;
  skillSales: string;
  skillClientSuccess: string;
  skillFulfillment: string;
  skillOnboarding: string;
  sourceDocs: string;
  fetchedAt: number;
}

let fileCache: CachedFiles | null = null;
let kbCache: { text: string; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000;

async function fetchAllFiles(): Promise<CachedFiles> {
  if (fileCache && Date.now() - fileCache.fetchedAt < CACHE_TTL) return fileCache;

  const t0 = Date.now();
  const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
  if (!webhookUrl) return emptyFiles();

  try {
    // Single call to read_all_sources — gets everything
    const res = await fetch(webhookUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all_sources" }), redirect: "follow",
    });
    const data = await res.json();
    const sources: { name: string; content: string }[] = data.sources || [];

    const find = (name: string) => sources.find(s => s.name === name)?.content || "";

    // Collect SOURCE- files
    const sourceDocs = sources
      .filter(s => s.name.startsWith("SOURCE-"))
      .map(s => "--- " + s.name + " ---\n" + s.content)
      .join("\n\n");

    const result: CachedFiles = {
      persona: find("Persona-Wyle.md"),
      sales: find("Agent-Sales.md"),
      ceo: find("Agent-CEO.md"),
      revenueExpert: find("Agent-RevenueExpert.md"),
      skillSales: find("Skill-Sales.md"),
      skillClientSuccess: find("Skill-ClientSuccess.md"),
      skillFulfillment: find("Skill-Fulfillment.md"),
      skillOnboarding: find("Skill-Onboarding.md"),
      sourceDocs,
      fetchedAt: Date.now(),
    };

    console.log(`[chat] Files fetched in ${Date.now() - t0}ms (${sources.length} files, source docs: ${sourceDocs.length} chars)`);
    fileCache = result;
    return result;
  } catch (err) {
    console.log(`[chat] Files fetch error (${Date.now() - t0}ms): ${err}`);
    return fileCache || emptyFiles();
  }
}

function emptyFiles(): CachedFiles {
  return { persona: "", sales: "", ceo: "", revenueExpert: "", skillSales: "", skillClientSuccess: "", skillFulfillment: "", skillOnboarding: "", sourceDocs: "", fetchedAt: 0 };
}

async function fetchKnowledgeBase(): Promise<string> {
  const lastUpdate = Math.max(getLastKbUpdate(), getLastRewrite());
  if (kbCache && lastUpdate > kbCache.fetchedAt) { kbCache = null; }
  if (kbCache && Date.now() - kbCache.fetchedAt < CACHE_TTL) return kbCache.text;

  const url = process.env.GOOGLE_DRIVE_KB_URL;
  if (!url) return "";

  const t0 = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store" });
    let text = await res.text();
    text = text.replace(/^.*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}.*$/gm, "");
    text = text.replace(/^.*[A-Z][a-z]+\s+[A-Z][a-z]+.*\$[\d,]+.*$/gm, "");
    console.log(`[chat] KB fetched in ${Date.now() - t0}ms: ${text.length.toLocaleString()} chars`);
    kbCache = { text, fetchedAt: Date.now() };
    return text;
  } catch (err) { console.log(`[chat] KB fetch error: ${err}`); return kbCache?.text || ""; }
}

// ── Types ──
type ChatMode = "sales" | "client-success" | "fulfillment" | "onboarding";
type InteractionMode = "client" | "research";

const MODE_ROUTING: Record<ChatMode, string> = {
  sales: "You are operating in Sales Mode. The Sales Agent leads all responses. Draw on the Revenue Expert for data-backed justifications. Draw on the CEO Agent when vision, culture, or brand story adds weight to a close. Your goal: help the rep close the deal on this call.",
  "client-success": "You are operating in Client Success Mode. The Revenue Expert leads all responses. Draw on the CEO Agent for culture and relationship context. Draw on the Sales Agent only when retention or upsell is relevant. Your goal: help the CS team strengthen client relationships and resolve issues.",
  fulfillment: "You are operating in Revenue Management Mode. The Revenue Expert leads all responses. Draw on the CEO Agent for culture and standards context. Your goal: help the fulfillment team execute revenue management with precision and consistency.",
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
- Every question is about Freewyld Foundry specifically. Never answer in general terms. If the knowledge base does not contain a Freewyld-specific answer, say so.
- No INTERNAL FULL PICTURE section. Everything here is already internal`;

// ── Mode-specific agent selection ──
const MODE_AGENTS: Record<ChatMode, string[]> = {
  sales: ["sales"],
  "client-success": ["sales"],
  fulfillment: ["revenueExpert"],
  onboarding: ["sales", "ceo"],
};

// ── Build system prompt ──
async function buildSystemPrompt(mode: ChatMode, interactionMode: InteractionMode = "client"): Promise<string> {
  const t0 = Date.now();
  const [files, kb] = await Promise.all([fetchAllFiles(), fetchKnowledgeBase()]);
  const t1 = Date.now();

  const persona = files.persona || FALLBACK_PERSONA;
  const routing = MODE_ROUTING[mode] || MODE_ROUTING.sales;
  const parts: string[] = [];

  // 0. Format instruction
  parts.push(interactionMode === "research" ? RESEARCH_FORMAT_INSTRUCTION : CLIENT_FORMAT_INSTRUCTION);

  // 1. Persona
  parts.push("=== WYLE PERSONA & VOICE ===\n" + persona);

  // 2. Mode-specific agents only (cap at 10K each)
  const AGENT_MAX = 10000;
  const cap = (s: string) => s.length > AGENT_MAX ? s.slice(0, AGENT_MAX) + "\n\n[truncated]" : s;
  const agentKeys = MODE_AGENTS[mode] || ["sales"];
  const agentMap: Record<string, { label: string; content: string }> = {
    sales: { label: "SALES", content: files.sales },
    ceo: { label: "CEO (ERIC)", content: files.ceo },
    revenueExpert: { label: "REVENUE EXPERT", content: files.revenueExpert },
  };
  for (const key of agentKeys) {
    const agent = agentMap[key];
    if (agent?.content) parts.push("=== AGENT: " + agent.label + " ===\n" + cap(agent.content));
  }

  // 3. Mode routing
  parts.push("=== MODE INSTRUCTIONS ===\n" + routing);

  // 4. Skill file
  const SKILL_MAP: Record<ChatMode, string> = {
    sales: files.skillSales,
    "client-success": files.skillClientSuccess,
    fulfillment: files.skillFulfillment,
    onboarding: files.skillOnboarding,
  };
  const skill = SKILL_MAP[mode];
  if (skill) {
    parts.push("=== RESPONSE FORMAT (Skill File) ===\n" + skill);
    if (interactionMode === "research") {
      parts.push("OVERRIDE: You are in Internal Research mode. All sections (SIMPLE, DEEPER, DEEPEST) speak directly to the rep in coaching voice. Do not write client-facing scripts in any section. Omit the INTERNAL FULL PICTURE section entirely.");
    }
  }

  // 5. SOURCE documents (authoritative)
  if (files.sourceDocs) {
    parts.push("============================================================\n# PRIMARY SOURCE DOCUMENTS — AUTHORITATIVE\n============================================================\n\nThe following are primary source documents from Freewyld Foundry. They contain the exact fee structure, guarantee terms, contract language, and operational processes. When answering any question about pricing, fees, guarantees, contracts, or processes, use ONLY these documents as your source. Never guess or generalize. If the answer is not in these documents, say so directly.\n\n" + files.sourceDocs);
  }

  // 6. Compiled KB — dynamic truncation
  if (kb) {
    const preKbLen = parts.join("\n\n").length;
    const KB_MAX = preKbLen > 80000 ? 20000 : 40000;
    const kbText = kb.length > KB_MAX ? kb.slice(0, KB_MAX) + "\n\n[KB truncated]" : kb;
    parts.push("=== KNOWLEDGE BASE ===\n" + kbText);
  }

  const total = parts.join("\n\n");
  console.log(`[chat] Prompt built in ${Date.now() - t0}ms (fetch: ${t1 - t0}ms). Mode: ${mode}/${interactionMode}. Agents: ${agentKeys.join("+")}. Total: ${total.length.toLocaleString()} chars`);

  return total;
}

// ── POST handler ──
export async function POST(req: Request) {
  const t0 = Date.now();
  const session = await getServerSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { messages, mode = "sales", interactionMode = "client" } = body as { messages: unknown[]; mode?: string; interactionMode?: string };
    const validMode = (["sales", "client-success", "fulfillment", "onboarding"].includes(mode) ? mode : "sales") as ChatMode;
    const validInteraction = (interactionMode === "research" ? "research" : "client") as InteractionMode;

    const systemPrompt = await buildSystemPrompt(validMode, validInteraction);
    const t1 = Date.now();
    console.log(`[chat] Prompt ready at +${t1 - t0}ms. Calling Claude...`);

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: (messages as any[]).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    const encoder = new TextEncoder();
    let firstToken = true;
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            if (firstToken) { console.log(`[chat] First token at +${Date.now() - t0}ms`); firstToken = false; }
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        console.log(`[chat] Stream complete at +${Date.now() - t0}ms`);
        controller.close();
      },
    });

    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" } });
  } catch (err) {
    console.log(`[chat] Error at +${Date.now() - t0}ms: ${err}`);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
