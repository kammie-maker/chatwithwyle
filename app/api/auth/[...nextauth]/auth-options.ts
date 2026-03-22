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
        return true;
      },
      async jwt({ token, user }) {
        if (user) {
          const email = user.email?.toLowerCase() || "";
          token.role = ADMIN_EMAILS.includes(email) ? "admin" : "standard";
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
