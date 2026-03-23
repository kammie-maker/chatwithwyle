import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import { sql } from "@vercel/postgres";

const ALLOWED_DOMAIN = "freewyld.com";

const ADMIN_EMAILS = [
  "kammie@freewyld.com",
];

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export function isKbEditor(role: string): boolean {
  return role === "admin" || role === "knowledge_manager";
}

async function checkUserStatus(email: string): Promise<{ allowed: boolean; role: string; reason?: string }> {
  // Seed admins are always allowed
  if (isAdmin(email)) {
    try {
      await sql`UPDATE users SET last_login = now(), status = 'active' WHERE email = ${email.toLowerCase()}`;
    } catch { /* ok — table may not exist yet */ }
    return { allowed: true, role: "admin" };
  }

  try {
    const { rows } = await sql`SELECT role, status FROM users WHERE email = ${email.toLowerCase()}`;

    if (rows.length === 0) {
      // User not in database — block access
      return { allowed: false, role: "user", reason: "no_access" };
    }

    const user = rows[0];
    if (user.status === "suspended") {
      return { allowed: false, role: user.role, reason: "suspended" };
    }

    // Update last login and activate pending users
    await sql`
      UPDATE users SET last_login = now(), status = 'active', updated_at = now()
      WHERE email = ${email.toLowerCase()}
    `;

    const resolvedRole = user.role === "standard" ? "user" : (user.role || "user");
    return { allowed: true, role: resolvedRole };
  } catch {
    // Database error — fail closed for non-admin users
    return { allowed: false, role: "user", reason: "error" };
  }
}

export function getAuthOptions(): NextAuthOptions {
  return {
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorization: {
          params: {
            scope: "openid email profile https://www.googleapis.com/auth/gmail.send",
            access_type: "offline",
            prompt: "consent",
          },
        },
      }),
    ],
    callbacks: {
      async signIn({ user }) {
        const email = user.email?.toLowerCase() || "";
        if (!email.endsWith("@" + ALLOWED_DOMAIN)) return false;
        const { allowed, reason } = await checkUserStatus(email);
        if (!allowed) {
          if (reason === "suspended") return "/sign-in?error=Suspended";
          return "/sign-in?error=NoAccess";
        }
        return true;
      },
      async jwt({ token, user, account }) {
        if (account) {
          token.access_token = account.access_token;
          token.refresh_token = account.refresh_token;
          token.expires_at = account.expires_at;
        }
        if (user) {
          const email = user.email?.toLowerCase() || "";
          const { role } = await checkUserStatus(email);
          token.role = role;
        }
        // Refresh expired token
        if (token.expires_at && typeof token.expires_at === "number" && Date.now() >= token.expires_at * 1000) {
          try {
            const response = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                grant_type: "refresh_token",
                refresh_token: token.refresh_token as string,
              }),
            });
            const tokens = await response.json();
            if (tokens.access_token) {
              token.access_token = tokens.access_token;
              token.expires_at = Math.floor(Date.now() / 1000 + tokens.expires_in);
            }
          } catch { /* use existing token */ }
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          (session.user as Record<string, unknown>).role = token.role;
        }
        (session as unknown as Record<string, unknown>).accessToken = token.access_token;
        return session;
      },
    },
    pages: {
      signIn: "/sign-in",
      error: "/sign-in",
    },
  };
}
