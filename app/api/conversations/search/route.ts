import { getServerSession } from "next-auth";
import { getAuthOptions } from "../../auth/[...nextauth]/auth-options";
import { sql } from "@vercel/postgres";

export async function GET(req: Request) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.email.toLowerCase();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return Response.json({ results: [] });

  const pattern = `%${q}%`;

  const result = await sql`
    SELECT DISTINCT c.id, c.title, c.mode, c.interaction_type, c.updated_at,
      (SELECT m.content FROM messages m WHERE m.conversation_id = c.id AND m.content ILIKE ${pattern} LIMIT 1) as snippet
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE c.user_id = ${userId} AND (c.title ILIKE ${pattern} OR m.content ILIKE ${pattern})
    ORDER BY c.updated_at DESC
    LIMIT 20
  `;

  return Response.json({ results: result.rows });
}
