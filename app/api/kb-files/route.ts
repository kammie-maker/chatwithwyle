import { cookies } from "next/headers";

export async function GET() {
  try {
    // Auth: require auth cookie
    const cookieStore = await cookies();
    const authCookie = cookieStore.get("wyle_auth");
    if (authCookie?.value !== "1") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
    const password = process.env.WYLE_PASSWORD;
    if (!webhookUrl) return Response.json({ error: "WYLE_KB_WEBHOOK_URL not configured" }, { status: 500 });
    if (!password) return Response.json({ error: "WYLE_PASSWORD not configured" }, { status: 500 });

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_files", password }),
    });

    if (!res.ok) {
      return Response.json({ error: `Apps Script error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    if (data.error) {
      return Response.json({ error: data.error }, { status: 502 });
    }

    return Response.json({ files: data.files || [] });
  } catch (err) {
    console.error("[kb-files] Error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
