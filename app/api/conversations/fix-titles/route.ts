import { getServerSession } from "next-auth";
import { getAuthOptions } from "../../auth/[...nextauth]/auth-options";
import { sql } from "@vercel/postgres";

export async function POST() {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Find all "New conversation" conversations that have messages
  const untitled = await sql`
    SELECT c.id FROM conversations c
    WHERE c.title = 'New conversation'
    AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.role = 'user')
  `;

  let fixed = 0;
  for (const row of untitled.rows) {
    const firstMsg = await sql`
      SELECT content FROM messages
      WHERE conversation_id = ${row.id} AND role = 'user'
      ORDER BY created_at ASC LIMIT 1
    `;
    if (firstMsg.rows.length > 0) {
      const content = firstMsg.rows[0].content || "";
      const title = content.substring(0, 50).trim() + (content.length > 50 ? "..." : "");
      if (title) {
        await sql`UPDATE conversations SET title = ${title} WHERE id = ${row.id}`;
        fixed++;
      }
    }
  }

  return Response.json({ fixed, total: untitled.rows.length });
}
