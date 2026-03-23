"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface User {
  email: string; name: string; firstName?: string; lastName?: string;
  role: "admin" | "knowledge_manager" | "user"; status: "active" | "suspended" | "pending";
  lastLogin: string | null; createdAt: string;
  suspendedAt?: string | null; sessionRevokedAt?: string | null;
  defaultMode?: string; defaultInteraction?: string;
}

function InlineEdit({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  if (editing) return <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder={placeholder}
    onBlur={() => { setEditing(false); if (text !== value) onSave(text); }}
    onKeyDown={e => { if (e.key === "Enter") { setEditing(false); if (text !== value) onSave(text); } if (e.key === "Escape") { setEditing(false); setText(value); } }}
    style={{ fontSize: 16, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--color-mustard)", background: "var(--color-cream)", color: "var(--color-onyx)", width: "100%", outline: "none", fontWeight: 500 }} />;
  return <span onClick={() => setEditing(true)} style={{ cursor: "pointer", borderBottom: "1px dashed rgba(22,22,22,0.15)" }}>{value || <span style={{ color: "#aaa" }}>{placeholder}</span>}</span>;
}

// Role display
const ROLE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  admin: { bg: "#3c3b22", color: "#f8f6ee", label: "Admin" },
  knowledge_manager: { bg: "#CC8A39", color: "#161616", label: "Knowledge Manager" },
  user: { bg: "#f0ede6", color: "#555", label: "User" },
};

function RoleSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; function c(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false); } document.addEventListener("mousedown", c); return () => document.removeEventListener("mousedown", c); }, [open]);
  const st = ROLE_STYLES[value] || ROLE_STYLES.user;
  return (
    <div style={{ position: "relative" }}>
      <button ref={btnRef} onClick={() => { if (btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 4, left: r.left }); } setOpen(!open); }}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: st.bg, color: st.color, border: "none", borderRadius: 20, padding: "4px 12px 4px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        {st.label} <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div ref={menuRef} style={{ position: "fixed", top: pos.top, left: pos.left, background: "#fff", borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 9999, minWidth: 200, padding: "6px 0" }}>
          {Object.entries(ROLE_STYLES).map(([key, s]) => (
            <button key={key} onClick={() => { onChange(key); setOpen(false); }}
              className="w-full flex items-center justify-between" style={{ padding: "0 16px", height: 40, background: "transparent", border: "none", cursor: "pointer", fontSize: 14, color: "#2a2a2a" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(204,138,57,0.08)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div className="flex items-center gap-2">
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: s.bg }} />
                {s.label}
              </div>
              {key === value && <span style={{ color: "var(--color-mustard)", fontWeight: 600 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionsMenu({ user, onAction, onUpdate }: { user: User; onAction: (type: string) => void; onUpdate: (u: Record<string, string>) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; function c(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false); } function esc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); } document.addEventListener("mousedown", c); document.addEventListener("keydown", esc); return () => { document.removeEventListener("mousedown", c); document.removeEventListener("keydown", esc); }; }, [open]);
  function toggle() { if (btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 4, left: Math.max(8, r.right - 230) }); } setOpen(!open); setExpandedItem(null); }
  const itemStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "0 16px", height: 40, background: "transparent", border: "none", cursor: "pointer", fontSize: 14, color: "#2a2a2a", textAlign: "left" };
  const hov = (e: React.MouseEvent<HTMLElement>) => e.currentTarget.style.background = "rgba(204,138,57,0.08)";
  const unhov = (e: React.MouseEvent<HTMLElement>) => e.currentTarget.style.background = "transparent";
  const modes = [["sales", "Sales"], ["client-success", "Client Success"], ["fulfillment", "Revenue Management"], ["onboarding", "Onboarding"]];
  const views = [["client", "Client Mode"], ["research", "Strategy Mode"]];

  return (
    <div>
      <button ref={btnRef} onClick={toggle} aria-label="User actions" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#999", padding: "8px 4px", lineHeight: 1 }}>&hellip;</button>
      {open && (
        <div ref={menuRef} style={{ position: "fixed", top: pos.top, left: pos.left, background: "#fff", borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 9999, minWidth: 230, padding: "6px 0" }}>
          <button onClick={() => setExpandedItem(expandedItem === "mode" ? null : "mode")} style={itemStyle} onMouseEnter={hov} onMouseLeave={unhov}>Set default mode <span style={{ color: "#bbb", fontSize: 13 }}>&rsaquo;</span></button>
          {expandedItem === "mode" && (
            <div className="flex flex-wrap gap-1" style={{ padding: "4px 16px 10px" }}>
              {modes.map(([k, l]) => <button key={k} onClick={() => { onUpdate({ defaultMode: k }); setExpandedItem(null); }} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: user.defaultMode === k ? "#CC8A39" : "#f0ede6", color: user.defaultMode === k ? "#161616" : "#555", fontWeight: user.defaultMode === k ? 600 : 400 }}>{l}</button>)}
            </div>
          )}
          <button onClick={() => setExpandedItem(expandedItem === "view" ? null : "view")} style={itemStyle} onMouseEnter={hov} onMouseLeave={unhov}>Set default view <span style={{ color: "#bbb", fontSize: 13 }}>&rsaquo;</span></button>
          {expandedItem === "view" && (
            <div className="flex flex-wrap gap-1" style={{ padding: "4px 16px 10px" }}>
              {views.map(([k, l]) => <button key={k} onClick={() => { onUpdate({ defaultInteraction: k }); setExpandedItem(null); }} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: user.defaultInteraction === k ? "#3c3b22" : "#f0ede6", color: user.defaultInteraction === k ? "#f8f6ee" : "#555", fontWeight: user.defaultInteraction === k ? 600 : 400 }}>{l}</button>)}
            </div>
          )}
          <button onClick={() => { setOpen(false); onAction("revoke"); }} style={itemStyle} onMouseEnter={hov} onMouseLeave={unhov}>Revoke sessions</button>
          {user.status === "active"
            ? <button onClick={() => { setOpen(false); onAction("suspend"); }} style={itemStyle} onMouseEnter={hov} onMouseLeave={unhov}>Suspend</button>
            : <button onClick={() => { setOpen(false); onAction("unsuspend"); }} style={itemStyle} onMouseEnter={hov} onMouseLeave={unhov}>Unsuspend</button>}
          <div style={{ margin: "4px 0", borderTop: "1px solid rgba(0,0,0,0.06)" }} />
          <button onClick={() => { setOpen(false); onAction("delete"); }} style={{ ...itemStyle, color: "#c0392b" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(192,57,43,0.08)"} onMouseLeave={unhov}>Delete user</button>
        </div>
      )}
    </div>
  );
}

function formatLogin(d: string | null) {
  if (!d) return <span style={{ fontStyle: "italic", color: "#aaa" }}>Never</span>;
  return <span style={{ color: "#777" }}>{new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>;
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
  const [inviteRole, setInviteRole] = useState<string>("user");
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
    setUsers(p => p.map(u => { if (u.email !== email) return u; const up = { ...u }; if (updates.firstName !== undefined) { up.firstName = updates.firstName; up.name = [updates.firstName, u.lastName||""].join(" ").trim(); } if (updates.lastName !== undefined) { up.lastName = updates.lastName; up.name = [u.firstName||"", updates.lastName].join(" ").trim(); } if (updates.role) up.role = updates.role as User["role"]; if (updates.defaultMode) up.defaultMode = updates.defaultMode; if (updates.defaultInteraction) up.defaultInteraction = updates.defaultInteraction; if (updates.action === "suspend") up.status = "suspended"; if (updates.action === "unsuspend") up.status = "active"; if (updates.action === "activate_pending") up.status = "active"; return up; }));
    try { const r = await fetch("/api/admin/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, ...updates }) }); const d = await r.json(); if (d.error) { setUsers(prev); setToast("Failed to save"); return; } setToast("Saved"); } catch { setUsers(prev); setToast("Failed to save"); }
  }
  async function deleteUser(email: string) { try { await fetch("/api/admin/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); setToast("User removed"); setConfirmAction(null); loadUsers(); } catch { setToast("Delete failed"); } }
  async function revokeAll() { try { await fetch("/api/admin/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: session?.user?.email, action: "revoke_all" }) }); setToast("All sessions revoked"); setConfirmAction(null); } catch { setToast("Failed"); } }
  async function inviteUser() { if (!inviteEmail.trim()) return; setInviting(true); try { const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole, firstName: inviteFirstName.trim(), lastName: inviteLastName.trim(), defaultMode: inviteMode, defaultInteraction: inviteInteraction }) }); const d = await r.json(); if (d.error) { setToast(d.error); setInviting(false); return; } setToast("Invitation sent"); setInviteEmail(""); setInviteFirstName(""); setInviteLastName(""); setShowInvite(false); loadUsers(); } catch { setToast("Invite failed"); } finally { setInviting(false); } }
  function handleAction(u: User, type: string) { setConfirmAction({ type, email: u.email, name: u.name || u.email }); }
  function executeConfirm() { if (!confirmAction) return; const { type, email } = confirmAction; if (type === "delete") deleteUser(email); else if (type === "suspend") updateUser(email, { action: "suspend" }); else if (type === "unsuspend") { updateUser(email, { action: "unsuspend" }); setConfirmAction(null); } else if (type === "revoke") updateUser(email, { action: "revoke_sessions" }); else if (type === "revoke_all") revokeAll(); if (type !== "unsuspend") setConfirmAction(null); }
  function confirmTitle() { if (!confirmAction) return ""; const t = confirmAction.type; if (t === "delete") return "Delete user?"; if (t === "suspend") return "Suspend user?"; if (t === "unsuspend") return "Restore access?"; if (t === "revoke") return "Revoke sessions?"; if (t === "revoke_all") return "Revoke ALL sessions?"; return "Confirm"; }
  function confirmBody() { if (!confirmAction) return ""; const { type, name } = confirmAction; if (type === "delete") return `Permanently delete ${name}? This cannot be undone.`; if (type === "suspend") return `Suspend ${name}? They will be immediately signed out.`; if (type === "unsuspend") return `Restore access for ${name}?`; if (type === "revoke") return `Sign ${name} out of all devices?`; if (type === "revoke_all") return "Sign out ALL users from all devices?"; return ""; }

  const active = users.filter(u => u.status !== "pending");
  const pending = users.filter(u => u.status === "pending");

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

      <div className="flex-1 px-4 sm:px-8 py-8" style={{ maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        {/* Page heading */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-heading)", color: "var(--color-onyx)" }}>Team Members</h2>
            <p style={{ fontSize: 14, color: "#888", marginTop: 4 }}>Manage your team&apos;s access and permissions</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfirmAction({ type: "revoke_all", email: "", name: "" })} className="btn-outline" style={{ fontSize: 13 }}>Revoke All</button>
            <button onClick={() => setShowInvite(true)} className="btn-primary">+ Invite</button>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block" style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "visible" }}>
          {/* Header */}
          <div className="flex items-center" style={{ padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ width: "20%", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "2px", color: "#999" }}>Name</div>
            <div style={{ width: "30%", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "2px", color: "#999" }}>Email</div>
            <div style={{ width: "18%", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "2px", color: "#999" }}>Role</div>
            <div style={{ width: "12%", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "2px", color: "#999" }}>Status</div>
            <div style={{ width: "14%", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "2px", color: "#999" }}>Last Login</div>
            <div style={{ width: "6%", textAlign: "right" }} />
          </div>
          {loading ? <div className="flex justify-center py-16"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} /></div>
          : active.length === 0 ? <div className="text-center py-16" style={{ fontSize: 15, color: "#aaa" }}>No team members yet</div>
          : active.map(u => (
            <div key={u.email} className="flex items-center transition-all" style={{ height: 60, padding: "0 16px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(204,138,57,0.04)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: "20%", fontSize: 16, fontWeight: 500, color: "var(--color-onyx)" }}>
                <InlineEdit value={`${u.firstName||""} ${u.lastName||""}`.trim()} placeholder="Add name" onSave={v => { const parts = v.split(" "); updateUser(u.email, { firstName: parts[0]||"", lastName: parts.slice(1).join(" ")||"" }); }} />
              </div>
              <div title={u.email} style={{ width: "30%", fontSize: 15, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{u.email}</div>
              <div style={{ width: "18%" }}><RoleSelector value={u.role} onChange={v => updateUser(u.email, { role: v })} /></div>
              <div style={{ width: "12%" }}>
                <span style={{ fontSize: 13, padding: "4px 10px", borderRadius: 20, fontWeight: 500,
                  background: u.status === "active" ? "#e8f0e8" : "#fce8e8",
                  color: u.status === "active" ? "#2d5a2d" : "#8b2020" }}>
                  {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                </span>
              </div>
              <div style={{ width: "14%", fontSize: 14 }}>{formatLogin(u.lastLogin)}</div>
              <div style={{ width: "6%", textAlign: "right" }}><ActionsMenu user={u} onAction={type => handleAction(u, type)} onUpdate={updates => updateUser(u.email, updates)} /></div>
            </div>
          ))}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden flex flex-col gap-3">
          {loading ? <div className="flex justify-center py-16"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} /></div>
          : active.map(u => (
            <div key={u.email} style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 16, fontWeight: 500 }}>{u.firstName||""} {u.lastName||""}</span>
                <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: u.status === "active" ? "#e8f0e8" : "#fce8e8", color: u.status === "active" ? "#2d5a2d" : "#8b2020" }}>{u.status.charAt(0).toUpperCase() + u.status.slice(1)}</span>
              </div>
              <div style={{ fontSize: 14, color: "#777", marginBottom: 10 }}>{u.email}</div>
              <div className="flex items-center justify-between">
                <RoleSelector value={u.role} onChange={v => updateUser(u.email, { role: v })} />
                <ActionsMenu user={u} onAction={type => handleAction(u, type)} onUpdate={updates => updateUser(u.email, updates)} />
              </div>
              <div style={{ fontSize: 13, color: "#aaa", marginTop: 8 }}>Last login: {formatLogin(u.lastLogin)}</div>
            </div>
          ))}
        </div>

        {/* Pending */}
        {pending.length > 0 && (
          <div className="mt-8">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, fontFamily: "var(--font-heading)" }}>Pending Invites</h3>
            {pending.map(u => (
              <div key={u.email} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2" style={{ background: "#fff", borderRadius: 10, padding: "12px 18px", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div><span style={{ fontSize: 15 }}>{u.email}</span> <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 12, background: "#CC8A39", color: "#161616", fontWeight: 600, marginLeft: 8 }}>Pending</span></div>
                <div className="flex gap-2">
                  <button onClick={() => updateUser(u.email, { action: "activate_pending" })} className="btn-outline" style={{ fontSize: 13, padding: "6px 14px" }}>Activate</button>
                  <button onClick={() => setConfirmAction({ type: "delete", email: u.email, name: u.email })} style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(192,57,43,0.3)", background: "transparent", color: "#c0392b", cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="shrink-0 flex items-center justify-center" style={{ height: 40, background: "var(--bg-footer)", borderTop: "1px solid rgba(255,255,255,0.08)" }}><p style={{ fontSize: 13, color: "rgba(237,233,225,0.4)" }}>Wyle Admin — Freewyld Foundry</p></footer>

      {toast && <div role="status" aria-live="polite" className="fixed bottom-14 right-6 px-4 py-2.5 font-medium shadow-lg toast-enter" style={{ borderRadius: 10, background: "var(--color-onyx)", color: "var(--color-cream)", fontSize: 14, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>{toast}</div>}

      {showInvite && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-enter" style={{ background: "rgba(22,22,22,0.5)", zIndex: 50 }}>
          <div className="modal-enter mx-4" style={{ width: 440, maxWidth: "100%", background: "#fff", borderRadius: 16, padding: "28px", boxShadow: "0 8px 32px rgba(22,22,22,0.25)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, fontFamily: "var(--font-heading)" }}>Invite Team Member</h3>
            <div className="flex gap-3 mb-3">
              <input value={inviteFirstName} onChange={e => setInviteFirstName(e.target.value)} placeholder="First name" className="flex-1 px-4 py-3 focus:outline-none" style={{ borderRadius: 10, background: "var(--color-cream)", border: "1px solid rgba(0,0,0,0.1)", fontSize: 15 }} />
              <input value={inviteLastName} onChange={e => setInviteLastName(e.target.value)} placeholder="Last name" className="flex-1 px-4 py-3 focus:outline-none" style={{ borderRadius: 10, background: "var(--color-cream)", border: "1px solid rgba(0,0,0,0.1)", fontSize: 15 }} />
            </div>
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@freewyld.com" className="w-full px-4 py-3 mb-4 focus:outline-none" style={{ borderRadius: 10, background: "var(--color-cream)", border: "1px solid rgba(0,0,0,0.1)", fontSize: 15 }} />
            <div className="flex flex-wrap gap-4 mb-5">
              <div><div style={{ fontSize: 12, color: "#999", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Role</div>
                <div className="flex gap-1">{Object.entries(ROLE_STYLES).map(([k, s]) => <button key={k} onClick={() => setInviteRole(k)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: inviteRole === k ? s.bg : "#f0ede6", color: inviteRole === k ? s.color : "#555", fontWeight: inviteRole === k ? 600 : 400 }}>{s.label}</button>)}</div></div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowInvite(false); setInviteEmail(""); setInviteFirstName(""); setInviteLastName(""); }} className="btn-outline">Cancel</button>
              <button onClick={inviteUser} disabled={inviting || !inviteEmail.trim()} className="btn-primary disabled:opacity-50">{inviting ? "Sending..." : "Send Invite"}</button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-enter" style={{ background: "rgba(22,22,22,0.5)", zIndex: 10000 }}>
          <div className="modal-enter mx-4" style={{ width: 420, maxWidth: "100%", background: "#fff", borderRadius: 16, padding: "28px", boxShadow: "0 8px 32px rgba(22,22,22,0.25)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, fontFamily: "var(--font-heading)" }}>{confirmTitle()}</h3>
            <p style={{ fontSize: 15, color: "#666", marginBottom: 24 }}>{confirmBody()}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmAction(null)} className="btn-outline">Cancel</button>
              <button onClick={executeConfirm} className={confirmAction.type === "delete" ? "btn-danger" : "btn-primary"}>
                {confirmAction.type === "delete" ? "Delete" : confirmAction.type === "suspend" ? "Suspend" : confirmAction.type === "unsuspend" ? "Restore" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
