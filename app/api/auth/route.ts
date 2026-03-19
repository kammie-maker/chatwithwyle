import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { password } = await req.json();
  const correct = process.env.WYLE_PASSWORD;

  if (!correct) return Response.json({ error: "Password not configured" }, { status: 500 });
  if (password !== correct) return Response.json({ error: "Incorrect password" }, { status: 401 });

  const cookieStore = await cookies();
  cookieStore.set("wyle_auth", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return Response.json({ ok: true });
}

export async function GET() {
  const cookieStore = await cookies();
  const auth = cookieStore.get("wyle_auth");
  return Response.json({ authenticated: auth?.value === "1" });
}
