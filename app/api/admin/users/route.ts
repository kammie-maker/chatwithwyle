import { sql } from "@vercel/postgres";
import { getServerSession } from "next-auth";
import { getAuthOptions, isAdmin } from "../../auth/[...nextauth]/auth-options";

interface UserRecord {
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: "admin" | "knowledge_manager" | "user";
  status: "active" | "suspended" | "pending";
  lastLogin: string | null;
  createdAt: string;
  defaultMode?: string;
  defaultInteraction?: string;
}

const SEED_ADMINS = [
  { email: "kammie@freewyld.com", firstName: "Kammie", lastName: "Melton" },
  { email: "eric@freewyld.com", firstName: "Eric", lastName: "Moeller" },
];

async function ensureAdminsSeed() {
  for (const admin of SEED_ADMINS) {
    await sql`
      INSERT INTO users (email, first_name, last_name, role, status)
      VALUES (${admin.email}, ${admin.firstName}, ${admin.lastName}, 'admin', 'active')
      ON CONFLICT (email) DO NOTHING
    `;
  }
}

function rowToUser(row: Record<string, unknown>): UserRecord {
  return {
    email: row.email as string,
    name: [row.first_name || "", row.last_name || ""].join(" ").trim(),
    firstName: (row.first_name as string) || undefined,
    lastName: (row.last_name as string) || undefined,
    role: row.role as UserRecord["role"],
    status: row.status as UserRecord["status"],
    lastLogin: row.last_login ? (row.last_login as Date).toISOString() : null,
    createdAt: row.created_at ? (row.created_at as Date).toISOString() : new Date().toISOString(),
    defaultMode: (row.default_mode as string) || undefined,
    defaultInteraction: (row.default_interaction as string) || undefined,
  };
}

// GET: list all users
export async function GET() {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  await ensureAdminsSeed();
  const { rows } = await sql`SELECT * FROM users ORDER BY created_at ASC`;
  const users = rows.map(rowToUser);
  return Response.json({ users });
}

// POST: create/add user
export async function POST(req: Request) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const { email, role = "user", firstName = "", lastName = "", defaultMode = "sales", defaultInteraction = "client" } = await req.json();
  if (!email?.endsWith("@freewyld.com")) {
    return Response.json({ error: "Only @freewyld.com emails allowed" }, { status: 400 });
  }

  const key = email.toLowerCase();
  const { rows: existing } = await sql`SELECT email FROM users WHERE email = ${key}`;
  if (existing.length > 0) {
    return Response.json({ error: "User already exists" }, { status: 409 });
  }

  const fn = firstName || key.split("@")[0];
  const ln = lastName || "";
  await sql`
    INSERT INTO users (email, first_name, last_name, role, status, default_mode, default_interaction)
    VALUES (${key}, ${fn}, ${ln}, ${role}, 'pending', ${defaultMode}, ${defaultInteraction})
  `;

  const { rows } = await sql`SELECT * FROM users WHERE email = ${key}`;
  return Response.json({ success: true, user: rowToUser(rows[0]) });
}

// PUT: update user role/status
export async function PUT(req: Request) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const { email, role, action, defaultMode, defaultInteraction, firstName, lastName } = await req.json();
  if (!email) return Response.json({ error: "email required" }, { status: 400 });

  const key = email.toLowerCase();
  const { rows: existing } = await sql`SELECT * FROM users WHERE email = ${key}`;
  if (existing.length === 0) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (role) await sql`UPDATE users SET role = ${role}, updated_at = now() WHERE email = ${key}`;
  if (defaultMode) await sql`UPDATE users SET default_mode = ${defaultMode}, updated_at = now() WHERE email = ${key}`;
  if (defaultInteraction) await sql`UPDATE users SET default_interaction = ${defaultInteraction}, updated_at = now() WHERE email = ${key}`;
  if (firstName !== undefined) await sql`UPDATE users SET first_name = ${firstName}, updated_at = now() WHERE email = ${key}`;
  if (lastName !== undefined) await sql`UPDATE users SET last_name = ${lastName}, updated_at = now() WHERE email = ${key}`;

  if (action === "suspend") {
    await sql`UPDATE users SET status = 'suspended', updated_at = now() WHERE email = ${key}`;
  } else if (action === "unsuspend") {
    await sql`UPDATE users SET status = 'active', updated_at = now() WHERE email = ${key}`;
  } else if (action === "revoke_sessions") {
    // Session revocation is handled by NextAuth — just update timestamp
    await sql`UPDATE users SET updated_at = now() WHERE email = ${key}`;
  } else if (action === "revoke_all") {
    // Update all users except caller
    const callerEmail = session.user.email?.toLowerCase() || "";
    await sql`UPDATE users SET updated_at = now() WHERE email != ${callerEmail}`;
  } else if (action === "activate_pending") {
    await sql`UPDATE users SET status = 'active', updated_at = now() WHERE email = ${key}`;
  }

  const { rows } = await sql`SELECT * FROM users WHERE email = ${key}`;
  return Response.json({ success: true, user: rowToUser(rows[0]) });
}

// DELETE: remove user
export async function DELETE(req: Request) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email) return Response.json({ error: "email required" }, { status: 400 });

  await sql`DELETE FROM users WHERE email = ${email.toLowerCase()}`;
  return Response.json({ success: true });
}

export type { UserRecord };
