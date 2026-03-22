import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const ALLOWED_DOMAIN = "freewyld.com";

// Admin emails — first admin must be set here, then can manage others via admin panel
const ADMIN_EMAILS = [
  "kammie@freewyld.com",
  "eric@freewyld.com",
];

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase() || "";
      // Only allow @freewyld.com emails
      if (!email.endsWith("@" + ALLOWED_DOMAIN)) {
        return false;
      }
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
});

export { handler as GET, handler as POST };
