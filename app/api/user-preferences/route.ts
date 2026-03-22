import { getServerSession } from "next-auth";
import { getAuthOptions } from "../auth/[...nextauth]/auth-options";
import { sql } from "@vercel/postgres";

export async function GET() {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.email.toLowerCase();

  const result = await sql`SELECT * FROM user_preferences WHERE user_id = ${userId}`;
  if (result.rows.length === 0) {
    return Response.json({ default_mode: "sales", default_interaction: "client" });
  }
  return Response.json(result.rows[0]);
}

export async function PUT(req: Request) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.email.toLowerCase();

  const { default_mode, default_interaction } = await req.json();

  await sql`
    INSERT INTO user_preferences (user_id, default_mode, default_interaction)
    VALUES (${userId}, ${default_mode || "sales"}, ${default_interaction || "client"})
    ON CONFLICT (user_id) DO UPDATE SET
      default_mode = COALESCE(${default_mode}, user_preferences.default_mode),
      default_interaction = COALESCE(${default_interaction}, user_preferences.default_interaction),
      updated_at = now()
  `;

  return Response.json({ success: true });
}
