import { sql } from "@vercel/postgres";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "../auth/[...nextauth]/auth-options";
import { requireKbEditor } from "../require-admin";

// GET — fetch edit history for a file
export async function GET(req: Request) {
  const { authorized } = await requireKbEditor();
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const fileId = url.searchParams.get("fileId");
  if (!fileId) return Response.json({ error: "fileId required" }, { status: 400 });

  try {
    const { rows } = await sql`
      SELECT id, file_name, instruction, user_email, user_name, created_at
      FROM kb_edit_history
      WHERE file_id = ${fileId}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return Response.json({ edits: rows });
  } catch {
    return Response.json({ edits: [] });
  }
}

// POST — log an edit
export async function POST(req: Request) {
  const { authorized } = await requireKbEditor();
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const session = await getServerSession(getAuthOptions());
  const email = session?.user?.email?.toLowerCase() || "unknown";
  const name = session?.user?.name || email;

  const { fileId, fileName, instruction } = await req.json();
  if (!fileId || !instruction) return Response.json({ error: "fileId and instruction required" }, { status: 400 });

  try {
    await sql`
      INSERT INTO kb_edit_history (file_id, file_name, instruction, user_email, user_name)
      VALUES (${fileId}, ${fileName || "unknown"}, ${instruction}, ${email}, ${name})
    `;
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
