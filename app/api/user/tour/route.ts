import { sql } from "@vercel/postgres";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "../../auth/[...nextauth]/auth-options";

export async function GET() {
  const session = await getServerSession(getAuthOptions());
  const email = session?.user?.email?.toLowerCase();
  if (!email) return Response.json({ tourCompleted: true, kbTourCompleted: true });

  try {
    const { rows } = await sql`SELECT tour_completed, kb_tour_completed FROM users WHERE email = ${email}`;
    return Response.json({
      tourCompleted: rows[0]?.tour_completed ?? true,
      kbTourCompleted: rows[0]?.kb_tour_completed ?? false,
    });
  } catch {
    // If query fails (e.g. column doesn't exist yet), assume tours completed to avoid repeated triggers
    return Response.json({ tourCompleted: true, kbTourCompleted: true });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(getAuthOptions());
  const email = session?.user?.email?.toLowerCase();
  if (!email) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  try {
    if ("tourCompleted" in body) {
      await sql`UPDATE users SET tour_completed = ${body.tourCompleted} WHERE email = ${email}`;
    }
    if ("kbTourCompleted" in body) {
      await sql`UPDATE users SET kb_tour_completed = ${body.kbTourCompleted} WHERE email = ${email}`;
    }
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed to update" }, { status: 500 });
  }
}
