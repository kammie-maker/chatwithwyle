"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// ── Brand colors ──
const C = { onyx: "#161616", bark: "#663925", mustard: "#CC8A39", olive: "#3c3b22", cream: "#f8f6ee", lightCream: "#EDE9E1" };

// ── SVG Mockups ──

function MockSignIn() {
  return (
    <svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 360 }}>
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
    <svg viewBox="0 0 260 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 260 }}>
      <rect width="260" height="180" rx="10" fill={C.onyx} />
      <rect x="16" y="16" width="36" height="36" rx="8" fill={C.mustard} />
      <rect x="16" y="16" width="36" height="36" rx="8" fill={C.bark} opacity="0.12" />
      <text x="34" y="40" textAnchor="middle" fontFamily="Georgia, serif" fontSize="20" fontWeight="700" fill={C.olive}>W</text>
      <text x="62" y="39" fontFamily="Georgia, serif" fontSize="16" fontWeight="600" fill={C.cream}>Wyle</text>
      {/* New Chat button */}
      <rect x="12" y="62" width="236" height="36" rx="8" fill={C.mustard} />
      <text x="130" y="84" textAnchor="middle" fontFamily="sans-serif" fontSize="13" fontWeight="600" fill={C.onyx}>+ New Chat</text>
      {/* Annotation arrow */}
      <line x1="270" y1="80" x2="252" y2="80" stroke={C.mustard} strokeWidth="1.5" markerEnd="url(#arrowM)" />
      <text x="275" y="83" fontFamily="sans-serif" fontSize="9" fill={C.mustard}>Click here</text>
      <defs><marker id="arrowM" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill={C.mustard} /></marker></defs>
    </svg>
  );
}

function MockModeSelector() {
  const modes = [
    { label: "Sales", bg: C.bark, active: true },
    { label: "Client Success", bg: C.olive, active: false },
    { label: "Revenue Management", bg: C.mustard, active: false },
    { label: "Onboarding", bg: "rgba(102,57,37,0.6)", active: false },
  ];
  return (
    <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 240 }}>
      <rect width="240" height="160" rx="10" fill={C.onyx} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {modes.map((m, i) => (
        <g key={m.label}>
          <rect x="12" y={12 + i * 34} width="216" height="30" rx="4" fill={m.active ? "rgba(255,255,255,0.08)" : "transparent"} />
          <text x="24" y={31 + i * 34} fontFamily="sans-serif" fontSize="13" fill={m.active ? C.mustard : C.cream} fontWeight={m.active ? "600" : "400"}>{m.label}</text>
        </g>
      ))}
    </svg>
  );
}

function MockToggle() {
  return (
    <svg viewBox="0 0 340 50" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 340 }}>
      <rect width="340" height="50" rx="10" fill={C.cream} stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <rect x="80" y="10" width="180" height="30" rx="15" fill="rgba(22,22,22,0.04)" />
      <rect x="84" y="13" width="84" height="24" rx="12" fill={C.olive} />
      <text x="126" y="29" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fontWeight="600" fill={C.cream}>Client Mode</text>
      <text x="216" y="29" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fontWeight="600" fill="rgba(22,22,22,0.4)">Strategy Mode</text>
      {/* Annotations */}
      <line x1="126" y1="42" x2="126" y2="48" stroke={C.olive} strokeWidth="1" />
      <text x="126" y="56" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={C.olive}>Active</text>
    </svg>
  );
}

function MockResponseBubble() {
  return (
    <svg viewBox="0 0 520 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 520 }}>
      <rect width="520" height="260" rx="10" fill={C.cream} stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      {/* Avatar */}
      <rect x="16" y="16" width="32" height="32" rx="8" fill={C.mustard} />
      <rect x="16" y="16" width="32" height="32" rx="8" fill={C.bark} opacity="0.12" />
      <text x="32" y="37" textAnchor="middle" fontFamily="Georgia, serif" fontSize="18" fontWeight="700" fill={C.olive}>W</text>
      {/* Message bubble */}
      <rect x="56" y="12" width="440" height="232" rx="10" fill="white" stroke="rgba(22,22,22,0.08)" strokeWidth="1" />
      {/* Copy icon */}
      <rect x="470" y="20" width="16" height="16" rx="2" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
      <text x="518" y="32" fontFamily="sans-serif" fontSize="7" fill="rgba(0,0,0,0.3)">Copy</text>
      {/* SIMPLE text */}
      <rect x="72" y="28" width="280" height="8" rx="2" fill="rgba(22,22,22,0.12)" />
      <rect x="72" y="42" width="360" height="8" rx="2" fill="rgba(22,22,22,0.08)" />
      <rect x="72" y="56" width="200" height="8" rx="2" fill="rgba(22,22,22,0.08)" />
      {/* Divider */}
      <line x1="72" y1="80" x2="480" y2="80" stroke="rgba(22,22,22,0.06)" strokeWidth="1" />
      {/* Expand links */}
      <text x="72" y="100" fontFamily="sans-serif" fontSize="11" fill={C.olive}>+ More Detail</text>
      <text x="170" y="100" fontFamily="sans-serif" fontSize="11" fill={C.olive}>+ Full Script</text>
      <text x="262" y="100" fontFamily="sans-serif" fontSize="11" fill={C.olive}>+ Rep Notes</text>
      <text x="358" y="100" fontFamily="sans-serif" fontSize="11" fontWeight="600" fill={C.olive}>Expand All</text>
      {/* Annotation */}
      <line x1="72" y1="108" x2="72" y2="118" stroke={C.mustard} strokeWidth="1" />
      <text x="72" y="126" fontFamily="sans-serif" fontSize="8" fill={C.mustard}>Click to expand sections</text>
      {/* Draft buttons */}
      <rect x="72" y="140" width="80" height="26" rx="13" fill={C.bark} />
      <text x="112" y="157" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill={C.cream}>Draft Text</text>
      <rect x="160" y="140" width="82" height="26" rx="13" fill={C.bark} />
      <text x="201" y="157" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill={C.cream}>Draft Email</text>
      <rect x="250" y="140" width="100" height="26" rx="13" fill={C.bark} />
      <text x="300" y="157" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill={C.cream}>Draft Voicemail</text>
      {/* Annotation */}
      <line x1="200" y1="170" x2="200" y2="180" stroke={C.mustard} strokeWidth="1" />
      <text x="200" y="188" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={C.mustard}>Generate a ready-to-send draft</text>
    </svg>
  );
}

function MockDraftBubble() {
  return (
    <svg viewBox="0 0 420 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 420 }}>
      <rect width="420" height="100" rx="10" fill={C.cream} stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <rect x="56" y="8" width="350" height="84" rx="10" fill="white" stroke="rgba(22,22,22,0.08)" strokeWidth="1" />
      <rect x="68" y="16" width="72" height="18" rx="9" fill="rgba(22,22,22,0.06)" />
      <text x="104" y="29" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="600" fill="rgba(22,22,22,0.4)">Draft Email</text>
      <rect x="68" y="42" width="300" height="7" rx="2" fill="rgba(22,22,22,0.08)" />
      <rect x="68" y="54" width="320" height="7" rx="2" fill="rgba(22,22,22,0.06)" />
      <rect x="68" y="66" width="240" height="7" rx="2" fill="rgba(22,22,22,0.06)" />
    </svg>
  );
}

function MockModeSwitchCard() {
  return (
    <svg viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 400 }}>
      <rect width="400" height="100" rx="10" fill="white" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <text x="20" y="28" fontFamily="sans-serif" fontSize="12" fill={C.onyx}>You switched to <tspan fontWeight="600">Client Success</tspan>.</text>
      <rect x="20" y="42" width="80" height="30" rx="6" fill={C.mustard} />
      <text x="60" y="61" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill={C.onyx}>New Chat</text>
      <rect x="108" y="42" width="100" height="30" rx="6" fill={C.olive} />
      <text x="158" y="61" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill={C.cream}>Bring Context</text>
      <text x="20" y="88" fontFamily="sans-serif" fontSize="9" fill="#999">Wyle will re-read this conversation and respond as Client Success</text>
    </svg>
  );
}

function MockConversationList() {
  return (
    <svg viewBox="0 0 260 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 260 }}>
      <rect width="260" height="200" rx="10" fill={C.onyx} />
      <text x="16" y="20" fontFamily="sans-serif" fontSize="9" fontWeight="600" fill="rgba(168,168,152,1)" letterSpacing="1.5">TODAY</text>
      <rect x="8" y="28" width="244" height="36" rx="4" fill="rgba(204,138,57,0.15)" />
      <line x1="8" y1="28" x2="8" y2="64" stroke={C.mustard} strokeWidth="2" />
      <rect x="16" y="38" width="18" height="14" rx="3" fill={C.bark} />
      <text x="25" y="48" textAnchor="middle" fontFamily="sans-serif" fontSize="7" fontWeight="600" fill={C.cream}>S</text>
      <text x="42" y="50" fontFamily="sans-serif" fontSize="12" fill={C.cream}>Handling fee objection</text>
      <rect x="8" y="70" width="244" height="36" rx="4" fill="transparent" />
      <rect x="16" y="80" width="18" height="14" rx="3" fill={C.olive} />
      <text x="25" y="90" textAnchor="middle" fontFamily="sans-serif" fontSize="7" fontWeight="600" fill={C.cream}>CS</text>
      <text x="42" y="92" fontFamily="sans-serif" fontSize="12" fill={C.cream}>Client billing question</text>
      <text x="16" y="126" fontFamily="sans-serif" fontSize="9" fontWeight="600" fill="rgba(168,168,152,1)" letterSpacing="1.5">YESTERDAY</text>
      <rect x="8" y="134" width="244" height="36" rx="4" fill="transparent" />
      <rect x="16" y="144" width="18" height="14" rx="3" fill="rgba(204,138,57,0.6)" />
      <text x="25" y="154" textAnchor="middle" fontFamily="sans-serif" fontSize="6" fontWeight="600" fill={C.cream}>RM</text>
      <text x="42" y="156" fontFamily="sans-serif" fontSize="12" fill={C.cream}>Presenting Q4 results</text>
    </svg>
  );
}

function MockConvActions() {
  return (
    <svg viewBox="0 0 300 50" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 300 }}>
      <rect width="300" height="50" rx="8" fill={C.onyx} />
      <rect x="8" y="8" width="200" height="34" rx="4" fill="rgba(255,255,255,0.05)" />
      <rect x="16" y="16" width="18" height="14" rx="3" fill={C.bark} />
      <text x="25" y="26" textAnchor="middle" fontFamily="sans-serif" fontSize="7" fontWeight="600" fill={C.cream}>S</text>
      <text x="42" y="29" fontFamily="sans-serif" fontSize="12" fill={C.cream}>Draft a follow-up</text>
      {/* Icons */}
      <text x="220" y="30" fontFamily="sans-serif" fontSize="13" fill="rgba(248,246,238,0.7)">&#9998;</text>
      <text x="245" y="30" fontFamily="sans-serif" fontSize="13" fill="rgba(248,246,238,0.7)">&#128204;</text>
      <text x="270" y="30" fontFamily="sans-serif" fontSize="13" fill="rgba(248,246,238,0.7)">&#128465;</text>
      {/* Annotations */}
      <text x="216" y="48" fontFamily="sans-serif" fontSize="7" fill={C.mustard}>Rename</text>
      <text x="244" y="48" fontFamily="sans-serif" fontSize="7" fill={C.mustard}>Pin</text>
      <text x="264" y="48" fontFamily="sans-serif" fontSize="7" fill={C.mustard}>Delete</text>
    </svg>
  );
}

function MockProfileRow() {
  return (
    <svg viewBox="0 0 260 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 260 }}>
      <rect width="260" height="56" rx="8" fill={C.onyx} />
      <line x1="0" y1="0" x2="260" y2="0" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <circle cx="28" cy="28" r="14" fill={C.olive} />
      <text x="28" y="33" textAnchor="middle" fontFamily="sans-serif" fontSize="12" fontWeight="700" fill={C.cream}>K</text>
      <text x="52" y="30" fontFamily="sans-serif" fontSize="13" fontWeight="500" fill={C.cream}>Kammie Melton</text>
      <rect x="152" y="20" width="36" height="16" rx="3" fill={C.olive} />
      <text x="170" y="31" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fontWeight="600" fill={C.cream}>Admin</text>
      <text x="244" y="32" fontFamily="sans-serif" fontSize="14" fill="rgba(248,246,238,0.4)">&rsaquo;</text>
    </svg>
  );
}

function MockProfilePopover() {
  return (
    <svg viewBox="0 0 240 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 240 }}>
      <rect width="240" height="200" rx="10" fill="white" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <text x="16" y="24" fontFamily="sans-serif" fontSize="9" fontWeight="600" fill="#999" letterSpacing="1">I USUALLY USE WYLE FOR</text>
      <rect x="16" y="32" width="46" height="20" rx="10" fill={C.mustard} />
      <text x="39" y="45" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="600" fill={C.onyx}>Sales</text>
      <rect x="68" y="32" width="84" height="20" rx="10" fill="rgba(22,22,22,0.06)" />
      <text x="110" y="45" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={C.onyx}>Client Success</text>
      <text x="16" y="72" fontFamily="sans-serif" fontSize="9" fontWeight="600" fill="#999" letterSpacing="1">MY DEFAULT VIEW</text>
      <rect x="16" y="80" width="76" height="20" rx="10" fill={C.olive} />
      <text x="54" y="93" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="600" fill={C.cream}>Client Mode</text>
      <rect x="98" y="80" width="86" height="20" rx="10" fill="rgba(22,22,22,0.06)" />
      <text x="141" y="93" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={C.onyx}>Strategy Mode</text>
      <line x1="0" y1="112" x2="240" y2="112" stroke="rgba(22,22,22,0.08)" strokeWidth="1" />
      <text x="16" y="134" fontFamily="sans-serif" fontSize="12" fill={C.olive}>Admin Panel</text>
      <text x="16" y="156" fontFamily="sans-serif" fontSize="12" fill="#666">Clear History</text>
      <text x="16" y="178" fontFamily="sans-serif" fontSize="12" fill="#666">Sign Out</text>
    </svg>
  );
}

function MockFileUpload() {
  return (
    <svg viewBox="0 0 480 60" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 480 }}>
      <rect width="480" height="60" rx="10" fill="white" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      {/* Attach button */}
      <rect x="8" y="10" width="40" height="40" rx="10" fill={C.cream} stroke="rgba(22,22,22,0.08)" strokeWidth="1" />
      <text x="28" y="35" textAnchor="middle" fontFamily="sans-serif" fontSize="16" fill={C.olive}>&#128206;</text>
      {/* Annotation */}
      <line x1="28" y1="54" x2="28" y2="66" stroke={C.mustard} strokeWidth="1" />
      <text x="28" y="74" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={C.mustard}>Attach files</text>
      {/* Input */}
      <rect x="56" y="10" width="340" height="40" rx="10" fill="white" stroke="rgba(22,22,22,0.08)" strokeWidth="1" />
      <text x="72" y="35" fontFamily="sans-serif" fontSize="12" fill="rgba(22,22,22,0.3)">Ask Wyle anything...</text>
      {/* Send */}
      <rect x="404" y="10" width="68" height="40" rx="10" fill={C.mustard} />
      <text x="438" y="35" textAnchor="middle" fontFamily="sans-serif" fontSize="12" fontWeight="600" fill={C.onyx}>Send</text>
    </svg>
  );
}

function MockKBNav() {
  return (
    <svg viewBox="0 0 300 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 300 }}>
      <rect width="300" height="40" rx="8" fill={C.cream} stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <rect x="12" y="8" width="50" height="24" rx="12" fill={C.onyx} />
      <text x="37" y="24" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fontWeight="500" fill={C.cream}>Chat</text>
      <rect x="68" y="8" width="110" height="24" rx="12" fill={C.onyx} />
      <text x="123" y="24" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fontWeight="500" fill={C.cream}>Knowledge Base</text>
      <line x1="123" y1="36" x2="123" y2="44" stroke={C.mustard} strokeWidth="1" />
      <text x="123" y="52" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={C.mustard}>KB Editors only</text>
    </svg>
  );
}

function MockDosDonts() {
  return (
    <svg viewBox="0 0 520 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 520 }}>
      <rect width="520" height="240" rx="10" fill="white" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      {/* DO column */}
      <text x="20" y="28" fontFamily="sans-serif" fontSize="13" fontWeight="700" fill="#2d5a2d">DO</text>
      {["Use it on live calls", "Prep before conversations", "Draft Slack messages and emails", "Ask Freewyld-specific questions", "Use + Rep Notes for context"].map((t, i) => (
        <g key={t}><text x="20" y={52 + i * 22} fontFamily="sans-serif" fontSize="11" fill="#2d5a2d">&#10003;</text><text x="36" y={52 + i * 22} fontFamily="sans-serif" fontSize="11" fill="#333">{t}</text></g>
      ))}
      {/* Divider */}
      <line x1="260" y1="12" x2="260" y2="228" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      {/* DON'T column */}
      <text x="280" y="28" fontFamily="sans-serif" fontSize="13" fontWeight="700" fill="#8b2020">DON&apos;T</text>
      {["Find info on specific clients", "Make promises without verifying", "Share sensitive client PII", "Use for revenue/commission Qs", "Replace judgment on edge cases"].map((t, i) => (
        <g key={t}><text x="280" y={52 + i * 22} fontFamily="sans-serif" fontSize="11" fill="#8b2020">&#10007;</text><text x="296" y={52 + i * 22} fontFamily="sans-serif" fontSize="11" fill="#333">{t}</text></g>
      ))}
    </svg>
  );
}

function MockFlywheel() {
  const r = 120; const cx = 200; const cy = 160;
  const nodes = [
    { label: "Calls Happen", color: C.bark, angle: -90 },
    { label: "Transcripts Saved", color: C.olive, angle: -30 },
    { label: "Pipeline Runs", color: C.mustard, angle: 30 },
    { label: "KB Updated", color: C.bark, angle: 90 },
    { label: "Agents Refreshed", color: C.olive, angle: 150 },
    { label: "Prompt Rebuilt", color: C.mustard, angle: 210 },
  ];
  return (
    <svg viewBox="0 0 400 320" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 400 }}>
      {/* Center */}
      <circle cx={cx} cy={cy} r="36" fill={C.mustard} />
      <circle cx={cx} cy={cy} r="36" fill={C.bark} opacity="0.12" />
      <text x={cx} y={cy + 6} textAnchor="middle" fontFamily="Georgia, serif" fontSize="24" fontWeight="700" fill={C.olive}>W</text>
      {/* Orbit ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="1" strokeDasharray="4 4" />
      {/* Nodes */}
      {nodes.map((n, i) => {
        const rad = (n.angle * Math.PI) / 180;
        const nx = cx + r * Math.cos(rad);
        const ny = cy + r * Math.sin(rad);
        return (
          <g key={i}>
            <circle cx={nx} cy={ny} r="20" fill={n.color} />
            <text x={nx} y={ny + 3} textAnchor="middle" fontFamily="sans-serif" fontSize="6" fontWeight="600" fill="white">{(i + 1).toString()}</text>
            <text x={nx} y={ny + 30} textAnchor="middle" fontFamily="sans-serif" fontSize="8" fontWeight="600" fill="#333">{n.label}</text>
          </g>
        );
      })}
      {/* Clockwise arrow hint */}
      <path d={`M ${cx + 80} ${cy - 90} A 90 90 0 0 1 ${cx + 100} ${cy - 50}`} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" markerEnd="url(#arrowFW)" />
      <defs><marker id="arrowFW" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="rgba(0,0,0,0.15)" /></marker></defs>
    </svg>
  );
}

function MockAdminTable() {
  return (
    <svg viewBox="0 0 520 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 520 }}>
      <rect width="520" height="120" rx="10" fill="white" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      {/* Header */}
      <text x="16" y="24" fontFamily="sans-serif" fontSize="8" fontWeight="600" fill="#999" letterSpacing="1.5">NAME</text>
      <text x="130" y="24" fontFamily="sans-serif" fontSize="8" fontWeight="600" fill="#999" letterSpacing="1.5">EMAIL</text>
      <text x="300" y="24" fontFamily="sans-serif" fontSize="8" fontWeight="600" fill="#999" letterSpacing="1.5">ROLE</text>
      <text x="400" y="24" fontFamily="sans-serif" fontSize="8" fontWeight="600" fill="#999" letterSpacing="1.5">STATUS</text>
      <line x1="0" y1="32" x2="520" y2="32" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      {/* Row 1 */}
      <text x="16" y="52" fontFamily="sans-serif" fontSize="11" fontWeight="500" fill={C.onyx}>Kammie Melton</text>
      <text x="130" y="52" fontFamily="sans-serif" fontSize="10" fill="#555">kammie@freewyld.com</text>
      <rect x="300" y="40" width="48" height="18" rx="9" fill={C.olive} />
      <text x="324" y="52" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="600" fill={C.cream}>Admin</text>
      <rect x="400" y="40" width="48" height="18" rx="9" fill="#e8f0e8" />
      <text x="424" y="52" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="500" fill="#2d5a2d">Active</text>
      <text x="496" y="52" fontFamily="sans-serif" fontSize="14" fill="#999">&hellip;</text>
      <line x1="0" y1="64" x2="520" y2="64" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      {/* Row 2 */}
      <text x="16" y="84" fontFamily="sans-serif" fontSize="11" fontWeight="500" fill={C.onyx}>Mariano Garcia</text>
      <text x="130" y="84" fontFamily="sans-serif" fontSize="10" fill="#555">mariano@freewyld.com</text>
      <rect x="300" y="72" width="36" height="18" rx="9" fill="#f0ede6" />
      <text x="318" y="84" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="500" fill="#555">User</text>
      <rect x="400" y="72" width="48" height="18" rx="9" fill="#e8f0e8" />
      <text x="424" y="84" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="500" fill="#2d5a2d">Active</text>
      <text x="496" y="84" fontFamily="sans-serif" fontSize="14" fill="#999">&hellip;</text>
      <line x1="0" y1="96" x2="520" y2="96" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
    </svg>
  );
}

// ── Mockup wrapper ──
function Mockup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: "100%", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, background: "white", padding: 16, marginTop: 16, marginBottom: 8, overflow: "hidden" }}>
      {children}
    </div>
  );
}

// ── Section component ──
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id}>
      <h2 style={{ fontSize: 20, fontFamily: "Georgia, serif", fontWeight: 600, color: C.onyx, marginBottom: 8 }}>{title}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: "#333" }}>{children}</div>
      <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)", margin: "32px 0" }} />
    </section>
  );
}

function Sub({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}><strong style={{ color: C.onyx }}>{label}</strong><br />{children}</div>;
}

// ── Schedule table ──
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
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 16 }}>
      <thead>
        <tr style={{ background: C.olive, color: C.cream }}>
          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Time (PDT)</th>
          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Function</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([time, fn], i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? C.cream : "white" }}>
            <td style={{ padding: "8px 12px", color: "#555" }}>{time}</td>
            <td style={{ padding: "8px 12px", color: "#333" }}>{fn}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Main page ──
export default function GuidePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const userRole = (session?.user as Record<string, unknown>)?.role as string || "user";
  const isKb = userRole === "admin" || userRole === "knowledge_manager";
  const isAdminUser = userRole === "admin";
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/sign-in");
  }, [status, router]);

  // Track scroll position for active anchor
  useEffect(() => {
    function onScroll() {
      const sections = document.querySelectorAll("section[id]");
      let current = "";
      for (const s of sections) {
        const rect = s.getBoundingClientRect();
        if (rect.top <= 80) current = s.id;
      }
      setActiveSection(current);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center" style={{ background: C.cream }}><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: C.mustard, borderTopColor: "transparent" }} /></div>;

  const anchors = [
    { id: "getting-started", label: "Getting Started" },
    { id: "chat-modes", label: "Chat Modes" },
    { id: "client-strategy", label: "How Wyle Responds" },
    { id: "response-format", label: "Response Format" },
    { id: "using-chat", label: "Using the Chat" },
    { id: "dos-donts", label: "Do's and Don'ts" },
    { id: "file-uploads", label: "File Uploads" },
    { id: "chat-history", label: "Chat History" },
    { id: "profile", label: "Your Profile" },
    ...(isKb ? [
      { id: "knowledge-base", label: "Knowledge Base" },
      { id: "how-wyle-learns", label: "How Wyle Learns" },
    ] : []),
    ...(isAdminUser ? [
      { id: "managing-team", label: "Managing Your Team" },
    ] : []),
  ];

  return (
    <div className="min-h-screen" style={{ background: C.cream }}>
      {/* Back to app link */}
      <div style={{ padding: "12px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: C.olive, fontFamily: "var(--font-body)" }}>&larr; Back to Wyle</button>
      </div>

      {/* Sticky anchor nav */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: C.cream, borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "10px 24px", overflowX: "auto", whiteSpace: "nowrap" }}>
        {anchors.map((a, i) => (
          <span key={a.id}>
            {i > 0 && <span style={{ margin: "0 8px", color: "rgba(0,0,0,0.2)", fontSize: 11 }}>&middot;</span>}
            <a href={`#${a.id}`} style={{ fontSize: 13, color: activeSection === a.id ? C.mustard : C.olive, textDecoration: "none", borderBottom: activeSection === a.id ? `2px solid ${C.mustard}` : "2px solid transparent", paddingBottom: 2, transition: "all 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderBottomColor = C.mustard}
              onMouseLeave={e => { if (activeSection !== a.id) e.currentTarget.style.borderBottomColor = "transparent"; }}>
              {a.label}
            </a>
          </span>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px" }}>

        <Section id="getting-started" title="Getting Started">
          <p>Wyle is Freewyld Foundry&apos;s internal AI tool. Its purpose is to help you understand Freewyld&apos;s processes, protocols, promises, and positioning and communicate them clearly and confidently to clients.</p>
          <Sub label="Signing In">Sign in with your @freewyld.com Google account at wyle.freewyldfoundry.com. No password needed.</Sub>
          <Mockup><MockSignIn /></Mockup>
          <Sub label="Your first chat">Click + New Chat in the sidebar, select your mode, and start typing. Wyle responds immediately.</Sub>
          <Mockup><MockSidebar /></Mockup>
        </Section>

        <Section id="chat-modes" title="Chat Modes">
          <p>Select your mode based on your role and what you&apos;re working on. Each mode gives Wyle a different lens.</p>
          <Mockup><MockModeSelector /></Mockup>
          <Sub label="Sales Chat">For Mariano and Jaydon. Objection handling, FAQs, and drafting follow-ups for sales prospects.</Sub>
          <Sub label="Client Success Chat">For Felipe. Responding to existing clients via Slack and email. Billing questions, disputes, hospitality issues, and client communication.</Sub>
          <Sub label="Revenue Management Chat">For revenue managers. Presenting strategies and results, getting client buy-in, and handling pushback on recommendations.</Sub>
          <Sub label="Onboarding Chat">For Felipe. Walking new clients through the onboarding process, setting expectations, and pre-empting common concerns.</Sub>
        </Section>

        <Section id="client-strategy" title="Client Mode vs Strategy Mode">
          <p>The toggle at the top of the chat switches between two response styles.</p>
          <Mockup><MockToggle /></Mockup>
          <Sub label="Client Mode">Wyle responds with word-for-word scripts you can say directly to a client. Use this when you&apos;re on a call, in a Slack thread, or drafting a message.</Sub>
          <Sub label="Strategy Mode">Wyle responds with coaching, context, and internal analysis. Use this when you&apos;re preparing for a call or researching a topic.</Sub>
          <Sub label="Switching mid-conversation">Toggle at any time. Previous messages stay visible. New responses immediately follow the new mode&apos;s format. No disruption.</Sub>
        </Section>

        <Section id="response-format" title="How Wyle Responds">
          <p>Every response in Client Mode starts with a ready-to-use script followed by options to go deeper.</p>
          <Mockup><MockResponseBubble /></Mockup>
          <Sub label="The initial response">The first response is a concise 1-3 sentence script. Say it directly or adapt it.</Sub>
          <Sub label="+ More Detail">2-5 additional sentences expanding on the initial response. Still client-facing.</Sub>
          <Sub label="+ Full Script">A longer word-for-word script covering the topic in full depth.</Sub>
          <Sub label="+ Rep Notes">Internal context, coaching notes, and background for your eyes only.</Sub>
          <Sub label="Expand All">Loads all three sections at once below the initial response in the order they load.</Sub>
          <Sub label="Draft buttons">Generates a ready-to-send draft based on the visible response. Appears as a new message in the chat.</Sub>
          <Mockup><MockDraftBubble /></Mockup>
        </Section>

        <Section id="using-chat" title="Using the Chat">
          <Sub label="What Wyle is for">Use Wyle to understand and communicate Freewyld&apos;s processes, protocols, promises, pricing, guarantees, and positioning. Whether you&apos;re handling an objection, answering a client question, drafting a follow-up, or preparing for a call, Wyle knows Freewyld and helps you communicate it well.</Sub>
          <Sub label="What Wyle is not for (right now)">Wyle does not have context on specific clients, their revenue, or their portfolio performance. Do not use it for anything related to revenue reporting, commissions, or team payouts. Do not rely on it for real-time market data.</Sub>
          <Sub label="How to ask good questions">Be specific to Freewyld. Instead of &quot;how do I handle a pricing objection&quot; ask &quot;how do I handle a prospect who says our fee is too expensive.&quot; Wyle assumes every question is about Freewyld.</Sub>
          <Sub label="Switching modes mid-conversation">Use the mode selector in the bottom left. If you switch chat modes (e.g. Sales to Client Success), you&apos;ll be asked whether to start fresh or bring your conversation along.</Sub>
          <Mockup><MockModeSwitchCard /></Mockup>
        </Section>

        <Section id="dos-donts" title="Do's and Don'ts">
          <Mockup><MockDosDonts /></Mockup>
        </Section>

        <Section id="file-uploads" title="File Uploads">
          <Sub label="Supported file types">Images (JPG, PNG, GIF, WebP), PDFs, and text files (TXT, MD, CSV).</Sub>
          <Sub label="Size limits">10MB per file. Maximum 10 files at once.</Sub>
          <Sub label="How it works">Attach a file using the paperclip icon next to the input. Wyle reads the content and includes it in your conversation. Use this to share a client email, a contract excerpt, or any document you want Wyle to reference.</Sub>
          <Mockup><MockFileUpload /></Mockup>
          <Sub label="Limitations">Files are read into the conversation context, not stored permanently. Large PDFs may be truncated. Images are analyzed visually.</Sub>
        </Section>

        <Section id="chat-history" title="Chat History">
          <p>All conversations are saved automatically. Access them anytime from the sidebar.</p>
          <Sub label="Finding a conversation">Conversations are grouped by date: Today, Yesterday, Last 7 days, Last 30 days, Older. Click any conversation to resume it.</Sub>
          <Mockup><MockConversationList /></Mockup>
          <Sub label="Searching">Use the search bar at the top of the sidebar to search by title or message content.</Sub>
          <Sub label="Renaming, Pinning, Deleting">Hover over a conversation to see the pencil (rename), pin, and trash icons.</Sub>
          <Mockup><MockConvActions /></Mockup>
        </Section>

        <Section id="profile" title="Your Profile">
          <p>Click your name at the bottom of the sidebar to access your profile and settings.</p>
          <Mockup><MockProfileRow /></Mockup>
          <Sub label="Default mode">Set which chat mode opens by default when you start a new chat.</Sub>
          <Sub label="Default view">Set whether new chats open in Client Mode or Strategy Mode by default.</Sub>
          <Mockup><MockProfilePopover /></Mockup>
        </Section>

        {/* Knowledge Manager + Admin sections */}
        {isKb && (
          <>
            <Section id="knowledge-base" title="Managing the Knowledge Base">
              <p>The Knowledge Base is what Wyle knows. It contains source documents, call insights, agent definitions, and skill files. You can view and edit all of it.</p>
              <Sub label="Accessing the KB editor">Click &quot;Knowledge Base&quot; in the top navigation. Only Knowledge Managers and Admins can access this.</Sub>
              <Mockup><MockKBNav /></Mockup>
              <Sub label="Browsing files">The left sidebar lists all KB files organized by type. Click any file to view and edit its contents.</Sub>
              <Sub label="Editing a file directly">Click into the content area on the right to edit any file. Changes are saved when you click Save.</Sub>
              <Sub label="Chat-to-edit">Use the chat panel below the file content to describe changes in plain language. Wyle will suggest edits using track changes. Review and accept or reject each change.</Sub>
              <Sub label="Update Wyle&apos;s Knowledge">After making changes, click &quot;Update Wyle&apos;s Knowledge&quot; to recompile the master prompt. Wyle will have updated knowledge within 60 seconds.</Sub>
            </Section>

            <Section id="how-wyle-learns" title="How Wyle Learns">
              <p>Wyle gets smarter every week automatically. Two input streams feed into the knowledge base: live call transcripts and source documents. Both are processed, synthesized, and compiled into Wyle&apos;s master prompt every Monday morning.</p>
              <Mockup><MockFlywheel /></Mockup>
              <div style={{ marginTop: 16 }}>
                <Sub label="The weekly cycle">Six automated pipelines run every Monday between 1 AM and 6 AM PDT:</Sub>
                <ScheduleTable />
              </div>
              <p style={{ marginTop: 16, fontSize: 14, color: "#666", fontStyle: "italic" }}>Manual updates via the KB editor take effect immediately after clicking &quot;Update Wyle&apos;s Knowledge&quot;. No need to wait for the weekly cycle.</p>
            </Section>
          </>
        )}

        {/* Admin-only section */}
        {isAdminUser && (
          <Section id="managing-team" title="Managing Your Team">
            <p>Access the admin panel from your profile menu at the bottom of the sidebar.</p>
            <Mockup><MockAdminTable /></Mockup>
            <Sub label="Adding a user">Click &quot;+ Add User&quot;, fill in their name, email, role, and default settings. After adding, share the Wyle URL with them via Slack. They sign in with their @freewyld.com Google account. No password needed.</Sub>
            <Sub label="Roles">Three roles are available:</Sub>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <div style={{ flex: "1 1 140px", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", background: "white" }}>
                <span style={{ display: "inline-block", fontSize: 12, padding: "3px 10px", borderRadius: 12, background: C.olive, color: C.cream, fontWeight: 600, marginBottom: 6 }}>Admin</span>
                <div style={{ fontSize: 13, color: "#555" }}>Full access including admin panel and KB editor</div>
              </div>
              <div style={{ flex: "1 1 140px", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", background: "white" }}>
                <span style={{ display: "inline-block", fontSize: 12, padding: "3px 10px", borderRadius: 12, background: C.mustard, color: C.onyx, fontWeight: 600, marginBottom: 6 }}>Knowledge Manager</span>
                <div style={{ fontSize: 13, color: "#555" }}>Chat + KB editor access. Cannot manage users.</div>
              </div>
              <div style={{ flex: "1 1 140px", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", background: "white" }}>
                <span style={{ display: "inline-block", fontSize: 12, padding: "3px 10px", borderRadius: 12, background: "#f0ede6", color: "#555", fontWeight: 600, marginBottom: 6 }}>User</span>
                <div style={{ fontSize: 13, color: "#555" }}>Chat access only.</div>
              </div>
            </div>
            <Sub label="Suspending a user">Click the three dots next to a user, then Suspend. They are immediately signed out and cannot sign back in. Their conversation history is preserved.</Sub>
            <Sub label="Changing a user&apos;s role">Click the role dropdown inline in the user table and select a new role. Takes effect immediately.</Sub>
            <Sub label="Revoking sessions">Click the three dots, then Revoke Sessions to sign a user out of all devices without suspending their account.</Sub>
            <Sub label="Deleting a user">Click the three dots, then Delete User. This is permanent and removes their account. Their conversation history remains in the database.</Sub>
          </Section>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "24px 0 48px", fontSize: 13, color: "rgba(0,0,0,0.3)" }}>
          Wyle User Guide &middot; Freewyld Foundry
        </div>
      </div>
    </div>
  );
}
