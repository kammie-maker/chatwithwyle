"use client";

import React, { useState } from "react";

const C = { onyx: "#161616", bark: "#663925", mustard: "#CC8A39", olive: "#3c3b22", cream: "#f8f6ee", lightCream: "#EDE9E1" };

// ── Accordion ──
function Accordion({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 8 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 52, padding: "0 16px", background: "white", border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", cursor: "pointer",
        borderLeft: open ? `3px solid ${C.mustard}` : "3px solid transparent",
        transition: "border-left 200ms ease",
      }}>
        <span style={{ fontSize: 16, fontFamily: "Georgia, serif", fontWeight: 600, color: C.onyx }}>{title}</span>
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} style={{ width: 16, height: 16, color: "#999", transition: "transform 200ms ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      <div style={{ maxHeight: open ? 5000 : 0, overflow: "hidden", transition: "max-height 300ms ease" }}>
        <div style={{ padding: "16px 20px 8px" }}>{children}</div>
      </div>
    </div>
  );
}

function Sub({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.olive, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, color: "#555", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

function Mockup({ children, maxW = 580 }: { children: React.ReactNode; maxW?: number }) {
  return (
    <div style={{ maxWidth: maxW, background: "white", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: 20, margin: "12px 0 20px" }}>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, lineHeight: 1.75, color: "#333", marginBottom: 16 }}>{children}</p>;
}

// ── SVG Mockups ──

function MockSignIn() {
  return (
    <svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%" }}>
      <rect width="360" height="220" rx="10" fill={C.onyx} />
      <rect x="110" y="30" width="140" height="140" rx="12" fill="rgba(60,59,34,0.3)" stroke="rgba(237,233,225,0.15)" strokeWidth="1" />
      <rect x="152" y="45" width="56" height="56" rx="12" fill={C.mustard} />
      <rect x="152" y="45" width="56" height="56" rx="12" fill={C.bark} opacity="0.12" />
      <text x="180" y="82" textAnchor="middle" fontFamily="Georgia, serif" fontSize="32" fontWeight="700" fill={C.olive}>W</text>
      <text x="180" y="118" textAnchor="middle" fontFamily="Georgia, serif" fontSize="14" fontWeight="600" fill={C.cream}>Wyle</text>
      <rect x="130" y="135" width="100" height="28" rx="6" fill={C.mustard} />
      <text x="180" y="153" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill={C.onyx}>Sign in with Google</text>
      <text x="180" y="200" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill="rgba(237,233,225,0.35)">Restricted to @freewyld.com accounts</text>
    </svg>
  );
}

function MockSidebar() {
  return (
    <svg viewBox="0 0 280 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 280 }}>
      <rect width="280" height="120" rx="10" fill={C.onyx} />
      <rect x="16" y="14" width="32" height="32" rx="8" fill={C.mustard} />
      <rect x="16" y="14" width="32" height="32" rx="8" fill={C.bark} opacity="0.12" />
      <text x="32" y="35" textAnchor="middle" fontFamily="Georgia, serif" fontSize="18" fontWeight="700" fill={C.olive}>W</text>
      <text x="58" y="35" fontFamily="Georgia, serif" fontSize="15" fontWeight="600" fill={C.cream}>Wyle</text>
      <rect x="12" y="56" width="256" height="32" rx="8" fill={C.mustard} />
      <text x="140" y="77" textAnchor="middle" fontFamily="sans-serif" fontSize="12" fontWeight="600" fill={C.onyx}>+ New Chat</text>
      <rect x="12" y="96" width="256" height="10" rx="4" fill="rgba(255,255,255,0.1)" />
    </svg>
  );
}

function MockModeSelector() {
  const modes = [
    { label: "Sales", active: true },
    { label: "Client Success", active: false },
    { label: "Revenue Management", active: false },
    { label: "Onboarding", active: false },
  ];
  return (
    <svg viewBox="0 0 220 148" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 220 }}>
      <rect width="220" height="148" rx="10" fill={C.onyx} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {modes.map((m, i) => (
        <g key={m.label}>
          <rect x="10" y={10 + i * 32} width="200" height="28" rx="4" fill={m.active ? "rgba(255,255,255,0.08)" : "transparent"} />
          <text x="22" y={28 + i * 32} fontFamily="sans-serif" fontSize="12" fill={m.active ? C.mustard : C.cream} fontWeight={m.active ? "600" : "400"}>{m.label}</text>
        </g>
      ))}
    </svg>
  );
}

function MockToggle() {
  return (
    <svg viewBox="0 0 320 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 320 }}>
      <rect width="320" height="40" rx="8" fill={C.cream} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      <rect x="70" y="6" width="180" height="28" rx="14" fill="rgba(22,22,22,0.04)" />
      <rect x="73" y="8" width="84" height="24" rx="12" fill={C.olive} />
      <text x="115" y="24" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill={C.cream}>Client Mode</text>
      <text x="205" y="24" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill="rgba(22,22,22,0.35)">Strategy Mode</text>
    </svg>
  );
}

function MockResponseBubble() {
  return (
    <svg viewBox="0 0 520 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%" }}>
      <rect width="520" height="200" rx="10" fill={C.cream} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      <rect x="16" y="14" width="28" height="28" rx="7" fill={C.mustard} /><rect x="16" y="14" width="28" height="28" rx="7" fill={C.bark} opacity="0.12" />
      <text x="30" y="33" textAnchor="middle" fontFamily="Georgia, serif" fontSize="16" fontWeight="700" fill={C.olive}>W</text>
      <rect x="52" y="10" width="452" height="180" rx="10" fill="white" stroke="rgba(22,22,22,0.08)" strokeWidth="1" />
      <rect x="68" y="26" width="260" height="7" rx="2" fill="rgba(22,22,22,0.1)" />
      <rect x="68" y="38" width="380" height="7" rx="2" fill="rgba(22,22,22,0.07)" />
      <rect x="68" y="50" width="180" height="7" rx="2" fill="rgba(22,22,22,0.07)" />
      <line x1="68" y1="70" x2="488" y2="70" stroke="rgba(22,22,22,0.06)" strokeWidth="1" />
      <text x="68" y="88" fontFamily="sans-serif" fontSize="10" fill={C.olive}>+ More Detail</text>
      <text x="162" y="88" fontFamily="sans-serif" fontSize="10" fill={C.olive}>+ Full Script</text>
      <text x="248" y="88" fontFamily="sans-serif" fontSize="10" fill={C.olive}>+ Rep Notes</text>
      <text x="336" y="88" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill={C.olive}>Expand All</text>
      <rect x="68" y="104" width="72" height="24" rx="12" fill={C.bark} />
      <text x="104" y="119" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={C.cream}>Draft Text</text>
      <rect x="148" y="104" width="76" height="24" rx="12" fill={C.bark} />
      <text x="186" y="119" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={C.cream}>Draft Email</text>
      <rect x="232" y="104" width="92" height="24" rx="12" fill={C.bark} />
      <text x="278" y="119" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={C.cream}>Draft Voicemail</text>
    </svg>
  );
}

function MockModeSwitchCard() {
  return (
    <svg viewBox="0 0 380 90" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 380 }}>
      <rect width="380" height="90" rx="10" fill="white" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <text x="18" y="26" fontFamily="sans-serif" fontSize="11" fill={C.onyx}>You switched to <tspan fontWeight="600">Client Success</tspan>.</text>
      <rect x="18" y="36" width="72" height="28" rx="6" fill={C.mustard} />
      <text x="54" y="54" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill={C.onyx}>New Chat</text>
      <rect x="96" y="36" width="92" height="28" rx="6" fill={C.olive} />
      <text x="142" y="54" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill={C.cream}>Bring Context</text>
      <text x="18" y="80" fontFamily="sans-serif" fontSize="9" fill="#999">Wyle will re-read this conversation and respond as Client Success</text>
    </svg>
  );
}

function MockConversationList() {
  return (
    <svg viewBox="0 0 260 170" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 260 }}>
      <rect width="260" height="170" rx="10" fill={C.onyx} />
      <text x="16" y="18" fontFamily="sans-serif" fontSize="8" fontWeight="600" fill="rgba(168,168,152,1)" letterSpacing="1.5">TODAY</text>
      <rect x="6" y="24" width="248" height="32" rx="4" fill="rgba(204,138,57,0.15)" />
      <line x1="6" y1="24" x2="6" y2="56" stroke={C.mustard} strokeWidth="2" />
      <rect x="14" y="32" width="16" height="12" rx="3" fill={C.bark} />
      <text x="22" y="41" textAnchor="middle" fontFamily="sans-serif" fontSize="6" fontWeight="600" fill={C.cream}>S</text>
      <text x="36" y="44" fontFamily="sans-serif" fontSize="11" fill={C.cream}>Handling fee objection</text>
      <rect x="6" y="60" width="248" height="32" rx="4" fill="transparent" />
      <rect x="14" y="68" width="16" height="12" rx="3" fill={C.olive} />
      <text x="22" y="77" textAnchor="middle" fontFamily="sans-serif" fontSize="6" fontWeight="600" fill={C.cream}>CS</text>
      <text x="36" y="80" fontFamily="sans-serif" fontSize="11" fill={C.cream}>Client billing question</text>
      <text x="16" y="112" fontFamily="sans-serif" fontSize="8" fontWeight="600" fill="rgba(168,168,152,1)" letterSpacing="1.5">YESTERDAY</text>
      <rect x="6" y="118" width="248" height="32" rx="4" fill="transparent" />
      <rect x="14" y="126" width="16" height="12" rx="3" fill="rgba(204,138,57,0.6)" />
      <text x="22" y="135" textAnchor="middle" fontFamily="sans-serif" fontSize="5" fontWeight="600" fill={C.cream}>RM</text>
      <text x="36" y="138" fontFamily="sans-serif" fontSize="11" fill={C.cream}>Presenting Q4 results</text>
    </svg>
  );
}

function MockProfileRow() {
  return (
    <svg viewBox="0 0 260 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 260 }}>
      <rect width="260" height="48" rx="6" fill={C.onyx} />
      <circle cx="24" cy="24" r="12" fill={C.olive} />
      <text x="24" y="28" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill={C.cream}>K</text>
      <text x="46" y="27" fontFamily="sans-serif" fontSize="12" fontWeight="500" fill={C.cream}>Kammie Melton</text>
      <rect x="142" y="16" width="32" height="14" rx="3" fill={C.olive} />
      <text x="158" y="26" textAnchor="middle" fontFamily="sans-serif" fontSize="7" fontWeight="600" fill={C.cream}>Admin</text>
    </svg>
  );
}

function MockProfilePopover() {
  return (
    <svg viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 240 }}>
      <rect width="240" height="180" rx="10" fill="white" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <text x="16" y="22" fontFamily="sans-serif" fontSize="8" fontWeight="600" fill="#999" letterSpacing="1">MY DEFAULT ROLE</text>
      <rect x="16" y="30" width="42" height="18" rx="9" fill={C.mustard} />
      <text x="37" y="42" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fontWeight="600" fill={C.onyx}>Sales</text>
      <rect x="64" y="30" width="78" height="18" rx="9" fill="rgba(22,22,22,0.06)" />
      <text x="103" y="42" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={C.onyx}>Client Success</text>
      <text x="16" y="66" fontFamily="sans-serif" fontSize="8" fontWeight="600" fill="#999" letterSpacing="1">MY DEFAULT VIEW</text>
      <rect x="16" y="74" width="70" height="18" rx="9" fill={C.olive} />
      <text x="51" y="86" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fontWeight="600" fill={C.cream}>Client Mode</text>
      <rect x="92" y="74" width="78" height="18" rx="9" fill="rgba(22,22,22,0.06)" />
      <text x="131" y="86" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={C.onyx}>Strategy Mode</text>
      <line x1="0" y1="102" x2="240" y2="102" stroke="rgba(22,22,22,0.08)" strokeWidth="1" />
      <text x="16" y="122" fontFamily="sans-serif" fontSize="11" fill={C.olive}>Admin Panel</text>
      <text x="16" y="142" fontFamily="sans-serif" fontSize="11" fill="#666">Clear History</text>
      <text x="16" y="162" fontFamily="sans-serif" fontSize="11" fill="#666">Sign Out</text>
    </svg>
  );
}

function MockFileUpload() {
  return (
    <svg viewBox="0 0 440 50" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 440 }}>
      <rect width="440" height="50" rx="8" fill="white" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      <rect x="8" y="8" width="34" height="34" rx="8" fill={C.cream} stroke="rgba(22,22,22,0.08)" strokeWidth="1" />
      <text x="25" y="30" textAnchor="middle" fontFamily="sans-serif" fontSize="14" fill={C.olive}>&#128206;</text>
      <rect x="50" y="8" width="310" height="34" rx="8" fill="white" stroke="rgba(22,22,22,0.08)" strokeWidth="1" />
      <text x="66" y="29" fontFamily="sans-serif" fontSize="11" fill="rgba(22,22,22,0.3)">Ask Wyle anything...</text>
      <rect x="368" y="8" width="64" height="34" rx="8" fill={C.mustard} />
      <text x="400" y="29" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fontWeight="600" fill={C.onyx}>Send</text>
    </svg>
  );
}

function MockAdminTable() {
  return (
    <svg viewBox="0 0 520 110" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%" }}>
      <rect width="520" height="110" rx="10" fill="white" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
      <text x="16" y="22" fontFamily="sans-serif" fontSize="7" fontWeight="600" fill="#999" letterSpacing="1.5">NAME</text>
      <text x="130" y="22" fontFamily="sans-serif" fontSize="7" fontWeight="600" fill="#999" letterSpacing="1.5">EMAIL</text>
      <text x="300" y="22" fontFamily="sans-serif" fontSize="7" fontWeight="600" fill="#999" letterSpacing="1.5">ROLE</text>
      <text x="400" y="22" fontFamily="sans-serif" fontSize="7" fontWeight="600" fill="#999" letterSpacing="1.5">STATUS</text>
      <line x1="0" y1="30" x2="520" y2="30" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      <text x="16" y="50" fontFamily="sans-serif" fontSize="10" fontWeight="500" fill={C.onyx}>Kammie Melton</text>
      <text x="130" y="50" fontFamily="sans-serif" fontSize="9" fill="#555">kammie@freewyld.com</text>
      <rect x="300" y="40" width="44" height="16" rx="8" fill={C.olive} /><text x="322" y="51" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fontWeight="600" fill={C.cream}>Admin</text>
      <rect x="400" y="40" width="44" height="16" rx="8" fill="#e8f0e8" /><text x="422" y="51" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fontWeight="500" fill="#2d5a2d">Active</text>
      <text x="496" y="50" fontFamily="sans-serif" fontSize="12" fill="#999">&hellip;</text>
      <line x1="0" y1="62" x2="520" y2="62" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      <text x="16" y="82" fontFamily="sans-serif" fontSize="10" fontWeight="500" fill={C.onyx}>Mariano Garcia</text>
      <text x="130" y="82" fontFamily="sans-serif" fontSize="9" fill="#555">mariano@freewyld.com</text>
      <rect x="300" y="72" width="34" height="16" rx="8" fill="#f0ede6" /><text x="317" y="83" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fontWeight="500" fill="#555">User</text>
      <rect x="400" y="72" width="44" height="16" rx="8" fill="#e8f0e8" /><text x="422" y="83" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fontWeight="500" fill="#2d5a2d">Active</text>
      <text x="496" y="82" fontFamily="sans-serif" fontSize="12" fill="#999">&hellip;</text>
    </svg>
  );
}

function MockFlywheel() {
  const cx = 290, cy = 260;
  const nodes: { x: number; y: number; label: string; color: string }[] = [
    { x: 290, y: 80, label: "Calls Happen", color: C.bark },
    { x: 440, y: 150, label: "Transcripts Saved", color: C.olive },
    { x: 460, y: 310, label: "Pipeline Runs", color: C.mustard },
    { x: 340, y: 420, label: "KB Updated", color: C.bark },
    { x: 120, y: 330, label: "Agents + Skills", color: C.olive },
    { x: 120, y: 160, label: "Prompt Rebuilt", color: C.mustard },
  ];

  // Curved paths between adjacent nodes
  function arcPath(from: typeof nodes[0], to: typeof nodes[0]) {
    const mx = (from.x + to.x) / 2 + (to.y - from.y) * 0.15;
    const my = (from.y + to.y) / 2 - (to.x - from.x) * 0.15;
    return `M${from.x},${from.y + 26} Q${mx},${my} ${to.x},${to.y - 26}`;
  }

  return (
    <svg viewBox="0 0 580 520" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%" }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke={C.bark} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r="195" fill="none" stroke="rgba(0,0,0,0.08)" strokeDasharray="4,4" />
      {/* Center */}
      <circle cx={cx} cy={cy} r="40" fill={C.mustard} />
      <circle cx={cx} cy={cy} r="40" fill={C.bark} opacity="0.12" />
      <text x={cx} y={cy + 10} textAnchor="middle" fontFamily="Georgia, serif" fontSize="36" fontWeight="700" fill="white">W</text>
      {/* Arrows between nodes */}
      {nodes.map((n, i) => {
        const next = nodes[(i + 1) % nodes.length];
        return <path key={`arc-${i}`} d={arcPath(n, next)} stroke="rgba(102,57,37,0.4)" strokeWidth="1.5" fill="none" markerEnd="url(#arrow)" />;
      })}
      {/* Nodes */}
      {nodes.map((n, i) => (
        <g key={i}>
          <rect x={n.x - 65} y={n.y - 26} width="130" height="52" rx="10" fill={n.color} />
          <text x={n.x} y={n.y + 4} textAnchor="middle" fontFamily="sans-serif" fontSize="12" fontWeight="600" fill={C.cream}>{n.label}</text>
        </g>
      ))}
      {/* External inputs */}
      <line x1="540" y1="310" x2="525" y2="310" stroke="rgba(102,57,37,0.5)" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <text x="546" y="306" fontFamily="sans-serif" fontSize="11" fill="#555" fontStyle="italic">Source</text>
      <text x="546" y="318" fontFamily="sans-serif" fontSize="11" fill="#555" fontStyle="italic">Documents</text>
      <line x1="40" y1="370" x2="55" y2="355" stroke="rgba(102,57,37,0.5)" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <text x="6" y="384" fontFamily="sans-serif" fontSize="11" fill="#555" fontStyle="italic">Manual Updates</text>
      {/* Result label */}
      <text x={cx} y="500" textAnchor="middle" fontFamily="sans-serif" fontSize="13" fill="#888" fontStyle="italic">Better calls &rarr; better transcripts &rarr; better knowledge &rarr; better Wyle</text>
    </svg>
  );
}

function ScheduleTable() {
  const rows = [
    ["Mon 1:00 AM", "Sales transcripts processed"],
    ["Mon 2:00 AM", "Podcast sync"],
    ["Mon 3:00 AM", "Insight docs built"],
    ["Mon 4:00 AM", "Fathom transcripts processed"],
    ["Mon 5:00 AM", "Agent + skill files updated"],
    ["Mon 6:00 AM", "Master prompt recompiled"],
  ];
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 12, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)" }}>
      <thead>
        <tr style={{ background: C.olive, color: C.cream }}>
          <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>Time (PDT)</th>
          <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>Function</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([time, fn], i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? "white" : "rgba(248,246,238,0.5)" }}>
            <td style={{ padding: "12px 16px", color: "#555" }}>{time}</td>
            <td style={{ padding: "12px 16px", color: "#333" }}>{fn}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DosDonts() {
  const dos = ["Use it on live calls for real-time scripts", "Use it to prep before a client conversation", "Use it to draft Slack messages and emails", "Ask Freewyld-specific questions", "Use + Rep Notes for internal context", "Trust it on processes and protocols"];
  const donts = ["Use it to find info on specific clients", "Make promises based solely on Wyle's output", "Share sensitive client PII in the chat", "Use it for revenue, commission, or payout questions", "Treat it as a replacement for judgment on edge cases"];
  const itemStyle = (color: string): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 8, height: 32, padding: "0 12px", fontSize: 14 });
  return (
    <div className="mobile-stack" style={{ display: "flex", gap: 16 }}>
      <div style={{ flex: 1, background: "#f0f7f0", borderLeft: "3px solid #2d6a2d", borderRadius: "0 8px 8px 0", padding: "8px 0" }}>
        <div style={{ padding: "4px 12px 8px", fontWeight: 700, fontSize: 14, color: "#2d6a2d" }}>DO</div>
        {dos.map(t => <div key={t} style={itemStyle("#2d6a2d")}><span style={{ color: "#2d6a2d", fontWeight: 700 }}>&#10003;</span><span style={{ color: "#333" }}>{t}</span></div>)}
      </div>
      <div style={{ flex: 1, background: "#fdf0f0", borderLeft: "3px solid #8b2020", borderRadius: "0 8px 8px 0", padding: "8px 0" }}>
        <div style={{ padding: "4px 12px 8px", fontWeight: 700, fontSize: 14, color: "#8b2020" }}>DON&apos;T</div>
        {donts.map(t => <div key={t} style={itemStyle("#8b2020")}><span style={{ color: "#8b2020", fontWeight: 700 }}>&#10007;</span><span style={{ color: "#333" }}>{t}</span></div>)}
      </div>
    </div>
  );
}

// ── Exported Guide Content ──
type GuideTab = "user" | "kb" | "admin";

export default function GuideContent({ userRole }: { userRole: string }) {
  const isKb = userRole === "admin" || userRole === "knowledge_manager";
  const isAdmin = userRole === "admin";

  const tabs: { key: GuideTab; label: string }[] = [
    { key: "user", label: "Chat Guide" },
    ...(isKb ? [{ key: "kb" as GuideTab, label: "Knowledge Base Guide" }] : []),
    ...(isAdmin ? [{ key: "admin" as GuideTab, label: "Admin Guide" }] : []),
  ];
  const [activeGuideTab, setActiveGuideTab] = useState<GuideTab>("user");

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: C.cream }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 24px 48px" }}>
        {/* Guide tabs */}
        {tabs.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveGuideTab(t.key)}
                style={{ fontSize: 14, fontWeight: 500, padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "var(--font-body)", transition: "all 0.15s ease",
                  background: activeGuideTab === t.key ? C.onyx : "transparent",
                  color: activeGuideTab === t.key ? C.cream : "#777" }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Chat Guide ── */}
        {activeGuideTab === "user" && (
          <>
            <Accordion title="Getting Started" defaultOpen>
              <P>Wyle is Freewyld Foundry&apos;s internal AI tool. Its purpose is to help you understand Freewyld&apos;s processes, protocols, promises, and positioning and communicate them clearly and confidently to clients.</P>
              <Sub label="Signing In">Sign in with your @freewyld.com Google account. No password needed.</Sub>
              <Mockup><MockSignIn /></Mockup>
              <Sub label="Your first chat">Click + New Chat in the sidebar, select your role, and start typing. Wyle responds immediately.</Sub>
              <Mockup maxW={280}><MockSidebar /></Mockup>
            </Accordion>

            <Accordion title="Chat Roles" defaultOpen>
              <P>Select your role based on what you&apos;re working on. Each role gives Wyle a different lens.</P>
              <Mockup maxW={220}><MockModeSelector /></Mockup>
              <Sub label="Sales">For Mariano and Jaydon. Objection handling, FAQs, and drafting follow-ups for sales prospects.</Sub>
              <Sub label="Client Success">For Felipe. Responding to existing clients via Slack and email. Billing questions, disputes, hospitality issues, and client communication.</Sub>
              <Sub label="Revenue Management">For revenue managers. Presenting strategies and results, getting client buy-in, and handling pushback on recommendations.</Sub>
              <Sub label="Onboarding">For Felipe. Walking new clients through the onboarding process, setting expectations, and pre-empting common concerns.</Sub>
            </Accordion>

            <Accordion title="Lead/Client Mode vs Strategy Mode" defaultOpen>
              <P>The toggle at the top of the chat switches between two response styles.</P>
              <Mockup maxW={320}><MockToggle /></Mockup>
              <Sub label="Lead Mode (Sales)">In the Sales role, this is called Lead Mode. Wyle responds with word-for-word scripts you can say directly to a lead. Use this when you&apos;re on a call, in a Slack thread, or drafting a message.</Sub>
              <Sub label="Client Mode (other roles)">In Client Success, Revenue Management, and Onboarding, this is called Client Mode. Same format, tuned for existing clients.</Sub>
              <Sub label="Strategy Mode">Wyle responds with coaching, context, and internal analysis. Use this when you&apos;re preparing for a call or researching a topic.</Sub>
              <Sub label="Switching mid-conversation">Toggle at any time. Previous messages stay visible. New responses immediately follow the new mode&apos;s format. No disruption.</Sub>
            </Accordion>

            <Accordion title="How Wyle Responds" defaultOpen>
              <P>Every response in Lead/Client Mode starts with a ready-to-use script followed by options to go deeper.</P>
              <Mockup><MockResponseBubble /></Mockup>
              <Sub label="The initial response">The first response is a concise 1-3 sentence script. Say it directly or adapt it.</Sub>
              <Sub label="+ More Detail">2-5 additional sentences expanding on the initial response. Still client-facing.</Sub>
              <Sub label="+ Full Script">A longer word-for-word script covering the topic in full depth.</Sub>
              <Sub label="+ Rep Notes">Internal context, coaching notes, and background for your eyes only.</Sub>
              <Sub label="Expand All">Loads all three sections at once below the initial response.</Sub>
              <Sub label="Draft buttons">Generates a ready-to-send draft based on the visible response. Appears as a new message in the chat.</Sub>
            </Accordion>

            <Accordion title="Using the Chat" defaultOpen>
              <Sub label="What Wyle is for">Use Wyle to understand and communicate Freewyld&apos;s processes, protocols, promises, pricing, guarantees, and positioning. Whether you&apos;re handling an objection, answering a client question, drafting a follow-up, or preparing for a call, Wyle knows Freewyld and helps you communicate it well.</Sub>
              <Sub label="What Wyle is not for (right now)">Wyle does not have context on specific clients, their revenue, or their portfolio performance. Do not use it for anything related to revenue reporting, commissions, or team payouts.</Sub>
              <Sub label="How to ask good questions">Be specific to Freewyld. Instead of &quot;how do I handle a pricing objection&quot; ask &quot;how do I handle a prospect who says our fee is too expensive.&quot;</Sub>
              <Sub label="Switching roles">Use the role selector in the bottom left. If you switch roles (e.g. Sales to Client Success), you&apos;ll be asked whether to start fresh or bring your conversation along.</Sub>
              <Mockup maxW={380}><MockModeSwitchCard /></Mockup>
            </Accordion>

            <Accordion title="Do's and Don'ts">
              <DosDonts />
            </Accordion>

            <Accordion title="File Uploads">
              <Sub label="Supported file types">Images (JPG, PNG, GIF, WebP), PDFs, and text files (TXT, MD, CSV).</Sub>
              <Sub label="Size limits">10MB per file. Maximum 10 files at once.</Sub>
              <Sub label="How it works">Attach a file using the paperclip icon next to the input. Wyle reads the content and includes it in your conversation.</Sub>
              <Mockup maxW={440}><MockFileUpload /></Mockup>
              <Sub label="Limitations">Files are read into the conversation context, not stored permanently. Large PDFs may be truncated. Images are analyzed visually.</Sub>
            </Accordion>

            <Accordion title="Chat History">
              <P>All conversations are saved automatically. Access them anytime from the sidebar.</P>
              <Sub label="Finding a conversation">Conversations are grouped by date: Today, Yesterday, Last 7 days, Last 30 days, Older. Click any conversation to resume it.</Sub>
              <Mockup maxW={260}><MockConversationList /></Mockup>
              <Sub label="Searching">Use the search bar at the top of the sidebar to search by title or message content.</Sub>
              <Sub label="Renaming, pinning, deleting">Hover over a conversation to see the pencil (rename), pin, and trash icons.</Sub>
            </Accordion>

            <Accordion title="Your Profile">
              <P>Click your name at the bottom of the sidebar to access your profile and settings.</P>
              <Mockup maxW={260}><MockProfileRow /></Mockup>
              <Sub label="Default role">Set which role opens by default when you start a new chat.</Sub>
              <Sub label="Default view">Set whether new chats open in Lead/Client Mode or Strategy Mode by default.</Sub>
              <Mockup maxW={240}><MockProfilePopover /></Mockup>
            </Accordion>
          </>
        )}

        {/* ── Knowledge Base Guide ── */}
        {activeGuideTab === "kb" && isKb && (
          <>
            <Accordion title="Managing the Knowledge Base" defaultOpen>
              <P>The Knowledge Base is what Wyle knows. It contains source documents, call insights, agent definitions, and skill files. You can view and edit all of it.</P>
              <Sub label="Accessing the KB editor">Click &quot;Knowledge Base&quot; in the top navigation. Only Knowledge Managers and Admins can access this.</Sub>
              <Sub label="Browsing files">The left sidebar lists all KB files organized by type. Click any file to view and edit its contents.</Sub>
              <Sub label="Editing a file directly">Click into the content area on the right to edit any file. Changes are saved when you click Save.</Sub>
              <Sub label="Chat-to-edit">Use the chat panel below the file content to describe changes in plain language. Wyle will suggest edits using track changes. Review and accept or reject each change.</Sub>
              <Sub label="Update Wyle's Knowledge">After making changes, click &quot;Update Wyle&apos;s Knowledge&quot; to recompile the master prompt. Wyle will have updated knowledge within 60 seconds.</Sub>
            </Accordion>

            <Accordion title="Weekly Update Schedule" defaultOpen>
              <P>Six automated pipelines run every Monday between 1 AM and 6 AM PDT.</P>
              <ScheduleTable />
              <P>Manual updates via the KB editor take effect immediately after clicking &quot;Update Wyle&apos;s Knowledge&quot;. No need to wait for the weekly cycle.</P>
            </Accordion>

            <Accordion title="How Wyle Learns" defaultOpen>
              <P>Wyle gets smarter every week automatically. Two input streams feed into the knowledge base: live call transcripts and source documents. Both are processed, synthesized, and compiled into Wyle&apos;s master prompt every Monday morning.</P>
              <Mockup><MockFlywheel /></Mockup>
            </Accordion>
          </>
        )}

        {/* ── Admin Guide ── */}
        {activeGuideTab === "admin" && isAdmin && (
          <Accordion title="Managing Your Team" defaultOpen>
            <P>Access the admin panel from your profile menu at the bottom of the sidebar.</P>
            <Mockup><MockAdminTable /></Mockup>
            <Sub label="Adding a user">Click &quot;+ Add User&quot;, fill in their name, email, role, and default settings. After adding, share the Wyle URL with them via Slack. They sign in with their @freewyld.com Google account. No password needed.</Sub>
            <Sub label="Roles">Three roles are available:</Sub>
            <div className="mobile-stack" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Admin", bg: C.olive, color: C.cream, desc: "Full access including admin panel and KB editor" },
                { label: "Knowledge Manager", bg: C.mustard, color: C.onyx, desc: "Chat + KB editor access. Cannot manage users." },
                { label: "User", bg: "#f0ede6", color: "#555", desc: "Chat access only." },
              ].map(r => (
                <div key={r.label} style={{ flex: "1 1 140px", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.07)", background: "white" }}>
                  <span style={{ display: "inline-block", fontSize: 12, padding: "3px 10px", borderRadius: 12, background: r.bg, color: r.color, fontWeight: 600, marginBottom: 6 }}>{r.label}</span>
                  <div style={{ fontSize: 13, color: "#555" }}>{r.desc}</div>
                </div>
              ))}
            </div>
            <Sub label="Suspending a user">Click the three dots next to a user, then Suspend. They are immediately signed out and cannot sign back in.</Sub>
            <Sub label="Changing a user's role">Click the role dropdown inline in the user table and select a new role. Takes effect immediately.</Sub>
            <Sub label="Revoking sessions">Click the three dots, then Revoke Sessions to sign a user out of all devices without suspending.</Sub>
            <Sub label="Deleting a user">Click the three dots, then Delete User. This is permanent and removes their account.</Sub>
          </Accordion>
        )}
      </div>
    </div>
  );
}
