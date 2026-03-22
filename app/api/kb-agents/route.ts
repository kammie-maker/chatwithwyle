import { cookies } from "next/headers";

interface AgentFiles { persona: string; sales: string; ceo: string; revenueExpert: string }

let agentCache: { data: AgentFiles; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchAgentFiles(): Promise<AgentFiles> {
  if (agentCache && Date.now() - agentCache.fetchedAt < CACHE_TTL) return agentCache.data;

  const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
  if (!webhookUrl) return { persona: "", sales: "", ceo: "", revenueExpert: "" };

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
      persona: find("Wyle-Persona.md"),
      sales: find("Agent-Sales.md"),
      ceo: find("Agent-CEO.md"),
      revenueExpert: find("Agent-RevenueExpert.md"),
    };

    agentCache = { data: result, fetchedAt: Date.now() };
    return result;
  } catch {
    return agentCache?.data || { persona: "", sales: "", ceo: "", revenueExpert: "" };
  }
}

// Bust agent cache when KB is updated
export function bustAgentCache() { agentCache = null; }

export async function GET() {
  try {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get("wyle_auth");
    if (authCookie?.value !== "1") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

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
