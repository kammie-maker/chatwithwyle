import { requireKbEditor } from "../require-admin";

interface AgentFiles {
  persona: string;
  sales: string;
  ceo: string;
  revenueExpert: string;
  skillSales: string;
  skillClientSuccess: string;
  skillFulfillment: string;
  skillOnboarding: string;
}

let agentCache: { data: AgentFiles; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchAgentFiles(): Promise<AgentFiles> {
  if (agentCache && Date.now() - agentCache.fetchedAt < CACHE_TTL) return agentCache.data;

  const empty: AgentFiles = { persona: "", sales: "", ceo: "", revenueExpert: "", skillSales: "", skillClientSuccess: "", skillFulfillment: "", skillOnboarding: "" };
  const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
  if (!webhookUrl) return empty;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all_sources" }),
      redirect: "follow",
    });
    const data = await res.json();
    const sources: { name: string; content: string }[] = data.sources || [];

    const find = (name: string) => sources.find(s => s.name === name)?.content || "";

    const result: AgentFiles = {
      persona: find("Persona-Wyle.md"),
      sales: find("Agent-Sales.md"),
      ceo: find("Agent-CEO.md"),
      revenueExpert: find("Agent-RevenueExpert.md"),
      skillSales: find("Skill-Sales.md"),
      skillClientSuccess: find("Skill-ClientSuccess.md"),
      skillFulfillment: find("Skill-Fulfillment.md"),
      skillOnboarding: find("Skill-Onboarding.md"),
    };

    agentCache = { data: result, fetchedAt: Date.now() };
    return result;
  } catch {
    return agentCache?.data || empty;
  }
}

export function bustAgentCache() { agentCache = null; }

export async function GET() {
  try {
    const { authorized } = await requireKbEditor();
    if (!authorized) return Response.json({ error: "Admin access required" }, { status: 403 });

    const agents = await fetchAgentFiles();
    return Response.json({
      sales: agents.sales,
      ceo: agents.ceo,
      revenueExpert: agents.revenueExpert,
    });
  } catch (err) {
    console.error("[kb-agents] Error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
