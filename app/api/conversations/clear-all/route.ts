import { getServerSession } from "next-auth";
import { getAuthOptions } from "../../auth/[...nextauth]/auth-options";
import { sql } from "@vercel/postgres";

export async function DELETE() {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.email.toLowerCase();

  await sql`DELETE FROM conversations WHERE user_id = ${userId}`;
  return Response.json({ success: true });
}
