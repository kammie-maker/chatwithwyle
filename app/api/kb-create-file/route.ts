import { requireKbEditor } from "../require-admin";

export async function POST(req: Request) {
  try {
    const { authorized } = await requireKbEditor();
    if (!authorized) return Response.json({ error: "Admin access required" }, { status: 403 });

    const { fileName, content } = await req.json();
    if (!fileName) return Response.json({ error: "fileName required" }, { status: 400 });

    const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
    const password = process.env.WYLE_PASSWORD;
    if (!webhookUrl || !password) return Response.json({ error: "Not configured" }, { status: 500 });

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_file", fileName, content: content || "", password }),
    });

    const data = await res.json();
    if (data.error) return Response.json({ error: data.error }, { status: 502 });

    return Response.json(data);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
