"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface User {
  email: string;
  name: string;
  role: "admin" | "standard";
  status: "active" | "disabled";
  lastLogin: string | null;
  createdAt: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"standard" | "admin">("standard");
  const [inviting, setInviting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const userRole = (session?.user as Record<string, unknown>)?.role;

  useEffect(() => {
    if (status === "authenticated" && userRole !== "admin") {
      router.push("/");
    }
  }, [status, userRole, router]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  useEffect(() => { if (userRole === "admin") loadUsers(); }, [userRole]);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch { setUsers([]); }
    finally { setLoading(false); }
  }

  async function updateUser(email: string, updates: { role?: string; status?: string }) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...updates }),
      });
      const data = await res.json();
      if (data.error) { setToast(data.error); return; }
      setToast("User updated");
      loadUsers();
    } catch { setToast("Update failed"); }
  }

  async function deleteUser(email: string) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.error) { setToast(data.error); return; }
      setToast("User removed");
      setConfirmDelete(null);
      loadUsers();
    } catch { setToast("Delete failed"); }
  }

  async function inviteUser() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
      });
      const data = await res.json();
      if (data.error) { setToast(data.error); setInviting(false); return; }
      setToast("User added");
      setInviteEmail("");
      setShowInvite(false);
      loadUsers();
    } catch { setToast("Invite failed"); }
    finally { setInviting(false); }
  }

  if (status === "loading" || (status === "authenticated" && userRole !== "admin")) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-onyx)" }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} />
      </div>
    );
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

      {/* Content */}
      <div className="flex-1 px-6 py-6" style={{ maxWidth: 960, margin: "0 auto", width: "100%" }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-onyx)" }}>Team Members</h2>
          <button onClick={() => setShowInvite(true)}
            style={{ borderRadius: 20, background: "var(--color-mustard)", color: "var(--color-onyx)", border: "none", padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)" }}>
            + Add User
          </button>
        </div>

        {/* User table */}
        <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid rgba(22,22,22,0.06)", boxShadow: "0 1px 3px rgba(22,22,22,0.08)", overflow: "hidden" }}>
          {/* Header row */}
          <div className="flex items-center px-5 py-3" style={{ borderBottom: "1px solid rgba(22,22,22,0.08)", background: "rgba(22,22,22,0.02)" }}>
            <div style={{ flex: "0 0 200px", fontSize: 11, fontWeight: 600, color: "rgba(22,22,22,0.45)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Name</div>
            <div style={{ flex: "0 0 220px", fontSize: 11, fontWeight: 600, color: "rgba(22,22,22,0.45)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</div>
            <div style={{ flex: "0 0 120px", fontSize: 11, fontWeight: 600, color: "rgba(22,22,22,0.45)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Role</div>
            <div style={{ flex: "0 0 100px", fontSize: 11, fontWeight: 600, color: "rgba(22,22,22,0.45)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</div>
            <div style={{ flex: "0 0 140px", fontSize: 11, fontWeight: 600, color: "rgba(22,22,22,0.45)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Last Login</div>
            <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "rgba(22,22,22,0.45)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Actions</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: "rgba(22,22,22,0.4)" }}>No users yet. Add your first team member.</div>
          ) : (
            users.map(user => (
              <div key={user.email} className="flex items-center px-5 py-3" style={{ borderBottom: "1px solid rgba(22,22,22,0.04)" }}>
                <div style={{ flex: "0 0 200px", fontSize: 14, fontWeight: 500, color: "var(--color-onyx)" }}>{user.name}</div>
                <div style={{ flex: "0 0 220px", fontSize: 13, color: "rgba(22,22,22,0.6)" }}>{user.email}</div>
                <div style={{ flex: "0 0 120px" }}>
                  <select value={user.role} onChange={e => updateUser(user.email, { role: e.target.value })}
                    style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(22,22,22,0.12)", background: "var(--bg-card)", color: "var(--color-onyx)", cursor: "pointer" }}>
                    <option value="standard">Standard</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div style={{ flex: "0 0 100px" }}>
                  <button onClick={() => updateUser(user.email, { status: user.status === "active" ? "disabled" : "active" })}
                    style={{ fontSize: 11, padding: "3px 10px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 600,
                      background: user.status === "active" ? "rgba(60,59,34,0.1)" : "rgba(180,30,30,0.1)",
                      color: user.status === "active" ? "#3c3b22" : "#b91c1c" }}>
                    {user.status === "active" ? "Active" : "Disabled"}
                  </button>
                </div>
                <div style={{ flex: "0 0 140px", fontSize: 12, color: "rgba(22,22,22,0.45)" }}>
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never"}
                </div>
                <div style={{ flex: 1, textAlign: "right" }}>
                  <button onClick={() => setConfirmDelete(user.email)}
                    style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(180,30,30,0.3)", background: "transparent", color: "#b91c1c", cursor: "pointer" }}>
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
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
            <h3 className="text-base font-semibold mb-4" style={{ fontFamily: "var(--font-heading)", color: "var(--color-onyx)" }}>Add Team Member</h3>
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
              <button onClick={() => { setShowInvite(false); setInviteEmail(""); }}
                style={{ borderRadius: 8, background: "transparent", border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={inviteUser} disabled={inviting || !inviteEmail.trim()}
                className="disabled:opacity-40"
                style={{ borderRadius: 8, background: "var(--color-mustard)", color: "var(--color-onyx)", border: "none", padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {inviting ? "Adding..." : "Add User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(22,22,22,0.5)", zIndex: 50 }}>
          <div style={{ width: 400, background: "var(--bg-card)", borderRadius: 16, padding: "1.5rem", boxShadow: "0 8px 32px rgba(22,22,22,0.25)" }}>
            <h3 className="text-base font-semibold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-onyx)" }}>Remove user?</h3>
            <p className="text-sm mb-4" style={{ color: "rgba(22,22,22,0.55)" }}>
              Are you sure you want to remove {confirmDelete}? They will lose access immediately.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)}
                style={{ borderRadius: 8, background: "transparent", border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={() => deleteUser(confirmDelete)}
                style={{ borderRadius: 8, background: "#b91c1c", color: "white", border: "none", padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
