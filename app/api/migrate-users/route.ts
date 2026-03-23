import { sql } from "@vercel/postgres";
import { getServerSession } from "next-auth";
import { getAuthOptions, isAdmin } from "../auth/[...nextauth]/auth-options";

export async function POST() {
  // Only admins can run migration
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        first_name TEXT,
        last_name TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'pending',
        default_mode TEXT DEFAULT 'sales',
        default_interaction TEXT DEFAULT 'client',
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `;

    // Add tour column
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN NOT NULL DEFAULT false`;

    // Create index
    await sql`CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)`;

    // Migrate from Wyle-Users.json if available
    const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
    const password = process.env.WYLE_PASSWORD;
    let migratedCount = 0;

    if (webhookUrl && password) {
      try {
        const listRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_files", password }),
          redirect: "follow",
        });
        const listData = await listRes.json();
        const file = (listData.files || []).find((f: { name: string }) => f.name === "Wyle-Users.json");

        if (file) {
          const fileRes = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "get_file", fileId: file.id, password }),
            redirect: "follow",
          });
          const fileData = await fileRes.json();
          const users = JSON.parse(fileData.content || "{}");

          for (const [email, u] of Object.entries(users) as [string, Record<string, string | null>][]) {
            const role = u.role === "standard" ? "user" : (u.role || "user");
            try {
              await sql`
                INSERT INTO users (email, first_name, last_name, role, status, default_mode, default_interaction, last_login, created_at)
                VALUES (
                  ${email.toLowerCase()},
                  ${u.firstName || null},
                  ${u.lastName || null},
                  ${role},
                  ${u.status || "pending"},
                  ${u.defaultMode || "sales"},
                  ${u.defaultInteraction || "client"},
                  ${u.lastLogin ? new Date(u.lastLogin).toISOString() : null},
                  ${u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString()}
                )
                ON CONFLICT (email) DO UPDATE SET
                  first_name = COALESCE(EXCLUDED.first_name, users.first_name),
                  last_name = COALESCE(EXCLUDED.last_name, users.last_name),
                  role = EXCLUDED.role,
                  status = EXCLUDED.status,
                  default_mode = EXCLUDED.default_mode,
                  default_interaction = EXCLUDED.default_interaction,
                  last_login = COALESCE(EXCLUDED.last_login, users.last_login),
                  updated_at = now()
              `;
              migratedCount++;
            } catch (err) {
              console.error(`Failed to migrate user ${email}:`, err);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch from Drive:", err);
      }
    }

    return Response.json({ success: true, migratedCount, message: `Users table created. ${migratedCount} users migrated from Drive.` });
  } catch (err) {
    console.error("Migration failed:", err);
    return Response.json({ error: "Migration failed" }, { status: 500 });
  }
}
