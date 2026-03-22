import { getServerSession } from "next-auth";
import { getAuthOptions, isAdmin } from "../../auth/[...nextauth]/auth-options";

const USERS_FILE = "Wyle-Users.json";

async function fetchUsersFromDrive(): Promise<Record<string, UserRecord>> {
  const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
  const password = process.env.WYLE_PASSWORD;
  if (!webhookUrl || !password) return {};

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_files", password }),
      redirect: "follow",
    });
    const data = await res.json();
    const file = (data.files || []).find((f: { name: string }) => f.name === USERS_FILE);
    if (!file) return {};

    const fileRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_file", fileId: file.id, password }),
      redirect: "follow",
    });
    const fileData = await fileRes.json();
    return JSON.parse(fileData.content || "{}");
  } catch {
    return {};
  }
}

async function saveUsersToDrive(users: Record<string, UserRecord>): Promise<boolean> {
  const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
  const password = process.env.WYLE_PASSWORD;
  if (!webhookUrl || !password) return false;

  try {
    // Find existing file
    const listRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_files", password }),
      redirect: "follow",
    });
    const listData = await listRes.json();
    const file = (listData.files || []).find((f: { name: string }) => f.name === USERS_FILE);

    const content = JSON.stringify(users, null, 2);

    if (file) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_file", fileId: file.id, content, password }),
        redirect: "follow",
      });
    } else {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_file", fileName: USERS_FILE, content, password }),
        redirect: "follow",
      });
    }
    return true;
  } catch {
    return false;
  }
}

interface UserRecord {
  email: string;
  name: string;
  role: "admin" | "standard";
  status: "active" | "suspended" | "pending";
  lastLogin: string | null;
  createdAt: string;
  suspendedAt?: string | null;
  sessionRevokedAt?: string | null;
}

const SEED_ADMINS = [
  { email: "kammie@freewyld.com", name: "Kammie" },
  { email: "eric@freewyld.com", name: "Eric" },
];

async function ensureAdminsSeed(users: Record<string, UserRecord>): Promise<boolean> {
  let changed = false;
  for (const admin of SEED_ADMINS) {
    if (!users[admin.email]) {
      users[admin.email] = {
        email: admin.email,
        name: admin.name,
        role: "admin",
        status: "active",
        lastLogin: null,
        createdAt: new Date().toISOString(),
      };
      changed = true;
    }
  }
  return changed;
}

// GET: list all users
export async function GET() {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const users = await fetchUsersFromDrive();
  const seeded = await ensureAdminsSeed(users);
  if (seeded) await saveUsersToDrive(users);

  return Response.json({ users: Object.values(users) });
}

// POST: create/invite user
export async function POST(req: Request) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const { email, role = "standard", name = "" } = await req.json();
  if (!email?.endsWith("@freewyld.com")) {
    return Response.json({ error: "Only @freewyld.com emails allowed" }, { status: 400 });
  }

  const users = await fetchUsersFromDrive();
  const key = email.toLowerCase();
  if (users[key]) {
    return Response.json({ error: "User already exists" }, { status: 409 });
  }

  users[key] = {
    email: key,
    name: name || key.split("@")[0],
    role: role as "admin" | "standard",
    status: "pending",
    lastLogin: null,
    createdAt: new Date().toISOString(),
  };

  await saveUsersToDrive(users);
  return Response.json({ success: true, user: users[key] });
}

// PUT: update user role/status
export async function PUT(req: Request) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const { email, role, action } = await req.json();
  if (!email) return Response.json({ error: "email required" }, { status: 400 });

  const users = await fetchUsersFromDrive();
  const key = email.toLowerCase();
  if (!users[key]) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (role) users[key].role = role;

  if (action === "suspend") {
    users[key].status = "suspended";
    users[key].suspendedAt = new Date().toISOString();
    users[key].sessionRevokedAt = new Date().toISOString();
  } else if (action === "unsuspend") {
    users[key].status = "active";
    users[key].suspendedAt = null;
  } else if (action === "revoke_sessions") {
    users[key].sessionRevokedAt = new Date().toISOString();
  } else if (action === "revoke_all") {
    // Revoke sessions for ALL users except the caller
    const callerEmail = session.user.email?.toLowerCase();
    for (const k in users) {
      if (k !== callerEmail) {
        users[k].sessionRevokedAt = new Date().toISOString();
      }
    }
  } else if (action === "activate_pending") {
    users[key].status = "active";
  }

  await saveUsersToDrive(users);
  return Response.json({ success: true, user: users[key] });
}

// DELETE: remove user
export async function DELETE(req: Request) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email) return Response.json({ error: "email required" }, { status: 400 });

  const users = await fetchUsersFromDrive();
  const key = email.toLowerCase();
  delete users[key];

  await saveUsersToDrive(users);
  return Response.json({ success: true });
}

// Export for use by auth callback
export { fetchUsersFromDrive, saveUsersToDrive };
export type { UserRecord };
