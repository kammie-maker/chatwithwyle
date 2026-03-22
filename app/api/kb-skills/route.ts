import { requireAdmin } from "../require-admin";
import { fetchAgentFiles } from "../kb-agents/route";

export async function GET() {
  try {
    const { authorized } = await requireAdmin();
    if (!authorized) return Response.json({ error: "Admin access required" }, { status: 403 });

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
