import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { getLastKbUpdate } from "../kb-update/route";
import { getLastRewrite } from "../kb-rewrite/route";

// ── File cache ──
interface CachedFiles { [key: string]: string }
let fileCache: { data: CachedFiles; fetchedAt: number } | null = null;
let kbCache: { text: string; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000;

// All files by ID — fetched in parallel on cold cache
const ALL_FILE_IDS: Record<string, string> = {
  // Core
  "Persona-Wyle.md": "1fB36Og4zWv8ZbNcP3-ZjvgllDz6YHq5A",
  // Agents
  "Agent-Sales.md": "1AMagcPRL3_gMVDsjVXj_e5zfYcJYa3sG",
  "Agent-CEO.md": "1m4YMdlb3u0SjNvHs_ISKJB4Gl3G6y6C8",
  "Agent-RevenueExpert.md": "1CwJ5WtPWd971CJoNK38vmg4Sg8PUNFut",
  // Format files
  "Format-ClientFacing.md": "1HQHg4jYb55lWWzh_y6ixFvh9b7KATpTd",
  "Format-Fulfillment.md": "1S8JrljaV7k3gicsQq91_3boZzeUX8VOn",
  // Knowledge files
  "Knowledge-Objections.md": "1uhEDasCiN0L_tG0oNPD7sfqUtmiodHB4",
  "Knowledge-Pricing.md": "1BBA9T447Vzamhg8sfaPRM6mZ3q-1TqxU",
  "Knowledge-Closing.md": "1kpfWuruhk18_s2KIhr6-KuDNrDHO2pqM",
  "Knowledge-ClientRetention.md": "1_WB0NEGXbHgJdZoe1GIvVEnA3Yja_Oha",
  "Knowledge-Reporting.md": "12Sz4jgVwP9glNqjBN7ka2a5dWk8Pv4pr",
  "Knowledge-RevenueStrategy.md": "10ehDqG8fCzshwwWE4hIkDsts9NIAzOai",
  "Knowledge-ClientCommunication.md": "1mvbBjDDc7FRtranvQOrdVCj-CkiZ3dqb",
  "Knowledge-Onboarding.md": "1B7RwNPhrwuzLbaxoPw-Bpp9Ed-bhV_Tu",
  // SOURCE pricing/contract docs (verbatim, loaded only when needed)
  "SOURCE-Contract.md": "1jrVfwpCcV8LjX3bdBTW1KUbeo2_84CRs",
  "SOURCE-FeeCalc.md": "1cQ_JIEFiRI1A8DPvmL8o2CLestukurcI",
  "SOURCE-FeeNegotiation.md": "1xMTxBj6F-Gt1_U9X9g7xl0ZzYkJta3He",
  "SOURCE-Guarantee.md": "14nb9ph-RFY0Fpv0IBa7EeYov7F2-eZcs",
  "SOURCE-RevenueEstimate.md": "1cCEBI9Cm4usyO-4TiBym8hGuU_L7hTDR",
};

async function fetchAllFiles(): Promise<CachedFiles> {
  if (fileCache && Date.now() - fileCache.fetchedAt < CACHE_TTL) return fileCache.data;

  const t0 = Date.now();
  const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
  const password = process.env.WYLE_PASSWORD;
  if (!webhookUrl || !password) return {};

  try {
    const entries = Object.entries(ALL_FILE_IDS);
    const results = await Promise.all(entries.map(async ([name, id]) => {
      const r = await fetch(webhookUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_file", fileId: id, password }), redirect: "follow",
      });
      const d = await r.json();
      return [name, d.content || ""] as [string, string];
    }));

    const data: CachedFiles = Object.fromEntries(results);
    console.log(`[chat] All files fetched in ${Date.now() - t0}ms (${entries.length} files)`);
    fileCache = { data, fetchedAt: Date.now() };
    return data;
  } catch (err) {
    console.log(`[chat] Files fetch error (${Date.now() - t0}ms): ${err}`);
    return fileCache?.data || {};
  }
}

async function fetchKnowledgeBase(): Promise<string> {
  const lastUpdate = Math.max(getLastKbUpdate(), getLastRewrite());
  if (kbCache && lastUpdate > kbCache.fetchedAt) { kbCache = null; }
  if (kbCache && Date.now() - kbCache.fetchedAt < CACHE_TTL) return kbCache.text;

  const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
  const password = process.env.WYLE_PASSWORD;
  if (!webhookUrl || !password) return "";

  const t0 = Date.now();
  try {
    const res = await fetch(webhookUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_file", fileId: "1IjtO_gdiK2-lFevZ66E6KRTuzy-J89xp", password }), redirect: "follow",
    });
    const data = await res.json();
    let text = data.content || "";
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

// ── Mode routing ──
const MODE_ROUTING: Record<ChatMode, string> = {
  sales: "You are operating in the Sales role. The Sales Agent leads. Draw on Revenue Expert for data justifications and CEO Agent for vision when it helps close.",
  "client-success": "You are operating in the Client Success role. Focus on retention, relationship strength, and resolving issues. Warm but firm.",
  fulfillment: "You are operating in the Revenue Management role. The Revenue Expert leads. Technical authority on pricing strategy and client communication.",
  onboarding: "You are operating in the Onboarding role. Warm, educational, trust-building. New clients need extra context and reassurance.",
};

// ── Mode → which files to include ──
const MODE_CONFIG: Record<ChatMode, { agents: string[]; format: string; knowledge: string[] }> = {
  sales: {
    agents: ["Agent-Sales.md"],
    format: "Format-ClientFacing.md",
    knowledge: ["Knowledge-Objections.md", "Knowledge-Pricing.md", "Knowledge-Closing.md"],
  },
  "client-success": {
    agents: ["Agent-Sales.md"],
    format: "Format-ClientFacing.md",
    knowledge: ["Knowledge-Pricing.md", "Knowledge-ClientRetention.md", "Knowledge-Reporting.md"],
  },
  fulfillment: {
    agents: ["Agent-RevenueExpert.md"],
    format: "Format-Fulfillment.md",
    knowledge: ["Knowledge-RevenueStrategy.md", "Knowledge-Reporting.md", "Knowledge-ClientCommunication.md"],
  },
  onboarding: {
    agents: ["Agent-Sales.md", "Agent-CEO.md"],
    format: "Format-ClientFacing.md",
    knowledge: ["Knowledge-Pricing.md", "Knowledge-Onboarding.md", "Knowledge-ClientCommunication.md"],
  },
};

// ── Pricing keywords that trigger SOURCE doc inclusion ──
const PRICING_KEYWORDS = /\b(pric|fee|cost|guarantee|contract|billing|invoice|charge|negotiat|discount|concession|payment|structure|calculation|estimate|revenue estimate|included|what.s included)\b/i;

const FALLBACK_PERSONA = `You are Wyle, the AI assistant for Freewyld Foundry, a revenue management company for short-term rental property owners. Be conversational, helpful, and professional. Never reveal customer-specific information.`;

const CLIENT_FORMAT_INSTRUCTION = `CRITICAL FORMAT INSTRUCTION:

EVERY response must begin with exactly this line:
## SIMPLE
Then the response content. Then end with [[EXPAND_PROMPT]] on its own line. No exceptions.

- NEVER use em dashes or en dashes. Rewrite the sentence instead. Zero exceptions.
- Never use colons in response text
- Never use bold text inside paragraphs
- Assume every query is mid-conversation
- Never write greetings or openers
- Never wrap talk tracks in quotation marks
- Use bullet points (starting with "- ") for key points in all sections. Each bullet should be a standalone sentence.
- Never ask about MORE DETAIL/FULL SCRIPT/REP NOTES sections. [[EXPAND_PROMPT]] handles this via UI buttons. Never reference those buttons.
- Never begin a section response with any statement about what section you are providing. Never say "Here is the MORE DETAIL section" or "Here is the FULL SCRIPT section" or any variation. Start immediately with the content itself.
- Never write 'Draft Text', 'Draft Email', 'Draft Voicemail', 'Draft Slack Message' as words.
- Never use pipe characters (|).
- Every question is about Freewyld Foundry specifically. Never give generic industry answers. If the knowledge base lacks a Freewyld-specific answer, say so.
- When recontextualizing after a mode switch, never announce your role, never say 'as the [role]', never summarize the previous conversation. Write 1 to 4 natural sentences that acknowledge the shift then immediately provide a properly formatted SIMPLE response to the most recent question.

Follow the active Format and Skill file rules exactly.`;

const SALES_FORMAT_INSTRUCTION = `CRITICAL FORMAT INSTRUCTION — SALES MODE:

EVERY response must begin with exactly this line:
## SIMPLE
Then the response content. Then end with [[EXPAND_PROMPT]] on its own line. No exceptions.

Structure every SIMPLE response with exactly two parts in this order:

1. OPENING POSITION: A concise paragraph orienting the rep. What is happening, what is the goal, and the key thing to say. No strict length limit but keep it tight. Write as a word-for-word script the rep can say to the lead. No filler, no preamble, no greetings.

2. BULLETS: Always 3 to 5 bullets. Each bullet is ONE idea on ONE line. Fragments only, not full sentences. Max 8 words per bullet. Start each bullet with "- " (dash space). Lead with an action word where possible (e.g., "Ask:", "Anchor to:", "Name the objection:", "Remind them:").
   CRITICAL: Never combine multiple ideas into one bullet. Never use dashes, semicolons, commas, or slashes to join ideas within a single bullet. If you have 5 ideas, output 5 separate "- " lines. Each bullet = one idea = one line. Wrong: "- Included: X - Included: Y - Not included: Z". Right: three separate bullets, one per line. No exceptions. No filler phrases like "I totally understand" or "That's a great point."

The response ends after the bullets. REP NOTES are requested separately via [[EXPAND_PROMPT]].

Example structure:
## SIMPLE
The fee objection usually comes from anchoring to the percentage instead of the guarantee. Lead with the guarantee, reframe the fee as an investment, and get them talking about what they are netting today so you can show the gap.

- Anchor to the guarantee first
- Ask what they are netting today
- Name the fee as an investment
- Remind them: no risk with the guarantee
- Pivot to results timeline if they push back

[[EXPAND_PROMPT]]

When REP NOTES are requested, format them with short labeled sections and bullet points. Use labels like "Why it works:", "Watch for:", "If they push back:", "Next step:" as appropriate to the context. Each label is followed by 1 to 3 short bullets. Never write paragraph blocks in Rep Notes. Example:

Why it works:
- Guarantee reframes fee as risk-free
- Netting question makes them do the math

Watch for:
- If they keep circling back to percentage, they have not internalized the guarantee
- Silence after the netting question is a buying signal

If they push back:
- Offer to run their numbers together on the call
- Name a similar property and the results

- NEVER use em dashes or en dashes. Rewrite the sentence instead.
- Never use colons in the opening position or bullets (allowed in "Ask:" style action labels only and in Rep Notes labels)
- Never use bold text inside paragraphs
- Never write greetings or openers
- Never wrap talk tracks in quotation marks
- Never write bullets as full paragraphs. If an idea needs more than 8 words, cut it down or move it to Rep Notes.
- Never ask about MORE DETAIL/FULL SCRIPT/REP NOTES sections. [[EXPAND_PROMPT]] handles this via UI buttons.
- Never begin a section response with any statement about what section you are providing.
- Never write 'Draft Text', 'Draft Email', 'Draft Voicemail' as words.
- Never use pipe characters (|).
- Every question is about Freewyld Foundry specifically.
- When recontextualizing after a mode switch, never announce your role. Write 1 to 4 natural sentences that acknowledge the shift then immediately provide a properly formatted SIMPLE response.
- DRAFT EMAIL LENGTH: Drafted emails must be 50 to 75 words. Short enough to read in 30 seconds. Only exceed this limit if the situation genuinely requires more context (e.g., a complex follow-up with multiple open items). Default to short.

Follow the active Format and Skill file rules exactly.`;

const RESEARCH_FORMAT_INSTRUCTION = `CRITICAL FORMAT INSTRUCTION — STRATEGY MODE:

You are speaking directly to the Freewyld team member. Write coaching, strategy, context, and analysis.

## SIMPLE
A direct 2-3 sentence answer. Speak to the rep. No scripts.

[[EXPAND_PROMPT]]

- NEVER use em dashes or en dashes. Zero exceptions.
- Never use colons, bold paragraphs, pipe characters.
- No greetings. Mid-conversation always.
- Never ask about MORE DETAIL/FULL SCRIPT/REP NOTES or reference UI buttons.
- Never begin a section response with any statement about what section you are providing. Start immediately with the content.
- Every question is about Freewyld specifically.
- When recontextualizing after a mode switch, never announce your role, never say 'as the [role]', never summarize the previous conversation. Write 1 to 4 natural sentences that acknowledge the shift then provide a properly formatted SIMPLE response.
- No REP NOTES section. Everything here is already internal.`;

// ── Build system prompt ──
async function buildSystemPrompt(mode: ChatMode, interactionMode: InteractionMode, userMessage: string): Promise<string> {
  const t0 = Date.now();
  const [files, kb] = await Promise.all([fetchAllFiles(), fetchKnowledgeBase()]);
  const t1 = Date.now();

  const config = MODE_CONFIG[mode];
  const parts: string[] = [];

  // 1. Format instruction
  parts.push(interactionMode === "research" ? RESEARCH_FORMAT_INSTRUCTION : mode === "sales" ? SALES_FORMAT_INSTRUCTION : CLIENT_FORMAT_INSTRUCTION);

  // 2. Persona
  parts.push("=== PERSONA ===\n" + (files["Persona-Wyle.md"] || FALLBACK_PERSONA));

  // 3. Mode-specific agent(s) — cap at 8K each
  const AGENT_MAX = 8000;
  for (const agentName of config.agents) {
    const content = files[agentName] || "";
    if (content) {
      const label = agentName.replace("Agent-", "").replace(".md", "").toUpperCase();
      parts.push("=== AGENT: " + label + " ===\n" + (content.length > AGENT_MAX ? content.slice(0, AGENT_MAX) + "\n[truncated]" : content));
    }
  }

  // 4. Mode routing
  parts.push("=== MODE ===\n" + (MODE_ROUTING[mode] || ""));

  // 5. Format file
  const formatContent = files[config.format] || "";
  if (formatContent) parts.push("=== RESPONSE FORMAT ===\n" + formatContent);

  if (interactionMode === "research") {
    parts.push("OVERRIDE: Strategy Mode. All sections speak to the rep in coaching voice. No client-facing scripts. Omit REP NOTES section.");
  }

  // 6. Knowledge files for this mode
  for (const kName of config.knowledge) {
    const content = files[kName] || "";
    if (content) {
      const label = kName.replace("Knowledge-", "").replace(".md", "");
      parts.push("=== KNOWLEDGE: " + label + " ===\n" + content);
    }
  }

  // 7. SOURCE pricing/contract docs — ONLY when the question involves pricing/contracts
  if (PRICING_KEYWORDS.test(userMessage)) {
    const sourceFiles = ["SOURCE-Contract.md", "SOURCE-FeeCalc.md", "SOURCE-FeeNegotiation.md", "SOURCE-Guarantee.md", "SOURCE-RevenueEstimate.md"];
    const sourceParts: string[] = [];
    for (const sf of sourceFiles) {
      if (files[sf]) sourceParts.push("--- " + sf + " ---\n" + files[sf]);
    }
    if (sourceParts.length > 0) {
      parts.push("=== AUTHORITATIVE SOURCE DOCUMENTS ===\nThese are the exact Freewyld pricing, contract, and guarantee documents. Use ONLY these for pricing/fee/guarantee/contract questions. Never guess or generalize.\n\n" + sourceParts.join("\n\n"));
    }
    console.log(`[chat] Pricing keywords detected — SOURCE docs included (${sourceParts.reduce((s, p) => s + p.length, 0)} chars)`);
  }

  // 8. Supplementary KB — only if room
  const currentLen = parts.join("\n\n").length;
  if (kb && currentLen < 60000) {
    const KB_MAX = Math.min(80000 - currentLen, 10000);
    if (KB_MAX > 2000) {
      const kbText = kb.length > KB_MAX ? kb.slice(0, KB_MAX) + "\n[KB truncated]" : kb;
      parts.push("=== SUPPLEMENTARY KB ===\n" + kbText);
    }
  }

  let total = parts.join("\n\n");
  if (total.length > 80000) {
    total = total.slice(0, 80000) + "\n\n[Prompt truncated at 80K]";
  }

  const knowledgeChars = config.knowledge.reduce((s, k) => s + (files[k]?.length || 0), 0);
  console.log(`[chat] Prompt: agents=${config.agents.length}, knowledge=${knowledgeChars}, format=${formatContent.length}, total=${total.length.toLocaleString()} chars. Mode: ${mode}/${interactionMode}. Built in ${Date.now() - t0}ms (fetch: ${t1 - t0}ms)`);

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

    // Extract last user message for keyword detection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastUserMsg = (messages as any[]).filter(m => m.role === "user").pop();
    const userText = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "";

    const systemPrompt = await buildSystemPrompt(validMode, validInteraction, userText);
    console.log(`[chat] Prompt ready at +${Date.now() - t0}ms. Calling Claude...`);

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
    let rawResponse = "";
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            if (firstToken) { console.log(`[chat] First token at +${Date.now() - t0}ms`); firstToken = false; }
            rawResponse += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        console.log(`[chat] Stream complete at +${Date.now() - t0}ms. Length=${rawResponse.length}. HasSIMPLE=${rawResponse.includes("## SIMPLE")}. HasExpand=${rawResponse.includes("[[EXPAND_PROMPT]]")}`);
        controller.close();
      },
    });

    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" } });
  } catch (err) {
    console.log(`[chat] Error at +${Date.now() - t0}ms: ${err}`);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
