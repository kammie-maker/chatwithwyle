import { requireKbEditor } from "../require-admin";

export async function GET(req: Request) {
  try {
    const { authorized } = await requireKbEditor();
    if (!authorized) return Response.json({ error: "Admin access required" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");
    if (!fileId) return Response.json({ error: "fileId query param required" }, { status: 400 });

    const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
    const password = process.env.WYLE_PASSWORD;
    if (!webhookUrl) return Response.json({ error: "WYLE_KB_WEBHOOK_URL not configured" }, { status: 500 });
    if (!password) return Response.json({ error: "WYLE_PASSWORD not configured" }, { status: 500 });

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_file", fileId, password }),
    });

    if (!res.ok) {
      return Response.json({ error: `Apps Script error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    if (data.error) {
      return Response.json({ error: data.error }, { status: 502 });
    }

    return Response.json({ content: data.content, name: data.name });
  } catch (err) {
    console.error("[kb-file GET] Error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { authorized } = await requireKbEditor();
    if (!authorized) return Response.json({ error: "Admin access required" }, { status: 403 });

    const body = await req.json();
    const { fileId, content } = body;

    if (!fileId) return Response.json({ error: "fileId is required" }, { status: 400 });
    if (typeof content !== "string") return Response.json({ error: "content is required" }, { status: 400 });

    const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
    const password = process.env.WYLE_PASSWORD;
    if (!webhookUrl) return Response.json({ error: "WYLE_KB_WEBHOOK_URL not configured" }, { status: 500 });
    if (!password) return Response.json({ error: "WYLE_PASSWORD not configured" }, { status: 500 });

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_file", fileId, content, password }),
    });

    if (!res.ok) {
      return Response.json({ error: `Apps Script error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    if (data.error) {
      return Response.json({ error: data.error }, { status: 502 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("[kb-file PUT] Error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
