"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface User {
  email: string; name: string; firstName?: string; lastName?: string;
  role: "admin" | "standard"; status: "active" | "suspended" | "pending";
  lastLogin: string | null; createdAt: string;
  suspendedAt?: string | null; sessionRevokedAt?: string | null;
  defaultMode?: string; defaultInteraction?: string;
}

function InlineEdit({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  if (editing) {
    return <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder={placeholder}
      onBlur={() => { setEditing(false); if (text !== value) onSave(text); }}
      onKeyDown={e => { if (e.key === "Enter") { setEditing(false); if (text !== value) onSave(text); } if (e.key === "Escape") { setEditing(false); setText(value); } }}
      style={{ fontSize: 13, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--color-mustard)", background: "var(--color-cream)", color: "var(--color-onyx)", width: "100%", outline: "none" }} />;
  }
  return <span onClick={() => setEditing(true)} style={{ cursor: "pointer", borderBottom: "1px dashed rgba(22,22,22,0.2)" }}>{value || <span style={{ color: "rgba(22,22,22,0.3)" }}>{placeholder}</span>}</span>;
}

function ActionsMenu({ user, onAction }: { user: User; onAction: (type: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} aria-label="User actions" style={{ background: "none", border: "1px solid rgba(22,22,22,0.12)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 16, color: "rgba(22,22,22,0.5)", lineHeight: 1 }}>&hellip;</button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "var(--bg-card)", borderRadius: 8, border: "1px solid rgba(22,22,22,0.08)", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 20, minWidth: 160, overflow: "hidden" }}>
          <button onClick={() => { setOpen(false); onAction("revoke"); }} className="w-full text-left px-4 py-2.5 text-xs transition-all" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-onyx)" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.03)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>Revoke Sessions</button>
          {user.status === "active" ? (
            <button onClick={() => { setOpen(false); onAction("suspend"); }} className="w-full text-left px-4 py-2.5 text-xs transition-all" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-onyx)" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.03)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>Suspend</button>
          ) : (
            <button onClick={() => { setOpen(false); onAction("unsuspend"); }} className="w-full text-left px-4 py-2.5 text-xs transition-all" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-onyx)" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.03)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>Unsuspend</button>
          )}
          <button onClick={() => { setOpen(false); onAction("delete"); }} className="w-full text-left px-4 py-2.5 text-xs transition-all" style={{ background: "transparent", border: "none", cursor: "pointer", color: "#b91c1c", borderTop: "1px solid rgba(22,22,22,0.06)" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(180,30,30,0.04)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>Delete</button>
        </div>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  active: { bg: "#3c3b22", color: "#f8f6ee" },
  suspended: { bg: "#663925", color: "#f8f6ee" },
  pending: { bg: "#CC8A39", color: "#161616" },
};
const MODE_DISPLAY: Record<string, string> = { sales: "Sales", "client-success": "Client Success", fulfillment: "Revenue Mgmt", onboarding: "Onboarding" };
const INTERACTION_DISPLAY: Record<string, string> = { client: "Client Interaction", research: "Internal Research" };

function formatLogin(d: string | null) {
  if (!d) return <span style={{ fontStyle: "italic", color: "rgba(22,22,22,0.3)" }}>Never</span>;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRole, setInviteRole] = useState<"standard" | "admin">("standard");
  const [inviteMode, setInviteMode] = useState("sales");
  const [inviteInteraction, setInviteInteraction] = useState("client");
  const [inviting, setInviting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; email: string; name: string } | null>(null);

  const userRole = (session?.user as Record<string, unknown>)?.role;
  useEffect(() => { if (status === "authenticated" && userRole !== "admin") router.push("/"); }, [status, userRole, router]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => { if (userRole === "admin") loadUsers(); }, [userRole]);

  async function loadUsers() { setLoading(true); try { const r = await fetch("/api/admin/users"); const d = await r.json(); setUsers(d.users || []); } catch { setUsers([]); } finally { setLoading(false); } }

  async function updateUser(email: string, updates: Record<string, string>) {
    const prev = [...users];
    setUsers(p => p.map(u => {
      if (u.email !== email) return u;
      const up = { ...u };
      if (updates.firstName !== undefined) { up.firstName = updates.firstName; up.name = [updates.firstName, u.lastName || ""].join(" ").trim(); }
      if (updates.lastName !== undefined) { up.lastName = updates.lastName; up.name = [u.firstName || "", updates.lastName].join(" ").trim(); }
      if (updates.role) up.role = updates.role as "admin" | "standard";
      if (updates.defaultMode) up.defaultMode = updates.defaultMode;
      if (updates.defaultInteraction) up.defaultInteraction = updates.defaultInteraction;
      if (updates.action === "suspend") up.status = "suspended";
      if (updates.action === "unsuspend") up.status = "active";
      if (updates.action === "activate_pending") up.status = "active";
      return up;
    }));
    try {
      const r = await fetch("/api/admin/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, ...updates }) });
      const d = await r.json();
      if (d.error) { setUsers(prev); setToast("Failed to save"); return; }
      setToast(updates.action === "suspend" ? "User suspended" : updates.action === "unsuspend" ? "User unsuspended" : updates.action === "revoke_sessions" ? "Sessions revoked" : updates.firstName !== undefined || updates.lastName !== undefined ? "Name updated" : "Saved");
    } catch { setUsers(prev); setToast("Failed to save"); }
  }

  async function deleteUser(email: string) { try { await fetch("/api/admin/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); setToast("User removed"); setConfirmAction(null); loadUsers(); } catch { setToast("Delete failed"); } }
  async function revokeAll() { try { await fetch("/api/admin/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: session?.user?.email, action: "revoke_all" }) }); setToast("All sessions revoked"); setConfirmAction(null); } catch { setToast("Failed"); } }
  async function inviteUser() { if (!inviteEmail.trim()) return; setInviting(true); try { const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole, firstName: inviteFirstName.trim(), lastName: inviteLastName.trim(), defaultMode: inviteMode, defaultInteraction: inviteInteraction }) }); const d = await r.json(); if (d.error) { setToast(d.error); setInviting(false); return; } setToast("Invitation sent"); setInviteEmail(""); setInviteFirstName(""); setInviteLastName(""); setShowInvite(false); loadUsers(); } catch { setToast("Invite failed"); } finally { setInviting(false); } }

  function handleAction(user: User, type: string) {
    if (type === "unsuspend") { updateUser(user.email, { action: "unsuspend" }); return; }
    setConfirmAction({ type, email: user.email, name: user.name || user.email });
  }
  function executeConfirm() { if (!confirmAction) return; if (confirmAction.type === "delete") deleteUser(confirmAction.email); else if (confirmAction.type === "suspend") updateUser(confirmAction.email, { action: "suspend" }); else if (confirmAction.type === "revoke") updateUser(confirmAction.email, { action: "revoke_sessions" }); else if (confirmAction.type === "revoke_all") revokeAll(); setConfirmAction(null); }

  const active = users.filter(u => u.status !== "pending");
  const pending = users.filter(u => u.status === "pending");

  const sel = { fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(22,22,22,0.12)", background: "var(--bg-card)", color: "var(--color-onyx)", cursor: "pointer" };

  if (status === "loading" || (status === "authenticated" && userRole !== "admin")) return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-onyx)" }}><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} /></div>;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-content)" }}>
      <header className="shrink-0 flex items-center justify-between px-4 sm:px-6" style={{ height: 60, background: "var(--bg-header)", borderBottom: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 2px 8px rgba(22,22,22,0.2)" }}>
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: 32, height: 32 }} aria-hidden="true"><rect width="100" height="100" rx="20" fill="#CC8A39"/><rect width="100" height="100" rx="20" fill="#663925" opacity="0.12"/><text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="58" fontWeight="700" fill="#3c3b22">W</text><text x="50" y="84" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fontWeight="600" fill="#3c3b22" letterSpacing="3" opacity="0.85">WYLE</text></svg>
          <h1 className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-cream)" }}>Wyle Admin</h1>
        </div>
        <button onClick={() => router.push("/")} className="btn-dark">Back to App</button>
      </header>

      <div className="flex-1 px-4 sm:px-6 py-6" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        {/* Top actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Team Members</h2>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button onClick={() => setConfirmAction({ type: "revoke_all", email: "", name: "" })} className="btn-outline text-xs w-full sm:w-auto">Revoke All Sessions</button>
            <button onClick={() => setShowInvite(true)} className="btn-primary w-full sm:w-auto">+ Invite User</button>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block" style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid rgba(22,22,22,0.06)", boxShadow: "0 1px 3px rgba(22,22,22,0.08)" }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 1060 }}>
              {/* Header */}
              <div className="flex items-center px-5 py-3" style={{ borderBottom: "1px solid rgba(22,22,22,0.08)", background: "rgba(22,22,22,0.02)" }}>
                {[["First", 120], ["Last", 120], ["Email", 200], ["Role", 110], ["Status", 100], ["Mode", 140], ["Type", 160], ["Last Login", 130]].map(([h, w]) => (
                  <div key={h as string} style={{ flex: `0 0 ${w}px`, fontSize: 11, fontWeight: 600, color: "rgba(22,22,22,0.45)", textTransform: "uppercase", letterSpacing: "1.5px" }}>{h as string}</div>
                ))}
                <div style={{ flex: 1, textAlign: "right", fontSize: 11, fontWeight: 600, color: "rgba(22,22,22,0.45)", textTransform: "uppercase", letterSpacing: "1.5px" }}>Actions</div>
              </div>
              {loading ? <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} /></div>
              : active.length === 0 ? <div className="text-center py-12 text-sm" style={{ color: "rgba(22,22,22,0.4)" }}>No active users.</div>
              : active.map(u => {
                const st = STATUS_STYLES[u.status] || STATUS_STYLES.active;
                return (
                  <div key={u.email} className="flex items-center px-5 transition-all" style={{ minHeight: 56, borderBottom: "1px solid rgba(22,22,22,0.04)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.02)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ flex: "0 0 120px", fontSize: 13, fontWeight: 500 }}><InlineEdit value={u.firstName || ""} placeholder="First" onSave={v => updateUser(u.email, { firstName: v })} /></div>
                    <div style={{ flex: "0 0 120px", fontSize: 13, fontWeight: 500 }}><InlineEdit value={u.lastName || ""} placeholder="Last" onSave={v => updateUser(u.email, { lastName: v })} /></div>
                    <div style={{ flex: "0 0 200px", fontSize: 12, color: "rgba(22,22,22,0.55)" }}>{u.email}</div>
                    <div style={{ flex: "0 0 110px" }}><select value={u.role} onChange={e => updateUser(u.email, { role: e.target.value })} style={sel}><option value="standard">Standard</option><option value="admin">Admin</option></select></div>
                    <div style={{ flex: "0 0 100px" }}><span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, fontWeight: 600, background: st.bg, color: st.color }}>{u.status.charAt(0).toUpperCase() + u.status.slice(1)}</span></div>
                    <div style={{ flex: "0 0 140px" }}><select value={u.defaultMode || "sales"} onChange={e => updateUser(u.email, { defaultMode: e.target.value })} style={sel}><option value="sales">Sales</option><option value="client-success">Client Success</option><option value="fulfillment">Revenue Mgmt</option><option value="onboarding">Onboarding</option></select></div>
                    <div style={{ flex: "0 0 160px" }}><select value={u.defaultInteraction || "client"} onChange={e => updateUser(u.email, { defaultInteraction: e.target.value })} style={sel}><option value="client">Client Interaction</option><option value="research">Internal Research</option></select></div>
                    <div style={{ flex: "0 0 130px", fontSize: 12, color: "rgba(22,22,22,0.45)" }}>{formatLogin(u.lastLogin)}</div>
                    <div style={{ flex: 1, textAlign: "right" }}><ActionsMenu user={u} onAction={type => handleAction(u, type)} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile card layout */}
        <div className="md:hidden flex flex-col gap-3">
          {loading ? <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} /></div>
          : active.length === 0 ? <div className="text-center py-12 text-sm" style={{ color: "rgba(22,22,22,0.4)" }}>No active users.</div>
          : active.map(u => {
            const st = STATUS_STYLES[u.status] || STATUS_STYLES.active;
            return (
              <div key={u.email} style={{ background: "var(--bg-card)", borderRadius: 12, padding: 16, border: "1px solid rgba(22,22,22,0.06)", boxShadow: "0 1px 3px rgba(22,22,22,0.06)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{u.firstName || ""} {u.lastName || ""}</span>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, fontWeight: 600, background: st.bg, color: st.color }}>{u.status.charAt(0).toUpperCase() + u.status.slice(1)}</span>
                </div>
                <div className="text-xs mb-3" style={{ color: "rgba(22,22,22,0.5)" }}>{u.email}</div>
                <div className="flex gap-2 mb-2">
                  <select value={u.role} onChange={e => updateUser(u.email, { role: e.target.value })} style={{ ...sel, flex: 1 }}><option value="standard">Standard</option><option value="admin">Admin</option></select>
                  <select value={u.defaultMode || "sales"} onChange={e => updateUser(u.email, { defaultMode: e.target.value })} style={{ ...sel, flex: 1 }}><option value="sales">Sales</option><option value="client-success">Client Success</option><option value="fulfillment">Revenue Mgmt</option><option value="onboarding">Onboarding</option></select>
                </div>
                <select value={u.defaultInteraction || "client"} onChange={e => updateUser(u.email, { defaultInteraction: e.target.value })} className="w-full mb-2" style={sel}><option value="client">Client Interaction</option><option value="research">Internal Research</option></select>
                <div className="text-xs mb-3" style={{ color: "rgba(22,22,22,0.4)" }}>Last login: {formatLogin(u.lastLogin)}</div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => handleAction(u, "revoke")} className="text-xs px-3 py-1.5" style={{ borderRadius: 6, border: "1px solid rgba(22,22,22,0.12)", background: "transparent", color: "rgba(22,22,22,0.5)", cursor: "pointer" }}>Revoke Sessions</button>
                  {u.status === "active" ? <button onClick={() => handleAction(u, "suspend")} className="text-xs px-3 py-1.5" style={{ borderRadius: 6, border: "1px solid #663925", background: "transparent", color: "#663925", cursor: "pointer" }}>Suspend</button>
                  : <button onClick={() => handleAction(u, "unsuspend")} className="text-xs px-3 py-1.5" style={{ borderRadius: 6, border: "1px solid #3c3b22", background: "transparent", color: "#3c3b22", cursor: "pointer" }}>Unsuspend</button>}
                  <button onClick={() => handleAction(u, "delete")} className="text-xs px-3 py-1.5" style={{ borderRadius: 6, border: "1px solid rgba(180,30,30,0.3)", background: "transparent", color: "#b91c1c", cursor: "pointer" }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pending */}
        {pending.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-heading)" }}>Pending Invites</h3>
            {pending.map(u => (
              <div key={u.email} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 mb-2" style={{ background: "var(--bg-card)", borderRadius: 10, border: "1px solid rgba(22,22,22,0.06)" }}>
                <div>
                  <span className="text-sm">{u.email}</span>
                  <span className="ml-2" style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, background: STATUS_STYLES.pending.bg, color: STATUS_STYLES.pending.color, fontWeight: 600 }}>Pending</span>
                  <span className="ml-2 text-xs" style={{ color: "rgba(22,22,22,0.4)" }}>{u.role} &middot; {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateUser(u.email, { action: "activate_pending" })} className="text-xs px-3 py-1.5" style={{ borderRadius: 6, border: "1px solid #3c3b22", background: "transparent", color: "#3c3b22", cursor: "pointer" }}>Activate</button>
                  <button onClick={() => setConfirmAction({ type: "delete", email: u.email, name: u.email })} className="text-xs px-3 py-1.5" style={{ borderRadius: 6, border: "1px solid rgba(180,30,30,0.3)", background: "transparent", color: "#b91c1c", cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="shrink-0 flex items-center justify-center" style={{ height: 40, background: "var(--bg-footer)", borderTop: "1px solid rgba(255,255,255,0.08)" }}><p className="text-xs" style={{ color: "rgba(237,233,225,0.4)" }}>Wyle Admin — Freewyld Foundry</p></footer>

      {toast && <div role="status" aria-live="polite" className="fixed bottom-14 right-6 px-4 py-2.5 text-sm font-medium shadow-lg toast-enter" style={{ borderRadius: 10, background: "var(--color-onyx)", color: "var(--color-cream)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>{toast}</div>}

      {showInvite && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-enter" style={{ background: "rgba(22,22,22,0.5)", zIndex: 50 }}>
          <div className="modal-enter mx-4" style={{ width: 420, maxWidth: "100%", background: "var(--bg-card)", borderRadius: 16, padding: "1.5rem", boxShadow: "0 8px 32px rgba(22,22,22,0.25)" }}>
            <h3 className="text-base font-semibold mb-4" style={{ fontFamily: "var(--font-heading)" }}>Invite Team Member</h3>
            <div className="flex gap-2 mb-3">
              <input value={inviteFirstName} onChange={e => setInviteFirstName(e.target.value)} placeholder="First name" className="flex-1 px-4 py-3 text-sm focus:outline-none" style={{ borderRadius: 10, background: "var(--color-cream)", border: "1px solid rgba(22,22,22,0.1)" }} />
              <input value={inviteLastName} onChange={e => setInviteLastName(e.target.value)} placeholder="Last name" className="flex-1 px-4 py-3 text-sm focus:outline-none" style={{ borderRadius: 10, background: "var(--color-cream)", border: "1px solid rgba(22,22,22,0.1)" }} />
            </div>
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@freewyld.com" className="w-full px-4 py-3 text-sm mb-3 focus:outline-none" style={{ borderRadius: 10, background: "var(--color-cream)", border: "1px solid rgba(22,22,22,0.1)" }} />
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-2"><span className="text-xs" style={{ color: "rgba(22,22,22,0.5)" }}>Role</span><select value={inviteRole} onChange={e => setInviteRole(e.target.value as "admin"|"standard")} style={sel}><option value="standard">Standard</option><option value="admin">Admin</option></select></div>
              <div className="flex items-center gap-2"><span className="text-xs" style={{ color: "rgba(22,22,22,0.5)" }}>Mode</span><select value={inviteMode} onChange={e => setInviteMode(e.target.value)} style={sel}><option value="sales">Sales</option><option value="client-success">Client Success</option><option value="fulfillment">Revenue Mgmt</option><option value="onboarding">Onboarding</option></select></div>
              <div className="flex items-center gap-2"><span className="text-xs" style={{ color: "rgba(22,22,22,0.5)" }}>Type</span><select value={inviteInteraction} onChange={e => setInviteInteraction(e.target.value)} style={sel}><option value="client">Client Interaction</option><option value="research">Internal Research</option></select></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowInvite(false); setInviteEmail(""); setInviteFirstName(""); setInviteLastName(""); }} className="btn-outline">Cancel</button>
              <button onClick={inviteUser} disabled={inviting || !inviteEmail.trim()} className="btn-primary disabled:opacity-40">{inviting ? "Sending..." : "Send Invite"}</button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-enter" style={{ background: "rgba(22,22,22,0.5)", zIndex: 50 }}>
          <div className="modal-enter mx-4" style={{ width: 420, maxWidth: "100%", background: "var(--bg-card)", borderRadius: 16, padding: "1.5rem", boxShadow: "0 8px 32px rgba(22,22,22,0.25)" }}>
            <h3 className="text-base font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>{confirmAction.type === "delete" ? "Remove user?" : confirmAction.type === "suspend" ? "Suspend user?" : confirmAction.type === "revoke" ? "Revoke sessions?" : "Revoke ALL sessions?"}</h3>
            <p className="text-sm mb-4" style={{ color: "rgba(22,22,22,0.55)" }}>{confirmAction.type === "delete" ? `Remove ${confirmAction.name}? They will lose access immediately.` : confirmAction.type === "suspend" ? `Suspend ${confirmAction.name}? They will be signed out immediately.` : confirmAction.type === "revoke" ? `Sign ${confirmAction.name} out of all devices?` : "Sign out ALL users from all devices?"}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmAction(null)} className="btn-outline">Cancel</button>
              <button onClick={executeConfirm} className={confirmAction.type === "delete" ? "btn-danger" : "btn-primary"}>{confirmAction.type === "delete" ? "Remove" : confirmAction.type === "suspend" ? "Suspend" : "Revoke"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
