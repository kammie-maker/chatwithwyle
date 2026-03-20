export async function GET() {
  try {
    const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
    if (!webhookUrl) return Response.json({ error: "WYLE_KB_WEBHOOK_URL not configured", rewrites: [] }, { status: 500 });

    // Fetch log from the webhook (action: "get_log")
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_log" }),
    });

    if (!res.ok) {
      return Response.json({ error: `Failed to fetch log: ${res.status}`, rewrites: [] }, { status: 502 });
    }

    const data = await res.json();
    const entries: string[] = data.entries || [];

    // Parse log entries: "Rewrite completed: 2026-03-19T02:00:00.000Z — triggered by: auto"
    const rewrites = entries
      .filter(e => e.includes("Rewrite completed:"))
      .map(e => {
        const tsMatch = e.match(/Rewrite completed:\s*(.+?)\s*—/);
        const triggerMatch = e.match(/triggered by:\s*(\w+)/);
        return {
          timestamp: tsMatch?.[1]?.trim() || "",
          trigger: triggerMatch?.[1] || "unknown",
        };
      })
      .slice(0, 5);

    return Response.json({
      rewrites,
      last_rewrite: rewrites[0]?.timestamp || null,
    });
  } catch (err) {
    return Response.json({ error: String(err), rewrites: [] }, { status: 500 });
  }
}
