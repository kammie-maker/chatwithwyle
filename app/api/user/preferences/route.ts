import { getServerSession } from "next-auth";
import { getAuthOptions } from "../../auth/[...nextauth]/auth-options";

const USERS_FILE = "Wyle-Users.json";

export async function GET() {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
  const password = process.env.WYLE_PASSWORD;
  if (!webhookUrl || !password) return Response.json({ defaultMode: "sales", defaultInteraction: "client" });

  try {
    const listRes = await fetch(webhookUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_files", password }), redirect: "follow",
    });
    const listData = await listRes.json();
    const file = (listData.files || []).find((f: { name: string }) => f.name === USERS_FILE);
    if (!file) return Response.json({ defaultMode: "sales", defaultInteraction: "client" });

    const fileRes = await fetch(webhookUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_file", fileId: file.id, password }), redirect: "follow",
    });
    const fileData = await fileRes.json();
    const users = JSON.parse(fileData.content || "{}");
    const user = users[session.user.email.toLowerCase()];

    return Response.json({
      defaultMode: user?.defaultMode || "sales",
      defaultInteraction: user?.defaultInteraction || "client",
    });
  } catch {
    return Response.json({ defaultMode: "sales", defaultInteraction: "client" });
  }
}
