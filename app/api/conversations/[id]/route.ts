import { getServerSession } from "next-auth";
import { getAuthOptions } from "../../auth/[...nextauth]/auth-options";
import { sql } from "@vercel/postgres";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.email.toLowerCase();
  const { id } = await params;

  const conv = await sql`SELECT * FROM conversations WHERE id = ${id} AND user_id = ${userId}`;
  if (conv.rows.length === 0) return Response.json({ error: "Not found" }, { status: 404 });

  const msgs = await sql`SELECT * FROM messages WHERE conversation_id = ${id} ORDER BY created_at ASC`;

  return Response.json({ conversation: conv.rows[0], messages: msgs.rows });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.email.toLowerCase();
  const { id } = await params;

  const { title, pinned, mode, interaction_type } = await req.json();

  // Verify ownership
  const check = await sql`SELECT id FROM conversations WHERE id = ${id} AND user_id = ${userId}`;
  if (check.rows.length === 0) return Response.json({ error: "Not found" }, { status: 404 });

  const updates: string[] = [];
  if (title !== undefined) updates.push(`title = '${title.replace(/'/g, "''")}'`);
  if (pinned !== undefined) updates.push(`pinned = ${pinned}`);
  if (mode !== undefined) updates.push(`mode = '${mode}'`);
  if (interaction_type !== undefined) updates.push(`interaction_type = '${interaction_type}'`);
  updates.push("updated_at = now()");

  if (updates.length > 0) {
    await sql.query(`UPDATE conversations SET ${updates.join(", ")} WHERE id = '${id}' AND user_id = '${userId}'`);
  }

  return Response.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.email.toLowerCase();
  const { id } = await params;

  await sql`DELETE FROM conversations WHERE id = ${id} AND user_id = ${userId}`;
  return Response.json({ success: true });
}
