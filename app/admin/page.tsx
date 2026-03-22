"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface User {
  email: string;
  name: string;
  role: "admin" | "standard";
  status: "active" | "suspended" | "pending";
  lastLogin: string | null;
  createdAt: string;
  suspendedAt?: string | null;
  sessionRevokedAt?: string | null;
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  active: { bg: "#3c3b22", color: "#f8f6ee" },
  suspended: { bg: "#663925", color: "#f8f6ee" },
  pending: { bg: "#CC8A39", color: "#161616" },
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"standard" | "admin">("standard");
  const [inviting, setInviting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; email: string; name: string } | null>(null);

  const userRole = (session?.user as Record<string, unknown>)?.role;

  useEffect(() => { if (status === "authenticated" && userRole !== "admin") router.push("/"); }, [status, userRole, router]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => { if (userRole === "admin") loadUsers(); }, [userRole]);

  async function loadUsers() {
    setLoading(true);
    try { const res = await fetch("/api/admin/users"); const data = await res.json(); setUsers(data.users || []); }
    catch { setUsers([]); }
    finally { setLoading(false); }
  }

  async function updateUser(email: string, updates: Record<string, string>) {
    try {
      const res = await fetch("/api/admin/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, ...updates }) });
      const data = await res.json();
      if (data.error) { setToast(data.error); return; }
      setToast(updates.action === "suspend" ? "User suspended" : updates.action === "unsuspend" ? "User unsuspended" : updates.action === "revoke_sessions" ? `Sessions revoked for ${email}` : "User updated");
      loadUsers();
    } catch { setToast("Update failed"); }
  }

  async function deleteUser(email: string) {
    try {
      const res = await fetch("/api/admin/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (data.error) { setToast(data.error); return; }
      setToast("User removed");
      setConfirmAction(null);
      loadUsers();
    } catch { setToast("Delete failed"); }
  }

  async function revokeAll() {
    try {
      await fetch("/api/admin/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: session?.user?.email, action: "revoke_all" }) });
      setToast("All sessions revoked");
      setConfirmAction(null);
      loadUsers();
    } catch { setToast("Failed"); }
  }

  async function inviteUser() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole, name: inviteName.trim() }) });
      const data = await res.json();
      if (data.error) { setToast(data.error); setInviting(false); return; }
      setToast("Invitation sent to " + inviteEmail.trim());
      setInviteEmail(""); setInviteName(""); setShowInvite(false);
      loadUsers();
    } catch { setToast("Invite failed"); }
    finally { setInviting(false); }
  }

  function executeConfirmAction() {
    if (!confirmAction) return;
    if (confirmAction.type === "delete") deleteUser(confirmAction.email);
    else if (confirmAction.type === "suspend") updateUser(confirmAction.email, { action: "suspend" });
    else if (confirmAction.type === "revoke") updateUser(confirmAction.email, { action: "revoke_sessions" });
    else if (confirmAction.type === "revoke_all") revokeAll();
    setConfirmAction(null);
  }

  const activeUsers = users.filter(u => u.status !== "pending");
  const pendingUsers = users.filter(u => u.status === "pending");

  if (status === "loading" || (status === "authenticated" && userRole !== "admin")) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-onyx)" }}><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-content)" }}>
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-6" style={{ height: 60, background: "var(--bg-header)", borderBottom: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 2px 8px rgba(22,22,22,0.2)" }}>
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: 32, height: 32 }}>
            <rect width="100" height="100" rx="20" fill="#CC8A39"/><rect width="100" height="100" rx="20" fill="#663925" opacity="0.12"/>
            <text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="58" fontWeight="700" fill="#3c3b22">W</text>
            <text x="50" y="84" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fontWeight="600" fill="#3c3b22" letterSpacing="3" opacity="0.85">WYLE</text>
          </svg>
          <h1 className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-cream)" }}>Wyle Admin</h1>
        </div>
        <button onClick={() => router.push("/")} className="text-xs font-medium px-3 py-1.5"
          style={{ borderRadius: "6px", background: "rgba(255,255,255,0.1)", border: "none", color: "var(--color-cream)", cursor: "pointer" }}>
          Back to App
        </button>
      </header>

      <div className="flex-1 px-6 py-6" style={{ maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        {/* Top actions */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-onyx)" }}>Team Members</h2>
          <div className="flex gap-2">
            <button onClick={() => setConfirmAction({ type: "revoke_all", email: "", name: "" })}
              style={{ borderRadius: 8, background: "transparent", border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>
              Revoke All Sessions
            </button>
            <button onClick={() => setShowInvite(true)}
              style={{ borderRadius: 20, background: "var(--color-mustard)", color: "var(--color-onyx)", border: "none", padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              + Invite User
            </button>
          </div>
        </div>

        {/* Active users table */}
        <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid rgba(22,22,22,0.06)", boxShadow: "0 1px 3px rgba(22,22,22,0.08)", overflow: "hidden" }}>
          <div className="flex items-center px-5 py-3" style={{ borderBottom: "1px solid rgba(22,22,22,0.08)", background: "rgba(22,22,22,0.02)" }}>
            {["Name", "Email", "Role", "Status", "Last Login", "Actions"].map((h, i) => (
              <div key={h} style={{ flex: i === 5 ? 1 : i === 0 ? "0 0 160px" : i === 1 ? "0 0 200px" : i === 2 ? "0 0 110px" : i === 3 ? "0 0 100px" : "0 0 130px", fontSize: 11, fontWeight: 600, color: "rgba(22,22,22,0.45)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i === 5 ? "right" : "left" }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} /></div>
          ) : activeUsers.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: "rgba(22,22,22,0.4)" }}>No active users.</div>
          ) : (
            activeUsers.map(user => {
              const st = STATUS_STYLES[user.status] || STATUS_STYLES.active;
              return (
                <div key={user.email} className="flex items-center px-5 py-3" style={{ borderBottom: "1px solid rgba(22,22,22,0.04)" }}>
                  <div style={{ flex: "0 0 160px", fontSize: 14, fontWeight: 500, color: "var(--color-onyx)" }}>{user.name}</div>
                  <div style={{ flex: "0 0 200px", fontSize: 13, color: "rgba(22,22,22,0.6)" }}>{user.email}</div>
                  <div style={{ flex: "0 0 110px" }}>
                    <select value={user.role} onChange={e => updateUser(user.email, { role: e.target.value })}
                      style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(22,22,22,0.12)", background: "var(--bg-card)", color: "var(--color-onyx)", cursor: "pointer" }}>
                      <option value="standard">Standard</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div style={{ flex: "0 0 100px" }}>
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 10, fontWeight: 600, background: st.bg, color: st.color }}>
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </div>
                  <div style={{ flex: "0 0 130px", fontSize: 12, color: "rgba(22,22,22,0.45)" }}>
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never"}
                  </div>
                  <div style={{ flex: 1, textAlign: "right", display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => setConfirmAction({ type: "revoke", email: user.email, name: user.name })}
                      style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(22,22,22,0.12)", background: "transparent", color: "rgba(22,22,22,0.5)", cursor: "pointer" }}>
                      Revoke
                    </button>
                    {user.status === "active" ? (
                      <button onClick={() => setConfirmAction({ type: "suspend", email: user.email, name: user.name })}
                        style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid #663925", background: "transparent", color: "#663925", cursor: "pointer" }}>
                        Suspend
                      </button>
                    ) : (
                      <button onClick={() => updateUser(user.email, { action: "unsuspend" })}
                        style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid #3c3b22", background: "transparent", color: "#3c3b22", cursor: "pointer" }}>
                        Unsuspend
                      </button>
                    )}
                    <button onClick={() => setConfirmAction({ type: "delete", email: user.email, name: user.name })}
                      style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(180,30,30,0.3)", background: "transparent", color: "#b91c1c", cursor: "pointer" }}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pending invites */}
        {pendingUsers.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-onyx)", fontFamily: "var(--font-heading)" }}>Pending Invites</h3>
            <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid rgba(22,22,22,0.06)", boxShadow: "0 1px 3px rgba(22,22,22,0.08)", overflow: "hidden" }}>
              <div className="flex items-center px-5 py-3" style={{ borderBottom: "1px solid rgba(22,22,22,0.08)", background: "rgba(22,22,22,0.02)" }}>
                {["Email", "Role", "Invited", "Actions"].map((h, i) => (
                  <div key={h} style={{ flex: i === 3 ? 1 : i === 0 ? "0 0 250px" : i === 1 ? "0 0 120px" : "0 0 150px", fontSize: 11, fontWeight: 600, color: "rgba(22,22,22,0.45)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i === 3 ? "right" : "left" }}>{h}</div>
                ))}
              </div>
              {pendingUsers.map(user => (
                <div key={user.email} className="flex items-center px-5 py-3" style={{ borderBottom: "1px solid rgba(22,22,22,0.04)" }}>
                  <div style={{ flex: "0 0 250px", fontSize: 13, color: "var(--color-onyx)" }}>
                    {user.email}
                    <span className="ml-2" style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, background: STATUS_STYLES.pending.bg, color: STATUS_STYLES.pending.color, fontWeight: 600 }}>Pending</span>
                  </div>
                  <div style={{ flex: "0 0 120px", fontSize: 12, color: "rgba(22,22,22,0.6)" }}>{user.role}</div>
                  <div style={{ flex: "0 0 150px", fontSize: 12, color: "rgba(22,22,22,0.45)" }}>
                    {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  <div style={{ flex: 1, textAlign: "right", display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => updateUser(user.email, { action: "activate_pending" })}
                      style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid #3c3b22", background: "transparent", color: "#3c3b22", cursor: "pointer" }}>
                      Activate
                    </button>
                    <button onClick={() => setConfirmAction({ type: "delete", email: user.email, name: user.email })}
                      style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(180,30,30,0.3)", background: "transparent", color: "#b91c1c", cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="shrink-0 flex items-center justify-center" style={{ height: 40, background: "var(--bg-footer)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <p className="text-xs" style={{ color: "rgba(237,233,225,0.4)" }}>Wyle Admin — Freewyld Foundry</p>
      </footer>

      {/* Toast */}
      {toast && <div className="fixed bottom-14 right-6 px-4 py-2.5 text-sm font-medium shadow-lg" style={{ borderRadius: 10, background: "var(--color-onyx)", color: "var(--color-cream)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>{toast}</div>}

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(22,22,22,0.5)", zIndex: 50 }}>
          <div style={{ width: 400, background: "var(--bg-card)", borderRadius: 16, padding: "1.5rem", boxShadow: "0 8px 32px rgba(22,22,22,0.25)" }}>
            <h3 className="text-base font-semibold mb-4" style={{ fontFamily: "var(--font-heading)", color: "var(--color-onyx)" }}>Invite Team Member</h3>
            <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Full name"
              className="w-full px-4 py-3 text-sm mb-3 focus:outline-none"
              style={{ borderRadius: 10, background: "var(--color-cream)", border: "1px solid rgba(22,22,22,0.1)", color: "var(--color-onyx)" }}
              onFocus={e => e.currentTarget.style.borderColor = "var(--color-mustard)"}
              onBlur={e => e.currentTarget.style.borderColor = "rgba(22,22,22,0.1)"} />
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@freewyld.com"
              className="w-full px-4 py-3 text-sm mb-3 focus:outline-none"
              style={{ borderRadius: 10, background: "var(--color-cream)", border: "1px solid rgba(22,22,22,0.1)", color: "var(--color-onyx)" }}
              onFocus={e => e.currentTarget.style.borderColor = "var(--color-mustard)"}
              onBlur={e => e.currentTarget.style.borderColor = "rgba(22,22,22,0.1)"} />
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs" style={{ color: "rgba(22,22,22,0.5)" }}>Role</span>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as "admin" | "standard")}
                style={{ fontSize: 13, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(22,22,22,0.12)", background: "var(--bg-card)" }}>
                <option value="standard">Standard</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowInvite(false); setInviteEmail(""); setInviteName(""); }}
                style={{ borderRadius: 8, background: "transparent", border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={inviteUser} disabled={inviting || !inviteEmail.trim()} className="disabled:opacity-40"
                style={{ borderRadius: 8, background: "var(--color-mustard)", color: "var(--color-onyx)", border: "none", padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {inviting ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm action modal */}
      {confirmAction && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(22,22,22,0.5)", zIndex: 50 }}>
          <div style={{ width: 400, background: "var(--bg-card)", borderRadius: 16, padding: "1.5rem", boxShadow: "0 8px 32px rgba(22,22,22,0.25)" }}>
            <h3 className="text-base font-semibold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-onyx)" }}>
              {confirmAction.type === "delete" ? "Remove user?" : confirmAction.type === "suspend" ? "Suspend user?" : confirmAction.type === "revoke" ? "Revoke sessions?" : "Revoke ALL sessions?"}
            </h3>
            <p className="text-sm mb-4" style={{ color: "rgba(22,22,22,0.55)" }}>
              {confirmAction.type === "delete" ? `Are you sure you want to remove ${confirmAction.name}? They will lose access immediately.`
                : confirmAction.type === "suspend" ? `Suspend ${confirmAction.name}? They will be immediately signed out and unable to log back in.`
                : confirmAction.type === "revoke" ? `Sign ${confirmAction.name} out of all devices? They will need to sign in again.`
                : "Sign out ALL users from all devices? This cannot be undone."}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmAction(null)}
                style={{ borderRadius: 8, background: "transparent", border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={executeConfirmAction}
                style={{ borderRadius: 8, background: confirmAction.type === "delete" ? "#b91c1c" : "#663925", color: "white", border: "none", padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {confirmAction.type === "delete" ? "Remove" : confirmAction.type === "suspend" ? "Suspend" : "Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
