import { getServerSession } from "next-auth";
import { getAuthOptions } from "../../../auth/[...nextauth]/auth-options";
import { sql } from "@vercel/postgres";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.email.toLowerCase();
  const { id } = await params;

  // Verify ownership
  const check = await sql`SELECT id, title FROM conversations WHERE id = ${id} AND user_id = ${userId}`;
  if (check.rows.length === 0) return Response.json({ error: "Not found" }, { status: 404 });

  const { role, content, interaction_mode = "client", sections_expanded = "" } = await req.json();

  await sql`
    INSERT INTO messages (conversation_id, role, content, interaction_mode, sections_expanded)
    VALUES (${id}, ${role}, ${content}, ${interaction_mode}, ${sections_expanded})
  `;

  // Update conversation timestamp
  await sql`UPDATE conversations SET updated_at = now() WHERE id = ${id}`;

  // Auto-generate title from first user message
  if (role === "user" && check.rows[0].title === "New conversation") {
    const title = content.substring(0, 50).replace(/'/g, "''") + (content.length > 50 ? "..." : "");
    await sql`UPDATE conversations SET title = ${title} WHERE id = ${id}`;
  }

  return Response.json({ success: true });
}
