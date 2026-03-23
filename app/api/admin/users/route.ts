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

const INTERACTION_LABELS: Record<string, string> = { client: "Client Mode", research: "Strategy Mode" };
const MODE_CHAT_LABELS: Record<string, string> = { sales: "Sales Chat", "client-success": "Client Success Chat", fulfillment: "Revenue Management Chat", onboarding: "Onboarding Chat" };

const appUrl = process.env.NEXTAUTH_URL || "https://wyle.freewyldfoundry.com";

function buildHtmlEmail(firstName: string, adminName: string, toEmail: string, defaultMode: string, defaultInteraction: string): string {
  const modeDisplay = MODE_CHAT_LABELS[defaultMode] || defaultMode;
  const viewDisplay = INTERACTION_LABELS[defaultInteraction] || defaultInteraction;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;padding:0;background:#f8f6ee;font-family:'Open Sans',Arial,sans-serif;"><div style="display:none;font-size:1px;color:#f8f6ee;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${adminName} has added you to Wyle. Sign in with your Freewyld Google account to get started.&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div><table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6ee;padding:40px 20px;"><tr><td align="center"><table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.07);"><tr><td style="background:#3c3b22;padding:32px 40px;text-align:center;"><div style="display:inline-block;width:64px;height:64px;background:#CC8A39;border-radius:14px;text-align:center;line-height:64px;" role="img" aria-label="Wyle"><span style="font-family:Georgia,serif;font-size:36px;font-weight:700;color:#3c3b22;">W</span></div><div style="margin-top:12px;font-family:Georgia,serif;font-size:13px;font-weight:600;color:#CC8A39;letter-spacing:4px;" aria-hidden="true">WYLE</div></td></tr><tr><td style="padding:40px 48px 32px;"><p style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;font-weight:600;color:#161616;line-height:1.3;">Hi ${firstName},</p><p style="margin:16px 0 0;font-size:15px;color:#444;line-height:1.75;">${adminName} has added you to <strong>Wyle</strong> &mdash; Freewyld Foundry's internal AI tool.</p><p style="margin:12px 0 0;font-size:15px;color:#444;line-height:1.75;">Wyle knows Freewyld's processes, protocols, pricing, and promises. Use it to prepare for client calls, handle objections, and draft follow-ups &mdash; in seconds.</p><table cellpadding="0" cellspacing="0" style="margin:32px 0;"><tr><td style="background:#CC8A39;border-radius:10px;"><a href="${appUrl}" style="display:inline-block;padding:14px 32px;font-family:'Open Sans',Arial,sans-serif;font-size:15px;font-weight:600;color:#161616;text-decoration:none;letter-spacing:0.2px;">Sign in to Wyle &rarr;</a></td></tr></table><table cellpadding="0" cellspacing="0" style="width:100%;background:#f8f6ee;border-radius:10px;border:1px solid rgba(0,0,0,0.07);margin-bottom:24px;"><tr><td style="padding:16px 20px;"><p style="margin:0;font-size:13px;color:#888;letter-spacing:1px;text-transform:uppercase;font-weight:600;">YOUR SETUP</p><table style="margin-top:10px;width:100%;"><tr><td style="font-size:14px;color:#555;padding:4px 0;width:140px;">Default mode</td><td style="font-size:14px;color:#161616;font-weight:600;padding:4px 0;">${modeDisplay}</td></tr><tr><td style="font-size:14px;color:#555;padding:4px 0;">Default view</td><td style="font-size:14px;color:#161616;font-weight:600;padding:4px 0;">${viewDisplay}</td></tr><tr><td style="font-size:14px;color:#555;padding:4px 0;">Sign in with</td><td style="font-size:14px;color:#161616;font-weight:600;padding:4px 0;">${toEmail} via Google</td></tr></table></td></tr></table><p style="margin:0;font-size:14px;color:#888;line-height:1.7;">First time signing in? You'll get a quick interactive tour of the app. The full guide is always available inside Wyle if you need it.</p><p style="margin:20px 0 0;font-size:14px;color:#888;line-height:1.7;">Questions? Reply to this email or message ${adminName.split(" ")[0]} on Slack.</p></td></tr><tr><td style="padding:20px 48px 32px;border-top:1px solid rgba(0,0,0,0.07);"><p style="margin:0;font-size:12px;color:#aaa;text-align:center;line-height:1.6;">Wyle &mdash; Freewyld Foundry Internal Tool<br>wyle.freewyldfoundry.com</p></td></tr></table></td></tr></table></body></html>`;
}

async function sendWelcomeEmail(accessToken: string, toEmail: string, firstName: string, defaultMode: string, defaultInteraction: string, adminName: string): Promise<boolean> {
  const subject = "=?UTF-8?B?" + Buffer.from("You're in \u2014 welcome to Wyle").toString("base64") + "?=";
  const htmlBody = buildHtmlEmail(firstName, adminName, toEmail, defaultMode, defaultInteraction);

  const email = [
    'Content-Type: text/html; charset="UTF-8"',
    "MIME-Version: 1.0",
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    "",
    htmlBody,
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
    emailSent = await sendWelcomeEmail(accessToken, key, fn, defaultMode, defaultInteraction, adminName);
  }

  const { rows } = await sql`SELECT * FROM users WHERE email = ${key}`;
  return Response.json({ success: true, user: rowToUser(rows[0]), emailSent, appUrl });
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
