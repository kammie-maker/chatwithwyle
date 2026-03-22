import { getServerSession } from "next-auth";
import { getAuthOptions } from "../auth/[...nextauth]/auth-options";
import { sql } from "@vercel/postgres";

export async function GET() {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.email.toLowerCase();

  const result = await sql`
    SELECT c.id, c.title, c.mode, c.interaction_type, c.pinned, c.created_at, c.updated_at,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
    FROM conversations c
    WHERE c.user_id = ${userId}
    ORDER BY c.pinned DESC, c.updated_at DESC
    LIMIT 200
  `;

  return Response.json({ conversations: result.rows });
}

export async function POST(req: Request) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.email.toLowerCase();

  const { mode = "sales", interaction_type = "client" } = await req.json();

  const result = await sql`
    INSERT INTO conversations (user_id, mode, interaction_type)
    VALUES (${userId}, ${mode}, ${interaction_type})
    RETURNING id, title, mode, interaction_type, pinned, created_at, updated_at
  `;

  return Response.json({ conversation: result.rows[0] });
}
