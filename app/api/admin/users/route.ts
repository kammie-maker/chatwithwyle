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

const MODE_LABELS: Record<string, string> = { sales: "Sales", "client-success": "Client Success", fulfillment: "Revenue Management", onboarding: "Onboarding" };

async function sendWelcomeEmail(accessToken: string, toEmail: string, firstName: string, defaultMode: string, adminName: string): Promise<boolean> {
  const subject = "You're invited to Wyle";
  const modeLabel = MODE_LABELS[defaultMode] || defaultMode;
  const body = `Hi ${firstName},\n\n${adminName} has added you to Wyle, Freewyld Foundry's internal AI tool.\n\nSign in with your Freewyld Google account:\nhttps://chatwithwyle.vercel.app\n\nYour default mode is set to ${modeLabel}. The first time you sign in you'll get a quick interactive tour of the app.\n\nLet ${adminName.split(" ")[0]} know if you have any questions.`;

  const email = [
    'Content-Type: text/plain; charset="UTF-8"',
    "MIME-Version: 1.0",
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    "",
    body,
  ].join("\n");

  const encodedEmail = Buffer.from(email).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  try {
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: encodedEmail }),
    });
    return response.ok;
  } catch {
    return false;
  }
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

  // Send welcome email via Gmail API
  let emailSent = false;
  const accessToken = (session as unknown as Record<string, unknown>).accessToken as string;
  const adminName = session.user.name || session.user.email || "Your admin";
  if (accessToken) {
    emailSent = await sendWelcomeEmail(accessToken, key, fn, defaultMode, adminName);
  }

  const { rows } = await sql`SELECT * FROM users WHERE email = ${key}`;
  return Response.json({ success: true, user: rowToUser(rows[0]), emailSent });
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
