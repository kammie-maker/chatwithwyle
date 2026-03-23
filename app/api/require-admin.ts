import { getServerSession } from "next-auth";
import { getAuthOptions, isAdmin } from "./auth/[...nextauth]/auth-options";

export async function requireAdmin(): Promise<{ authorized: boolean; email: string | null }> {
  const session = await getServerSession(getAuthOptions());
  const email = session?.user?.email?.toLowerCase() || null;
  if (!email) return { authorized: false, email: null };
  return { authorized: isAdmin(email), email };
}

export async function requireKbEditor(): Promise<{ authorized: boolean; email: string | null }> {
  const session = await getServerSession(getAuthOptions());
  const email = session?.user?.email?.toLowerCase() || null;
  if (!email) return { authorized: false, email: null };
  const role = (session?.user as Record<string, unknown>)?.role as string || "";
  return { authorized: role === "admin" || role === "knowledge_manager", email };
}
