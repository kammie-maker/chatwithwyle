import { sql } from "@vercel/postgres";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "../auth/[...nextauth]/auth-options";
import { requireKbEditor } from "../require-admin";

// GET — fetch version history for a file
export async function GET(req: Request) {
  const { authorized } = await requireKbEditor();
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const fileId = url.searchParams.get("fileId");
  if (!fileId) return Response.json({ error: "fileId required" }, { status: 400 });

  // includeContent=1 to fetch full content (for restore), otherwise just metadata
  const includeContent = url.searchParams.get("includeContent") === "1";

  try {
    const { rows } = includeContent
      ? await sql`
          SELECT id, file_name, content, edit_type, instruction, user_email, user_name, user_role, created_at
          FROM kb_file_versions WHERE file_id = ${fileId} ORDER BY created_at DESC LIMIT 100`
      : await sql`
          SELECT id, file_name, edit_type, instruction, user_email, user_name, user_role, created_at,
                 LENGTH(content) as content_length
          FROM kb_file_versions WHERE file_id = ${fileId} ORDER BY created_at DESC LIMIT 100`;
    return Response.json({ versions: rows });
  } catch (err) {
    console.error("[kb-versions] GET error:", err);
    return Response.json({ versions: [] });
  }
}

// POST — create a new version snapshot
export async function POST(req: Request) {
  const { authorized } = await requireKbEditor();
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const session = await getServerSession(getAuthOptions());
  const email = session?.user?.email?.toLowerCase() || "unknown";
  const name = session?.user?.name || email;
  const role = (session?.user as Record<string, unknown>)?.role as string || "user";

  const { fileId, fileName, content, editType, instruction } = await req.json();
  if (!fileId || content === undefined) {
    return Response.json({ error: "fileId and content required" }, { status: 400 });
  }

  try {
    const { rows } = await sql`
      INSERT INTO kb_file_versions (file_id, file_name, content, edit_type, instruction, user_email, user_name, user_role)
      VALUES (${fileId}, ${fileName || "unknown"}, ${content}, ${editType || "manual"}, ${instruction || null}, ${email}, ${name}, ${role})
      RETURNING id, created_at
    `;
    console.log(`[kb-versions] Snapshot: ${fileName} (${editType}) by ${name}`);
    return Response.json({ success: true, version: rows[0] });
  } catch (err) {
    console.error("[kb-versions] POST error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
