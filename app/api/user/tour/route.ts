import { sql } from "@vercel/postgres";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "../../auth/[...nextauth]/auth-options";

export async function GET() {
  const session = await getServerSession(getAuthOptions());
  const email = session?.user?.email?.toLowerCase();
  if (!email) return Response.json({ tourCompleted: true });

  try {
    const { rows } = await sql`SELECT tour_completed FROM users WHERE email = ${email}`;
    return Response.json({ tourCompleted: rows[0]?.tour_completed ?? true });
  } catch {
    return Response.json({ tourCompleted: true });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(getAuthOptions());
  const email = session?.user?.email?.toLowerCase();
  if (!email) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { tourCompleted } = await req.json();
  try {
    await sql`UPDATE users SET tour_completed = ${tourCompleted} WHERE email = ${email}`;
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed to update" }, { status: 500 });
  }
}
