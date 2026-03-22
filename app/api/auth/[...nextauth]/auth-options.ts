import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";

const ALLOWED_DOMAIN = "freewyld.com";

const ADMIN_EMAILS = [
  "kammie@freewyld.com",
  "eric@freewyld.com",
];

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

async function checkUserStatus(email: string): Promise<{ allowed: boolean; role: string }> {
  const webhookUrl = process.env.WYLE_KB_WEBHOOK_URL;
  const password = process.env.WYLE_PASSWORD;
  if (!webhookUrl || !password) return { allowed: true, role: isAdmin(email) ? "admin" : "standard" };

  try {
    const listRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_files", password }),
      redirect: "follow",
    });
    const listData = await listRes.json();
    const file = (listData.files || []).find((f: { name: string }) => f.name === "Wyle-Users.json");
    if (!file) return { allowed: true, role: isAdmin(email) ? "admin" : "standard" };

    const fileRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_file", fileId: file.id, password }),
      redirect: "follow",
    });
    const fileData = await fileRes.json();
    const users = JSON.parse(fileData.content || "{}");
    const user = users[email.toLowerCase()];

    if (user) {
      if (user.status === "suspended") return { allowed: false, role: user.role };
      // Update last login
      user.lastLogin = new Date().toISOString();
      if (user.status === "pending") user.status = "active";
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_file", fileId: file.id, content: JSON.stringify(users, null, 2), password }),
        redirect: "follow",
      });
      return { allowed: true, role: user.role || (isAdmin(email) ? "admin" : "standard") };
    }

    return { allowed: true, role: isAdmin(email) ? "admin" : "standard" };
  } catch {
    return { allowed: true, role: isAdmin(email) ? "admin" : "standard" };
  }
}

export function getAuthOptions(): NextAuthOptions {
  return {
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    ],
    callbacks: {
      async signIn({ user }) {
        const email = user.email?.toLowerCase() || "";
        if (!email.endsWith("@" + ALLOWED_DOMAIN)) return false;
        const { allowed } = await checkUserStatus(email);
        if (!allowed) return "/sign-in?error=Suspended";
        return true;
      },
      async jwt({ token, user }) {
        if (user) {
          const email = user.email?.toLowerCase() || "";
          const { role } = await checkUserStatus(email);
          token.role = role;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          (session.user as Record<string, unknown>).role = token.role;
        }
        return session;
      },
    },
    pages: {
      signIn: "/sign-in",
      error: "/sign-in",
    },
  };
}
