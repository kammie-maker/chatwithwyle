import { getServerSession } from "next-auth";
import { fetchAgentFiles } from "../kb-agents/route";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const agents = await fetchAgentFiles();
    return Response.json({
      sales: agents.skillSales,
      clientSuccess: agents.skillClientSuccess,
      fulfillment: agents.skillFulfillment,
      onboarding: agents.skillOnboarding,
    });
  } catch (err) {
    console.error("[kb-skills] Error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
