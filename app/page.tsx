"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import GuideContent from "./guide/GuideContent";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const cleanText = text.replace(/\[\[EXPAND_PROMPT\]\]/g, "").replace(/\[\[CLARIFY\]\][\s\S]*/g, "").replace(/^#{2,4}\s+\S+.*$/gm, "").replace(/^---+$/gm, "").replace(/\u2014/g, " ").replace(/\u2013/g, " ").replace(/ {2,}/g, " ").trim();
  return (
    <div style={{ position: "relative" }}>
      {copied && (
        <div style={{ position: "absolute", bottom: "calc(100% + 4px)", right: 0, background: "#3c3b22", color: "#f8f6ee", fontSize: 11, borderRadius: 4, padding: "3px 8px", whiteSpace: "nowrap", pointerEvents: "none", animation: "fadeIn 0.15s ease" }}>
          Copied!
        </div>
      )}
      <button onClick={() => { navigator.clipboard.writeText(cleanText); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        aria-label="Copy message to clipboard"
        className="copy-icon-btn"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "rgba(0,0,0,0.25)", transition: "color 150ms ease", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
        onMouseEnter={e => e.currentTarget.style.color = "#CC8A39"}
        onMouseLeave={e => { if (!copied) e.currentTarget.style.color = "rgba(0,0,0,0.25)"; }}>
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} style={{ width: 16, height: 16 }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
      </button>
    </div>
  );
}

function Spinner({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return <svg className="animate-spin" style={{ width: size, height: size }} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" opacity="0.25" />
    <path d="M12 2a10 10 0 019.95 9" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </svg>;
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: string; data: string } };
interface Message { role: "user" | "assistant"; content: string | ContentBlock[]; interactionMode?: InteractionMode; draftLabel?: string; mode?: ChatMode; isDivider?: boolean; isError?: boolean }
interface PendingFile { name: string; base64: string; mediaType: string; preview: string | null; fileType: "image" | "pdf" | "text" }
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const ACCEPTED_TYPES = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.md,.csv";
interface KbFile { id: string; name: string; modifiedDate: string }
interface LogEntry { timestamp: string; trigger: string }
interface EditChatMsg { role: "user" | "assistant"; text: string }

type Tab = "chat" | "kb" | "guide";
type ChatMode = "sales" | "client-success" | "fulfillment" | "onboarding";
type InteractionMode = "client" | "research";

interface Conversation {
  id: string;
  title: string;
  mode: string;
  interaction_type: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

const MODE_BADGES: Record<string, { bg: string; label: string }> = {
  sales: { bg: "#663925", label: "S" },
  "client-success": { bg: "#3c3b22", label: "CS" },
  fulfillment: { bg: "rgba(204,138,57,0.6)", label: "RM" },
  onboarding: { bg: "rgba(102,57,37,0.6)", label: "O" },
};

function groupByDate(convs: Conversation[]): { label: string; items: Conversation[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const week = new Date(today.getTime() - 7 * 86400000);
  const month = new Date(today.getTime() - 30 * 86400000);
  const pinned = convs.filter(c => c.pinned);
  const unpinned = convs.filter(c => !c.pinned);
  const groups: { label: string; items: Conversation[] }[] = [];
  if (pinned.length) groups.push({ label: "Pinned", items: pinned });
  const buckets: [string, Conversation[]][] = [["Today", []], ["Yesterday", []], ["Last 7 days", []], ["Last 30 days", []], ["Older", []]];
  for (const c of unpinned) {
    const d = new Date(c.updated_at);
    if (d >= today) buckets[0][1].push(c);
    else if (d >= yesterday) buckets[1][1].push(c);
    else if (d >= week) buckets[2][1].push(c);
    else if (d >= month) buckets[3][1].push(c);
    else buckets[4][1].push(c);
  }
  for (const [label, items] of buckets) { if (items.length) groups.push({ label, items }); }
  return groups;
}

const MODE_LABELS: Record<ChatMode, string> = {
  sales: "Sales",
  "client-success": "Client Success",
  fulfillment: "Revenue Management",
  onboarding: "Onboarding",
};

interface QuestionGroup { label: string; items: string[] }
type GroupedQuestions = Record<ChatMode, QuestionGroup[]>;

const MODE_QUESTIONS: GroupedQuestions = {
  sales: [
    { label: "OBJECTIONS", items: [
      "Fee is too expensive", "Already have a revenue manager", "Need to think about it",
      "Not the right time", "Tried revenue management before", "Want to manage pricing ourselves", "Concerned about contract length",
    ]},
    { label: "FAQS", items: [
      "How the fee is calculated", "How the guarantee works", "What's included vs not included",
      "How we measure results", "What the onboarding process looks like", "How long before we see results",
    ]},
  ],
  "client-success": [
    { label: "COMMON CLIENT SITUATIONS", items: [
      "Client asking about their invoice", "Client disputing a charge", "Client frustrated with results",
      "Client asking why rates are lower than expected", "Client wants to override our pricing",
      "Client asking about a competitor's performance", "Client requesting an urgent call", "Unreasonable hospitality situation",
    ]},
  ],
  fulfillment: [
    { label: "STRATEGY AND CLIENT COMMUNICATION", items: [
      "Presenting a pricing strategy change", "Explaining a down month to a client", "Getting buy-in on MNS adjustments",
      "Presenting monthly results", "Handling pushback on recommendations", "Explaining OTA optimization decisions",
      "Building client confidence in our approach", "Communicating a market shift",
    ]},
  ],
  onboarding: [
    { label: "ONBOARDING PROCESS AND SITUATIONS", items: [
      "Walking through fee calculation", "Explaining the billing process", "Setting up onboarding calls",
      "Setting revenue expectations", "Client asking when they'll see results", "Explaining what access we need",
      "Pre-empting pricing concerns", "Explaining the guarantee at onboarding",
    ]},
  ],
};

// ── Structured response parsing ──

interface ParsedSection { key: string; label: string; content: string }
interface ParsedResponse { sections: ParsedSection[]; clarify: { question: string; options: string[] } | null; raw: string; hasStructure: boolean; hadExpandToken: boolean }

const SECTION_HEADERS = ["SIMPLE", "MORE DETAIL", "FULL SCRIPT", "REP NOTES", "DEEPER", "DEEPEST", "INTERNAL FULL PICTURE", "INTERNAL", "STRATEGY", "ANSWER TO CLIENT", "PROBLEM", "OPTIONS", "RECOMMENDATION"];
const EXPAND_ORDER = ["MORE DETAIL", "FULL SCRIPT", "REP NOTES"];
// Map old names to new for backwards compat
const SECTION_RENAME: Record<string, string> = { "DEEPER": "MORE DETAIL", "DEEPEST": "FULL SCRIPT", "INTERNAL FULL PICTURE": "REP NOTES", "INTERNAL": "REP NOTES" };
const SECTION_DISPLAY: Record<string, string> = { "SIMPLE": "SIMPLE", "MORE DETAIL": "MORE DETAIL", "FULL SCRIPT": "FULL SCRIPT", "REP NOTES": "REP NOTES", "DEEPER": "MORE DETAIL", "DEEPEST": "FULL SCRIPT", "INTERNAL FULL PICTURE": "REP NOTES", "INTERNAL": "REP NOTES", "STRATEGY": "STRATEGY", "ANSWER TO CLIENT": "ANSWER TO CLIENT", "PROBLEM": "PROBLEM", "OPTIONS": "OPTIONS", "RECOMMENDATION": "RECOMMENDATION" };

function parseResponse(text: string): ParsedResponse {
  // Detect expand token before stripping
  const hadExpandToken = text.includes("[[EXPAND_PROMPT]]");
  // Strip tokens that should never render
  let raw = text.replace(/\[\[EXPAND_PROMPT\]\]/g, "").trim();
  let clarify: ParsedResponse["clarify"] = null;

  const clarifyIdx = raw.indexOf("[[CLARIFY]]");
  if (clarifyIdx !== -1) {
    const clarifyBlock = raw.substring(clarifyIdx + 11).trim();
    raw = raw.substring(0, clarifyIdx).trim();
    const lines = clarifyBlock.split("\n").map(l => l.trim()).filter(Boolean);
    const question = lines[0] || "Clarification needed";
    const options = lines.slice(1).map(l => l.replace(/^[-•*]\s*/, "").replace(/^\d+[.)]\s*/, ""));
    clarify = { question, options };
  }

  const sections: ParsedSection[] = [];
  // Match ## headers — both old (DEEPER/DEEPEST/INTERNAL) and new (MORE DETAIL/FULL SCRIPT/REP NOTES)
  const sectionNames = "SIMPLE|MORE DETAIL|FULL SCRIPT|REP NOTES|DEEPER|DEEPEST|INTERNAL FULL PICTURE|INTERNAL|STRATEGY|ANSWER TO CLIENT|PROBLEM|OPTIONS|RECOMMENDATION";
  const headerPattern = new RegExp("^(?:#{2,4}\\s+|\\*\\*)?(" + sectionNames + ")(?:\\*\\*)?\\s*$", "gm");
  const matches: { key: string; index: number; fullMatch: string }[] = [];
  let m;
  while ((m = headerPattern.exec(raw)) !== null) {
    const key = SECTION_RENAME[m[1]] || m[1]; // Normalize old names to new
    matches.push({ key, index: m.index, fullMatch: m[0] });
  }

  if (matches.length === 0) {
    // No structured sections found — treat entire response as SIMPLE
    return { sections: [{ key: "SIMPLE", label: "SIMPLE", content: raw }], clarify, raw, hasStructure: false, hadExpandToken };
  }

  for (let j = 0; j < matches.length; j++) {
    const headerEnd = matches[j].index + matches[j].fullMatch.length;
    const contentStart = raw.indexOf("\n", headerEnd);
    const start = contentStart !== -1 ? contentStart + 1 : headerEnd;
    const end = j + 1 < matches.length ? matches[j + 1].index : raw.length;
    const content = raw.substring(start, end).trim();
    if (content) {
      sections.push({ key: matches[j].key, label: matches[j].key === "INTERNAL FULL PICTURE" ? "INTERNAL" : matches[j].key, content });
    }
  }

  return { sections, clarify, raw, hasStructure: sections.length > 0, hadExpandToken };
}

const MODE_ACTIONS: Record<ChatMode, string[]> = {
  sales: ["Draft Text", "Draft Email", "Draft Voicemail"],
  "client-success": ["Draft Slack Message", "Draft Email"],
  fulfillment: ["Draft Slack Message", "Draft Email"],
  onboarding: ["Draft Slack Message", "Draft Email"],
};

function AssistantMessage({ text, msgIdx, isStreaming, chatMode, msgInteractionMode, draftLabel, isError, onRetry, inlineExpanded, sectionOrder, expandLoading, expandingAll, onExpand, onExpandAll, onDraft, handleClarifyOption, clarifyInput, setClarifyInput }: {
  text: string; msgIdx: number; isStreaming: boolean; chatMode: ChatMode; msgInteractionMode: InteractionMode; draftLabel?: string; isError?: boolean; onRetry?: () => void;
  inlineExpanded: Record<string, string>; sectionOrder: string[]; expandLoading: string | undefined; expandingAll: boolean;
  onExpand: (section: string) => void; onExpandAll: () => void; onDraft: (action: string) => void;
  handleClarifyOption: (opt: string) => void;
  clarifyInput: string; setClarifyInput: (v: string) => void;
}) {
  const isResearch = msgInteractionMode === "research";
  const isDraft = !!draftLabel && (draftLabel.startsWith("Draft") || draftLabel === "Slack Draft");
  const isRecontextualize = draftLabel === "recontextualize";
  const isStrategyToClient = draftLabel === "strategy-to-client";

  // For recontextualize messages, split on --- divider ONLY after streaming completes
  let recontextPreamble = "";
  let mainText = text;
  if (isRecontextualize && !isStreaming && text) {
    const dividerMatch = text.match(/^([\s\S]*?)\n---+\n([\s\S]*)$/);
    if (dividerMatch) {
      recontextPreamble = dividerMatch[1].trim();
      mainText = dividerMatch[2].trim();
    }
  }

  const parsed = parseResponse(isStreaming && isRecontextualize ? "" : mainText);
  const showPills = !isStreaming && !isDraft && (parsed.hasStructure || parsed.hadExpandToken || isStrategyToClient);

  // Clean content: strip "---" horizontal rules and meta-commentary
  function clean(s: string) {
    let cleaned = s.replace(/^#{2,4}\s+(SIMPLE|MORE DETAIL|FULL SCRIPT|REP NOTES|DEEPER|DEEPEST|INTERNAL FULL PICTURE|INTERNAL|STRATEGY|ANSWER TO CLIENT|PROBLEM|OPTIONS|RECOMMENDATION)\s*$/gm, "").replace(/^\*\*(SIMPLE|MORE DETAIL|FULL SCRIPT|REP NOTES|DEEPER|DEEPEST|INTERNAL)\*\*\s*$/gm, "").replace(/^---+$/gm, "").replace(/\u2014/g, " ").replace(/\u2013/g, " ").replace(/ {2,}/g, " ").replace(/^- /gm, "").trim();
    // Strip meta-commentary
    cleaned = cleaned.replace(/^Here is the\s+(?:MORE DETAIL|FULL SCRIPT|REP NOTES|SIMPLE|DEEPER|DEEPEST|INTERNAL)[^.\n]*(?:section|response)[^.\n]*\.?\s*\n*/i, "").replace(/^Here is the\s+[^.\n]*\s+section\s+as\s+requested[^.\n]*\.?\s*\n*/i, "").replace(/^\n+/, "").trim();
    return cleaned;
  }

  // Get SIMPLE content (first section or entire text)
  const simpleContent = clean(parsed.sections[0]?.content || mainText);

  // Render sections in click order (sectionOrder), not preset order
  const expandedKeys = Object.keys(inlineExpanded);
  // Build render order: use sectionOrder for revealed, then include loading key if not already in order
  const renderOrder = [...sectionOrder];
  if (expandLoading && !renderOrder.includes(expandLoading)) renderOrder.push(expandLoading);
  const allExpandKeys = isResearch ? ["MORE DETAIL", "FULL SCRIPT"] : ["MORE DETAIL", "FULL SCRIPT", "REP NOTES"];
  const availablePills = allExpandKeys.filter(k => !expandedKeys.includes(k) && k !== expandLoading);

  return (
    <div className="flex gap-3" style={{ maxWidth: "100%" }}>
      <div className={`shrink-0 mt-0.5 ${isStreaming ? "avatar-streaming" : ""}`} style={{ width: 40, height: 40 }}>
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: 40, height: 40 }} aria-label="Wyle" role="img">
          <rect width="100" height="100" rx="20" fill="#CC8A39"/><rect width="100" height="100" rx="20" fill="#663925" opacity="0.12"/>
          <text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="58" fontWeight="700" fill="#3c3b22">W</text>
          <text x="50" y="84" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fontWeight="600" fill="#3c3b22" letterSpacing="3" opacity="0.85">WYLE</text>
        </svg>
      </div>
      <div className="msg-bubble-assistant group/msg" style={{ overflow: "visible", minWidth: 0, position: "relative", paddingRight: 44 }}>
        {/* Copy button — positioned top right */}
        {!isStreaming && simpleContent && (
          <div className="copy-icon-wrap" style={{ position: "absolute", top: 12, right: 12, zIndex: 2, opacity: 0, transition: "opacity 150ms ease" }}>
            <CopyButton text={[simpleContent, ...Object.values(inlineExpanded)].join("\n\n")} />
          </div>
        )}
        {/* Label row: INTERNAL badge and/or Draft label (not for recontextualize) */}
        {(isResearch || (isDraft && !isRecontextualize)) && (
          <div className="flex items-center gap-2 px-4 pt-2.5 pb-0">
            {isResearch && <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 10, background: "#3c3b22", color: "#f8f6ee", fontWeight: 600 }}>INTERNAL</span>}
            {isDraft && !isRecontextualize && <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 10, background: "rgba(22,22,22,0.06)", color: "var(--text-muted)", fontWeight: 600 }}>{draftLabel}</span>}
          </div>
        )}
        <div className="py-3" style={{ paddingLeft: 20, paddingRight: 0, paddingTop: isResearch || (isDraft && !isRecontextualize) ? 8 : undefined }}>
          {/* Error state */}
          {isError ? (
            <div role="alert" className="flex items-center gap-3">
              <span className="text-sm" style={{ color: "#b91c1c" }}>{simpleContent}</span>
              {onRetry && <button onClick={onRetry} className="text-xs font-semibold px-3 py-1.5" style={{ borderRadius: 6, background: "transparent", border: "1px solid #b91c1c", color: "#b91c1c", cursor: "pointer" }}>Retry</button>}
            </div>
          ) : (
            <>
              {/* Recontextualize preamble — plain text before the SIMPLE response */}
              {isRecontextualize && recontextPreamble && (
                <>
                  <div className="msg-content whitespace-pre-wrap" style={{ fontSize: 16, color: "var(--color-onyx)" }}>{recontextPreamble}</div>
                  <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)", margin: "14px 0" }} />
                </>
              )}
              {/* SIMPLE / base content */}
              <div className="msg-content whitespace-pre-wrap">{simpleContent}</div>
              {isStreaming && (simpleContent ? <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded" style={{ background: "var(--color-mustard)" }} /> : <span className="inline-flex gap-1 py-1" aria-label="Wyle is thinking" aria-busy="true"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></span>)}
            </>
          )}

          {!isError && <>
          {/* Inline expanded sections — rendered in click order */}
          {renderOrder.map(k => {
            const content = inlineExpanded[k];
            if (!content && k !== expandLoading) return null;
            return (
              <div key={k} className="section-divider">
                <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, color: "var(--color-mustard)", marginBottom: 8 }}>
                  {SECTION_DISPLAY[k] || k}
                </div>
                {content ? (
                  <div className="msg-content whitespace-pre-wrap" style={{ marginTop: 0 }}>{clean(content)}</div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-mustard)" }}>
                    <Spinner size={12} color="var(--color-mustard)" />
                    Loading...
                  </div>
                )}
              </div>
            );
          })}

          {/* Expand links */}
          {showPills && availablePills.length > 0 && !expandLoading && !expandingAll && (
            <div className="flex flex-wrap items-center mt-3" style={{ gap: 16 }}>
              {availablePills.map(k => (
                <button key={k} onClick={() => onExpand(k)}
                  style={{ background: "none", border: "none", padding: 0, fontSize: 14, color: "#3c3b22", cursor: "pointer", fontFamily: "var(--font-body)", textDecoration: "none" }}
                  onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                  + {k === "REP NOTES" ? "Rep Notes" : k === "MORE DETAIL" ? "More Detail" : k === "FULL SCRIPT" ? "Full Script" : k.charAt(0) + k.slice(1).toLowerCase()}
                </button>
              ))}
              {availablePills.length > 1 && (
                <>
                  <span style={{ color: "rgba(60,59,34,0.3)", fontSize: 13 }}>&middot;</span>
                  <button onClick={onExpandAll}
                    style={{ background: "none", border: "none", padding: 0, fontSize: 14, color: "#3c3b22", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 600, textDecoration: "none" }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                    Expand All
                  </button>
                </>
              )}
            </div>
          )}

          {/* Loading indicator */}
          {(expandLoading || expandingAll) && (
            <div className="flex flex-wrap items-center mt-3" style={{ gap: 16 }}>
              {expandLoading && (
                <span style={{ fontSize: 13, color: "rgba(60,59,34,0.4)", fontFamily: "var(--font-body)" }}>
                  + {expandLoading === "INTERNAL FULL PICTURE" ? "Internal" : expandLoading.charAt(0) + expandLoading.slice(1).toLowerCase()}...
                </span>
              )}
              {availablePills.filter(k => k !== expandLoading).map(k => (
                <span key={k} style={{ fontSize: 13, color: "rgba(60,59,34,0.3)", fontFamily: "var(--font-body)" }}>
                  + {k === "REP NOTES" ? "Rep Notes" : k === "MORE DETAIL" ? "More Detail" : k === "FULL SCRIPT" ? "Full Script" : k.charAt(0) + k.slice(1).toLowerCase()}
                </span>
              ))}
              {expandingAll && !expandLoading && (
                <span style={{ fontSize: 13, color: "rgba(60,59,34,0.4)", fontFamily: "var(--font-body)" }}>Expanding all...</span>
              )}
            </div>
          )}

          {/* Action buttons */}
          {showPills && !expandLoading && (
            <div className="flex flex-wrap mt-2" style={{ gap: isResearch && !isStrategyToClient ? 16 : 8 }}>
              {isResearch && !isStrategyToClient ? (
                <button onClick={() => onDraft("Draft Slack to Team")}
                  style={{ background: "none", border: "none", padding: 0, fontSize: 14, color: "#3c3b22", cursor: "pointer", fontFamily: "var(--font-body)", textDecoration: "none" }}
                  onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                  Draft Slack to Team
                </button>
              ) : (
                MODE_ACTIONS[chatMode].map(action => (
                  <button key={action} onClick={() => onDraft(action)}
                    style={{ borderRadius: 20, background: "#663925", border: "none", color: "#f8f6ee", padding: "6px 16px", fontSize: 14, cursor: "pointer", fontFamily: "var(--font-body)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(102,57,37,0.85)"}
                    onMouseLeave={e => e.currentTarget.style.background = "#663925"}>
                    {action}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Clarify block */}
          {!isStreaming && parsed.clarify && (
            <div className="mt-3 p-3 rounded-lg" style={{ borderLeft: "3px solid var(--color-olive)", background: "rgba(60,59,34,0.04)" }}>
              <div className="text-xs font-semibold mb-1.5" style={{ color: "var(--color-olive)" }}>Clarification Needed</div>
              <div className="text-xs mb-2">{parsed.clarify.question}</div>
              <div className="flex flex-wrap gap-1.5">
                {parsed.clarify.options.map((opt, oi) => (
                  <button key={oi} onClick={() => handleClarifyOption(opt)} className="px-2.5 py-1 text-xs font-medium transition-all"
                    style={{ borderRadius: "14px", background: "transparent", border: "1px solid var(--color-olive)", color: "var(--color-olive)", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(60,59,34,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    {opt}
                  </button>
                ))}
                <div className="flex gap-1 w-full mt-1">
                  <input className="flex-1 px-2 py-1 text-xs focus:outline-none" placeholder="Custom answer..."
                    style={{ borderRadius: "6px", border: "1px solid rgba(22,22,22,0.1)", background: "var(--color-cream)", color: "var(--color-onyx)" }}
                    value={clarifyInput} onChange={e => setClarifyInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && clarifyInput.trim()) { handleClarifyOption(clarifyInput.trim()); setClarifyInput(""); } }} />
                  <button onClick={() => { if (clarifyInput.trim()) { handleClarifyOption(clarifyInput.trim()); setClarifyInput(""); } }} className="px-2 py-1 text-xs font-semibold"
                    style={{ borderRadius: "6px", background: "var(--color-olive)", color: "var(--color-cream)", border: "none", cursor: "pointer" }}>Send</button>
                </div>
              </div>
            </div>
          )}
          </>}
        </div>
      </div>
    </div>
  );
}

const RESEARCH_QUESTIONS: GroupedQuestions = {
  sales: [
    { label: "OBJECTIONS", items: [
      "Handling the fee objection", "Handling the existing manager objection", "Handling the timing objection",
      "Handling the trust objection", "Handling the contract length objection", "When to walk away from a deal",
    ]},
    { label: "FAQS", items: [
      "Full fee calculation methodology", "Guarantee mechanics and limits", "What is and isn't included in RPM",
      "How we calculate revenue uplift", "Our ideal client profile", "Competitive positioning vs alternatives",
    ]},
  ],
  "client-success": [
    { label: "COMMON CLIENT SITUATIONS", items: [
      "How to handle a billing dispute", "How to respond to a frustrated client", "Escalation process for unhappy clients",
      "How to handle a pricing override request", "What to do when results are underperforming",
      "How to respond to unreasonable requests", "Early warning signs a client may churn",
    ]},
  ],
  fulfillment: [
    { label: "STRATEGY AND CLIENT COMMUNICATION", items: [
      "Technical reasoning behind MNS strategy", "How to build the case for a rate change",
      "Analyzing a portfolio's underperformance", "OTA algorithm optimization approach",
      "How to present data to a skeptical client", "Market conditions affecting current strategy", "When to escalate a client situation",
    ]},
  ],
  onboarding: [
    { label: "ONBOARDING PROCESS AND SITUATIONS", items: [
      "Step by step onboarding process", "How to pre-empt common onboarding objections",
      "What to accomplish in the first 30 days", "How fee calculation is explained to new clients",
      "What access to request and why", "How to handle a client who is impatient early", "Setting the right expectations at kickoff",
    ]},
  ],
};

function renderDiff(raw: string): string {
  let html = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/\[\[DEL\]\]([\s\S]*?)\[\[\/DEL\]\]/g,
    '<span style="background:rgba(180,30,30,0.12);color:#b91c1c;text-decoration:line-through;border-radius:2px;padding:0 2px">$1</span>');
  html = html.replace(/\[\[ADD\]\]([\s\S]*?)\[\[\/ADD\]\]/g,
    '<span style="background:rgba(60,59,34,0.15);color:#3c3b22;border-radius:2px;padding:0 2px">$1</span>');
  return html;
}

export default function Home() {
  const { data: session, status } = useSession();
  const userRole = (session?.user as Record<string, unknown> | undefined)?.role;
  const isAdminUser = userRole === "admin";
  const isKbUser = userRole === "admin" || userRole === "knowledge_manager";
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchCurrentX = useRef<number | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [modeSwitchPrompt, setModeSwitchPrompt] = useState<ChatMode | null>(null);
  const [confirmDeleteConv, setConfirmDeleteConv] = useState<string | null>(null);
  const [convLoading, setConvLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [chatMode, setChatMode] = useState<ChatMode>("sales");
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("client");
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const streamingConvRef = useRef<string | null>(null); // which conversation is currently streaming
  const activeConvRef = useRef<string | null>(null); // tracks activeConvId for use in async callbacks
  const [bgStreaming, setBgStreaming] = useState<Set<string>>(new Set()); // conversations streaming in background
  const streamThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null); // throttle stream UI updates
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  // Per-message inline expanded sections: msgIndex -> { sectionKey: content }
  const [inlineExpanded, setInlineExpanded] = useState<Record<number, Record<string, string>>>({});
  // Per-message ordered list of revealed section keys (click order)
  const [expandOrder, setExpandOrder] = useState<Record<number, string[]>>({});
  const [expandLoading, setExpandLoading] = useState<Record<number, string>>({}); // msgIndex -> currently loading section key
  const [expandingAll, setExpandingAll] = useState<Record<number, boolean>>({}); // msgIndex -> expanding all in progress
  const [clarifyInput, setClarifyInput] = useState("");
  const [kbFiles, setKbFiles] = useState<KbFile[]>([]);
  const [kbFilesLoading, setKbFilesLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<KbFile | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorOriginal, setEditorOriginal] = useState("");
  const [editorLoading, setEditorLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmRewrite, setConfirmRewrite] = useState(false);
  const [forceRewriteConfirm, setForceRewriteConfirm] = useState(false);
  const [kbAddText, setKbAddText] = useState("");
  const [kbAdding, setKbAdding] = useState(false);
  const [kbAddConfirmRewrite, setKbAddConfirmRewrite] = useState(false);
  const [editChatInput, setEditChatInput] = useState("");
  const [editChatHistory, setEditChatHistory] = useState<EditChatMsg[]>([]);
  const [editStreaming, setEditStreaming] = useState(false);
  const editChatEndRef = useRef<HTMLDivElement>(null);
  const [pendingDiff, setPendingDiff] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load user preferences on mount + handle ?tab= URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "guide" || tabParam === "kb" || tabParam === "chat") setActiveTab(tabParam);
    fetch("/api/user-preferences").then(r => r.json()).then(data => {
      if (data.default_mode && ["sales", "client-success", "fulfillment", "onboarding"].includes(data.default_mode)) setChatMode(data.default_mode as ChatMode);
      if (data.default_interaction && ["client", "research"].includes(data.default_interaction)) setInteractionMode(data.default_interaction as InteractionMode);
    }).catch(() => {});
    // Load conversations
    loadConversations();
  }, []);

  async function loadConversations() {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch { /* ignore */ }
  }

  async function createNewChat() {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: chatMode, interaction_type: interactionMode }),
      });
      const data = await res.json();
      setActiveConvId(data.conversation.id);
      setMessages([]);
      setInlineExpanded({});
      setExpandOrder({});
      setExpandLoading({});
      setExpandingAll({});
      loadConversations();
    } catch { /* ignore */ }
  }

  async function loadConversation(id: string) {
    setConvLoading(true);
    setMobileMenuOpen(false);
    // If navigating away from a streaming conversation, mark it as background
    if (streamingConvRef.current && streamingConvRef.current !== id) {
      setBgStreaming(prev => new Set(prev).add(streamingConvRef.current!));
      setStreaming(false);
    }
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (data.conversation) {
        setActiveConvId(id);
        const mode = data.conversation.mode as ChatMode;
        const iType = data.conversation.interaction_type as InteractionMode;
        if (["sales", "client-success", "fulfillment", "onboarding"].includes(mode)) setChatMode(mode);
        if (["client", "research"].includes(iType)) setInteractionMode(iType);
        const msgs: Message[] = (data.messages || []).map((m: { role: string; content: string; interaction_mode?: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          interactionMode: (m.interaction_mode || "client") as InteractionMode,
        }));
        setMessages(msgs);
        setInlineExpanded({});
        setExpandOrder({});
        setExpandLoading({});
      }
    } catch { /* ignore */ }
    finally { setConvLoading(false); }
  }

  async function saveMessage(role: string, content: string, convId?: string | null) {
    const id = convId || activeConvId;
    if (!id) return;
    try {
      await fetch(`/api/conversations/${id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content, interaction_mode: interactionMode }),
      });
      loadConversations(); // refresh titles and timestamps
    } catch { /* ignore */ }
  }

  async function pinConversation(id: string, pinned: boolean) {
    await fetch(`/api/conversations/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned }) });
    loadConversations();
  }

  async function renameConversation(id: string, title: string) {
    await fetch(`/api/conversations/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    setRenamingId(null);
    loadConversations();
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (activeConvId === id) { setActiveConvId(null); setMessages([]); }
    setConfirmDeleteConv(null);
    loadConversations();
  }

  async function clearAllConversations() {
    await fetch("/api/conversations/clear-all", { method: "DELETE" });
    setActiveConvId(null); setMessages([]); setConversations([]); setConfirmClearAll(false);
  }

  // Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/conversations/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch { setSearchResults([]); }
    }, 500);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);
  // Smart auto-scroll — only scroll to bottom if user hasn't scrolled up
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setHasNewMessage(false);
    } else if (messages.length > 0) {
      setHasNewMessage(true);
    }
  }, [messages, userScrolledUp]);
  useEffect(() => { activeConvRef.current = activeConvId; }, [activeConvId]);
  useEffect(() => { if (activeTab === "kb") { loadKbFiles(); loadLog(); } }, [activeTab]);
  useEffect(() => {
    function handleClick(e: MouseEvent) { if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) setModeDropdownOpen(false); }
    if (modeDropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modeDropdownOpen]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  // Global Escape key handler
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (modeDropdownOpen) setModeDropdownOpen(false);
      else if (modeSwitchPrompt) setModeSwitchPrompt(null);
      else if (confirmDeleteConv) setConfirmDeleteConv(null);
      else if (confirmClearAll) setConfirmClearAll(false);
      else if (forceRewriteConfirm) setForceRewriteConfirm(false);
      else if (confirmRewrite) setConfirmRewrite(false);
      else if (profileMenuOpen) setProfileMenuOpen(false);
      else if (mobileMenuOpen) setMobileMenuOpen(false);
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [modeDropdownOpen, modeSwitchPrompt, confirmDeleteConv, confirmClearAll, forceRewriteConfirm, confirmRewrite, profileMenuOpen, mobileMenuOpen]);

  // Close profile menu on outside click
  useEffect(() => {
    if (!profileMenuOpen) return;
    function close(e: MouseEvent) { if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setProfileMenuOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [profileMenuOpen]);

  function switchMode(mode: ChatMode) {
    if (mode === chatMode) { setModeDropdownOpen(false); return; }
    setModeDropdownOpen(false);
    if (messages.length === 0) {
      // No conversation yet — just switch directly
      setChatMode(mode);
      setToast(`Switched to ${MODE_LABELS[mode]}`);
    } else {
      // Show inline prompt
      setModeSwitchPrompt(mode);
    }
  }

  function handleModeSwitchNewChat() {
    const newMode = modeSwitchPrompt!;
    setModeSwitchPrompt(null);
    setChatMode(newMode);
    setActiveConvId(null);
    setMessages([]);
    setInlineExpanded({});
    setExpandOrder({});
    setExpandLoading({});
    setExpandingAll({});
    createNewChat();
  }

  function handleModeSwitchContinue() {
    const newMode = modeSwitchPrompt!;
    setModeSwitchPrompt(null);
    setChatMode(newMode);
    // Add divider message
    setMessages(prev => [...prev, { role: "assistant" as const, content: `Switched to ${MODE_LABELS[newMode]}`, isDivider: true, mode: newMode }]);
    // Update conversation mode in DB
    if (activeConvId) {
      fetch(`/api/conversations/${activeConvId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: newMode }) });
    }
  }

  async function handleModeSwitchRecontextualize() {
    const newMode = modeSwitchPrompt!;
    const oldMode = chatMode;
    setModeSwitchPrompt(null);
    setChatMode(newMode);

    // Add divider then the recontextualize message
    const dividerMsg: Message = { role: "assistant", content: `${MODE_LABELS[newMode]} is reviewing the conversation`, isDivider: true, mode: newMode };
    const recontextMsg: Message = { role: "assistant", content: "", interactionMode, mode: newMode, draftLabel: "recontextualize" };
    setMessages(prev => [...prev, dividerMsg, recontextMsg]);
    setStreaming(true);

    const dividerIdx = messages.length; // divider position
    const recontextIdx = messages.length + 1; // after divider
    const thisConvId = activeConvId;
    streamingConvRef.current = thisConvId;

    // Update conversation mode in DB
    if (thisConvId) {
      fetch(`/api/conversations/${thisConvId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: newMode }) });
    }

    try {
      const recontextPrompt = `You are switching from ${MODE_LABELS[oldMode]} to ${MODE_LABELS[newMode]} in an ongoing conversation.

Do the following in this exact structure and no other:

First, write 1 to 4 sentences that naturally acknowledge the context shift. Speak directly to the rep. Reference what was just being discussed and frame how ${MODE_LABELS[newMode]} sees it differently or can build on it. Do not summarize the whole conversation. Do not say 'as [role]' or announce your role. Just speak naturally from the new perspective.

Then output exactly this on its own line:
---

Then immediately answer the most recent question from the conversation as ${MODE_LABELS[newMode]}, following ALL formatting rules exactly as if this were a fresh response in ${MODE_LABELS[newMode]}:
- Start with ## SIMPLE
- Write the SIMPLE section as a direct word-for-word client-facing script (or rep-facing if Strategy Mode)
- End with [[EXPAND_PROMPT]]
- Follow all CRITICAL FORMAT INSTRUCTION rules
- Follow all ${MODE_LABELS[newMode]} Skill file rules exactly

Do not add any preamble before the recontextualization sentences.
Do not explain what you are doing.
Do not use any section headers before the --- divider.
The --- divider must appear on its own line with nothing before or after it on that line.`;

      const contextMessages = [
        ...messages.filter(m => !m.isDivider).map(m => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: recontextPrompt }
      ];

      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: contextMessages, mode: newMode, interactionMode }) });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        // Throttle UI updates — render raw text during stream, no splitting
        if (activeConvRef.current === thisConvId || activeConvRef.current === null) {
          if (!streamThrottleRef.current) {
            const captured = fullText;
            setMessages(prev => { const copy = [...prev]; copy[recontextIdx] = { role: "assistant", content: captured, interactionMode, mode: newMode, draftLabel: "recontextualize" }; return copy; });
            streamThrottleRef.current = setTimeout(() => { streamThrottleRef.current = null; }, 50);
          }
        }
      }
      if (streamThrottleRef.current) { clearTimeout(streamThrottleRef.current); streamThrottleRef.current = null; }
      // Do NOT run cleanResponse here — it strips --- which is needed as the preamble/content divider
      // The clean() function inside AssistantMessage handles stripping on the post-split content
      fullText = fullText.replace(/\u2014/g, " ").replace(/\u2013/g, " ").replace(/ {2,}/g, " ").trim();
      if (activeConvRef.current === thisConvId || activeConvRef.current === null) {
        setMessages(prev => { const copy = [...prev]; copy[dividerIdx] = { ...copy[dividerIdx], content: `Now in ${MODE_LABELS[newMode]}` }; copy[recontextIdx] = { role: "assistant", content: fullText, interactionMode, mode: newMode, draftLabel: "recontextualize" }; return copy; });
      }
      if (thisConvId) saveMessage("assistant", fullText, thisConvId);
    } catch {
      if (activeConvRef.current === thisConvId || activeConvRef.current === null) {
        setMessages(prev => { const copy = [...prev]; copy[recontextIdx] = { role: "assistant", content: "Failed to recontextualize.", interactionMode, mode: newMode }; return copy; });
      }
    } finally {
      streamingConvRef.current = null;
      setStreaming(false);
      setBgStreaming(prev => { const next = new Set(prev); next.delete(thisConvId || ""); return next; });
    }
  }

  function switchInteractionMode(newMode: InteractionMode) {
    if (newMode === interactionMode) return;
    const oldMode = interactionMode;
    setInteractionMode(newMode);

    // Only insert divider if there are messages in the conversation
    if (messages.length > 0) {
      const label = newMode === "client" ? "Client Mode" : "Strategy Mode";
      const dividerMsg: Message = { role: "assistant", content: `\u2014 ${label} \u2014`, isDivider: true, mode: chatMode };

      // When switching from Strategy → Client, find last Strategy assistant message and add draft buttons
      if (oldMode === "research" && newMode === "client") {
        // Find the most recent assistant message that was in research/strategy mode
        let lastStrategyIdx = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === "assistant" && messages[i].interactionMode === "research" && !messages[i].isDivider) {
            lastStrategyIdx = i;
            break;
          }
        }
        if (lastStrategyIdx >= 0) {
          // Mark the message so it gets client-mode draft buttons
          setMessages(prev => {
            const copy = [...prev];
            copy[lastStrategyIdx] = { ...copy[lastStrategyIdx], draftLabel: "strategy-to-client" };
            return [...copy, dividerMsg];
          });
        } else {
          setMessages(prev => [...prev, dividerMsg]);
        }
      } else {
        setMessages(prev => [...prev, dividerMsg]);
      }
    }
  }

  function autoResizeTextarea() { const el = textareaRef.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 200) + "px"; }

  function cleanResponse(text: string): string {
    // Only clean formatting issues — do NOT strip [[EXPAND_PROMPT]] or [[CLARIFY]] here
    // Those tokens are parsed by parseResponse() in the render layer
    return text
      .replace(/^---+$/gm, "")
      .replace(/\u2014/g, " ")
      .replace(/\u2013/g, " ")
      .replace(/ {2,}/g, " ")
      .trim();
  }

  async function sendMessage(text: string) {
    if (!text.trim() && pendingFiles.length === 0) return; if (streaming) return;

    // Auto-create conversation if none active
    let convId = activeConvId;
    if (!convId) {
      try {
        const createRes = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: chatMode, interaction_type: interactionMode }) });
        const createData = await createRes.json();
        convId = createData.conversation.id;
        setActiveConvId(convId);
      } catch { /* continue without persistence */ }
    }

    // Track which conversation this stream belongs to
    const thisConvId = convId;
    streamingConvRef.current = thisConvId;

    let userContent: string | ContentBlock[];
    if (pendingFiles.length > 0) { const blocks: ContentBlock[] = []; for (const f of pendingFiles) { if (f.fileType === "image") blocks.push({ type: "image", source: { type: "base64", media_type: f.mediaType, data: f.base64 } }); else if (f.fileType === "pdf") blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.base64 } }); else { const decoded = atob(f.base64); blocks.push({ type: "text", text: `--- ${f.name} ---\n${decoded}` }); } } if (text.trim()) blocks.push({ type: "text", text: text.trim() }); userContent = blocks; } else { userContent = text.trim(); }
    // Dismiss mode switch prompt if typing
    if (modeSwitchPrompt) { handleModeSwitchContinue(); }

    const userMsg: Message = { role: "user", content: userContent, mode: chatMode }; const updated = [...messages, userMsg]; setMessages([...updated, { role: "assistant", content: "", interactionMode, mode: chatMode }]); setInput(""); setPendingFiles([]); if (textareaRef.current) textareaRef.current.style.height = "auto"; setStreaming(true);

    // Save user message
    const userTextForDb = typeof userContent === "string" ? userContent : text.trim();
    if (thisConvId) saveMessage("user", userTextForDb, thisConvId);

    const assistantIdx = updated.length; // index of the assistant message
    let fullText = "";
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: updated, mode: chatMode, interactionMode }) });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        // Throttle UI updates to every 50ms to prevent mid-stream re-render thrash
        if (activeConvRef.current === thisConvId || activeConvRef.current === null) {
          if (!streamThrottleRef.current) {
            const captured = fullText;
            setMessages(prev => { const copy = [...prev]; if (copy[assistantIdx]) { copy[assistantIdx] = { ...copy[assistantIdx], content: captured }; } return copy; });
            streamThrottleRef.current = setTimeout(() => { streamThrottleRef.current = null; }, 50);
          }
        }
      }
      if (streamThrottleRef.current) { clearTimeout(streamThrottleRef.current); streamThrottleRef.current = null; }
      fullText = cleanResponse(fullText);
      if (activeConvRef.current === thisConvId || activeConvRef.current === null) {
        setMessages(prev => { const copy = [...prev]; if (copy[assistantIdx]) { copy[assistantIdx] = { ...copy[assistantIdx], content: fullText }; } return copy; });
      }
      // Always save to DB regardless of which conversation is displayed
      if (thisConvId) saveMessage("assistant", fullText, thisConvId);
    } catch {
      if (activeConvRef.current === thisConvId || activeConvRef.current === null) {
        setMessages(prev => { const copy = [...prev]; if (copy[assistantIdx]) { copy[assistantIdx] = { ...copy[assistantIdx], content: fullText || "Something went wrong. Please try again.", isError: !fullText }; } return copy; });
      }
    } finally {
      streamingConvRef.current = null;
      // Only clear streaming state if user is still on this conversation
      if (activeConvRef.current === thisConvId || activeConvRef.current === null) {
        setStreaming(false);
      } else {
        setStreaming(false);
      }
      setBgStreaming(prev => { const next = new Set(prev); next.delete(thisConvId || ""); return next; });
    }
  }
  function handleSend() { sendMessage(input); }
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) { const fileList = e.target.files; if (!fileList) return; const files = Array.from(fileList); if (pendingFiles.length + files.length > 10) { setToast("Maximum 10 files at once"); e.target.value = ""; return; } for (const file of files) { if (file.size > 10 * 1024 * 1024) { setToast(`${file.name} exceeds 10MB limit`); continue; } const isImage = IMAGE_TYPES.includes(file.type); const isPdf = file.type === "application/pdf"; const isText = /\.(txt|md|csv)$/i.test(file.name); if (!isImage && !isPdf && !isText) continue; const reader = new FileReader(); reader.onload = () => { const result = reader.result as string; const base64 = result.split(",")[1]; const preview = isImage ? result : null; const fileType: PendingFile["fileType"] = isImage ? "image" : isPdf ? "pdf" : "text"; setPendingFiles(prev => prev.length >= 10 ? prev : [...prev, { name: file.name, base64, mediaType: file.type, preview, fileType }]); }; reader.readAsDataURL(file); } e.target.value = ""; }
  function removePendingFile(index: number) { setPendingFiles(prev => prev.filter((_, i) => i !== index)); }
  function clearConversation() { setMessages([]); setInlineExpanded({}); setExpandOrder({}); setExpandLoading({}); setExpandingAll({}); }

  // Strip meta-commentary like "Here is the MORE DETAIL section as requested."
  function stripMetaCommentary(text: string): string {
    return text
      .replace(/^Here is the\s+(?:MORE DETAIL|FULL SCRIPT|REP NOTES|SIMPLE|DEEPER|DEEPEST|INTERNAL)[^.\n]*(?:section|response)[^.\n]*\.?\s*\n*/i, "")
      .replace(/^Here is the\s+[^.\n]*\s+section\s+as\s+requested[^.\n]*\.?\s*\n*/i, "")
      .replace(/^\n+/, "")
      .trim();
  }

  async function expandSectionInline(msgIdx: number, sectionKey: string) {
    if (expandLoading[msgIdx]) return; // already loading something for this msg

    // Find the original user question and assistant response for context
    const assistantMsg = messages[msgIdx];
    const userMsg = msgIdx > 0 ? messages[msgIdx - 1] : null;
    if (!assistantMsg || !userMsg) return;

    // Track click order — append to order array if not already present
    setExpandOrder(prev => {
      const existing = prev[msgIdx] || [];
      if (existing.includes(sectionKey)) return prev;
      return { ...prev, [msgIdx]: [...existing, sectionKey] };
    });

    setExpandLoading(prev => ({ ...prev, [msgIdx]: sectionKey }));

    try {
      const contextMessages = [
        { role: userMsg.role, content: userMsg.content },
        { role: assistantMsg.role, content: assistantMsg.content },
        { role: "user", content: `Give me only the ${sectionKey} section. No SIMPLE section. Start directly with the content. Do not say "Here is the ${sectionKey} section" or any similar preamble.` }
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: contextMessages, mode: assistantMsg.mode || chatMode, interactionMode: assistantMsg.interactionMode || interactionMode }),
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        // Update inline expanded in real time
        setInlineExpanded(prev => ({
          ...prev,
          [msgIdx]: { ...(prev[msgIdx] || {}), [sectionKey]: fullText }
        }));
      }

      // Clean up final text
      fullText = fullText.replace(/\[\[EXPAND_PROMPT\]\]/g, "").replace(/^---+$/gm, "").replace(/\u2014/g, " ").replace(/\u2013/g, " ").replace(/ {2,}/g, " ").replace(/^- /gm, "").trim();
      // Strip the section header if Claude included it
      fullText = fullText.replace(new RegExp("^#{2,4}\\s+" + sectionKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\n?", "i"), "").trim();
      // Strip meta-commentary
      fullText = stripMetaCommentary(fullText);

      setInlineExpanded(prev => ({
        ...prev,
        [msgIdx]: { ...(prev[msgIdx] || {}), [sectionKey]: fullText }
      }));
    } catch {
      setToast("Failed to load " + sectionKey);
      setInlineExpanded(prev => {
        const copy = { ...prev };
        if (copy[msgIdx]) delete copy[msgIdx][sectionKey];
        return copy;
      });
      // Remove from order on failure
      setExpandOrder(prev => {
        const existing = prev[msgIdx] || [];
        return { ...prev, [msgIdx]: existing.filter(k => k !== sectionKey) };
      });
    } finally {
      setExpandLoading(prev => { const copy = { ...prev }; delete copy[msgIdx]; return copy; });
    }
  }

  async function expandAllInline(msgIdx: number) {
    const isResearch = interactionMode === "research";
    const allKeys = isResearch ? ["MORE DETAIL", "FULL SCRIPT"] : ["MORE DETAIL", "FULL SCRIPT", "REP NOTES"];
    const existing = inlineExpanded[msgIdx] || {};
    const remaining = allKeys.filter(k => !existing[k]);
    if (remaining.length === 0) return;

    setExpandingAll(prev => ({ ...prev, [msgIdx]: true }));
    for (const key of remaining) {
      await expandSectionInline(msgIdx, key);
    }
    setExpandingAll(prev => { const copy = { ...prev }; delete copy[msgIdx]; return copy; });
  }

  function getCleanContext(msgIdx: number): string {
    const msg = messages[msgIdx];
    if (!msg) return "";
    let baseText = typeof msg.content === "string" ? msg.content : "";
    const expanded = inlineExpanded[msgIdx] || {};
    const allContent = [baseText, ...Object.values(expanded)].join("\n\n");
    // Strip all tokens and section headers
    return allContent
      .replace(/\[\[EXPAND_PROMPT\]\]/g, "")
      .replace(/\[\[CLARIFY\]\][\s\S]*/g, "")
      .replace(/^#{2,4}\s+(SIMPLE|DEEPER|DEEPEST|INTERNAL FULL PICTURE|INTERNAL|STRATEGY|ANSWER TO CLIENT|PROBLEM|OPTIONS|RECOMMENDATION)\s*$/gm, "")
      .replace(/^---+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async function sendDraftAction(action: string, msgIdx: number) {
    const context = getCleanContext(msgIdx);
    let prompt = "";

    if (action === "Draft Email") {
      prompt = `Write a professional sales follow-up email based on this talk track. Format it exactly like this:

Subject: [subject line]

[email body. 3 to 5 short paragraphs, no bullets, no headers, written as a real email from a Freewyld sales rep to a prospect]

Rules:
- No em dashes
- No colons in body text
- No bold text
- No bullet points
- Conversational but professional tone
- End with a clear single CTA
- No sign-off. Just the CTA as the final line

Talk track to base this on:
${context}`;
    } else if (action === "Draft Text") {
      prompt = `Write a conversational SMS text message based on this talk track. Format as a real text message:

Rules:
- Short, 2-4 sentences max
- Casual but professional
- No greeting beyond first name
- No sign-off
- End with a leading question or soft CTA
- No em dashes, no colons, no bold

Talk track to base this on:
${context}`;
    } else if (action === "Draft Voicemail") {
      prompt = `Write a voicemail script based on this talk track. Format as spoken word with [pause] markers:

Rules:
- Under 30 seconds when read aloud
- Natural spoken cadence with [pause] markers between thoughts
- Start with "Hey [name]" then get to the point
- End with a callback ask
- No em dashes, no colons, no bold

Talk track to base this on:
${context}`;
    } else if (action === "Draft Slack Message") {
      prompt = `Write a Slack message based on this talk track. Format as a real Slack message:

Rules:
- Conversational, warm but firm
- No greeting beyond first name
- No sign-off
- 2-4 short paragraphs
- No em dashes, no colons, no bold

Talk track to base this on:
${context}`;
    } else if (action === "Draft Slack to Team") {
      prompt = `Draft a brief internal Slack message to a team member summarizing the key insight from this response. Conversational, no sign-off, no greetings, under 3 sentences. No em dashes, no colons, no bold.

Insight to summarize:
${context}`;
    } else {
      prompt = `Draft a ${action.toLowerCase()} based on this:\n\n${context}`;
    }

    // Direct API call — no visible user message
    const label = action === "Draft Slack to Team" ? "Slack Draft" : action;
    const draftMessages = [...messages, { role: "user" as const, content: prompt }];
    const draftIdx = messages.length; // index where the draft response will go
    setMessages(prev => [...prev, { role: "assistant", content: "", interactionMode, draftLabel: label }]);
    setStreaming(true);

    const thisConvId = activeConvId;
    streamingConvRef.current = thisConvId;

    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: draftMessages, mode: chatMode, interactionMode }) });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        if (activeConvRef.current === thisConvId || activeConvRef.current === null) {
          if (!streamThrottleRef.current) {
            const captured = fullText;
            setMessages(prev => { const copy = [...prev]; copy[draftIdx] = { role: "assistant", content: captured, interactionMode, draftLabel: label }; return copy; });
            streamThrottleRef.current = setTimeout(() => { streamThrottleRef.current = null; }, 50);
          }
        }
      }
      if (streamThrottleRef.current) { clearTimeout(streamThrottleRef.current); streamThrottleRef.current = null; }
      fullText = cleanResponse(fullText);
      if (activeConvRef.current === thisConvId || activeConvRef.current === null) {
        setMessages(prev => { const copy = [...prev]; copy[draftIdx] = { role: "assistant", content: fullText, interactionMode, draftLabel: label }; return copy; });
      }
      if (thisConvId) saveMessage("assistant", fullText, thisConvId);
    } catch {
      if (activeConvRef.current === thisConvId || activeConvRef.current === null) {
        setMessages(prev => { const copy = [...prev]; copy[draftIdx] = { role: "assistant", content: "Failed to generate draft.", interactionMode, draftLabel: label }; return copy; });
      }
    } finally {
      streamingConvRef.current = null;
      setStreaming(false);
      setBgStreaming(prev => { const next = new Set(prev); next.delete(thisConvId || ""); return next; });
    }
  }

  function handleClarifyOption(option: string) {
    sendMessage(option);
  }
  async function loadKbFiles() { setKbFilesLoading(true); try { const res = await fetch("/api/kb-files"); const data = await res.json(); setKbFiles(data.files || []); } catch { setKbFiles([]); } finally { setKbFilesLoading(false); } }
  async function loadLog() { setLogLoading(true); try { const res = await fetch("/api/kb-log"); const data = await res.json(); setLogEntries((data.rewrites || []).slice(0, 10)); } catch { setLogEntries([]); } finally { setLogLoading(false); } }
  async function openFile(file: KbFile) { setSelectedFile(file); setEditorLoading(true); setEditChatHistory([]); setEditChatInput(""); setPendingDiff(null); try { const res = await fetch(`/api/kb-file?fileId=${encodeURIComponent(file.id)}`); const data = await res.json(); if (data.error) throw new Error(data.error); setEditorContent(data.content || ""); setEditorOriginal(data.content || ""); } catch { setToast("Failed to load file"); setSelectedFile(null); } finally { setEditorLoading(false); } }
  async function saveFile() { if (!selectedFile) return; setSaving(true); try { const res = await fetch("/api/kb-file", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: selectedFile.id, content: editorContent }) }); const data = await res.json(); if (data.error) throw new Error(data.error); setEditorOriginal(editorContent); setToast("File saved"); setConfirmRewrite(true); loadKbFiles(); } catch { setToast("Save failed"); } finally { setSaving(false); } }
  function cancelEdit() { setSelectedFile(null); setEditorContent(""); setEditorOriginal(""); setEditChatHistory([]); setEditChatInput(""); setPendingDiff(null); }

  async function sendEditChat() {
    if (!editChatInput.trim() || editStreaming || !selectedFile) return; const instruction = editChatInput.trim(); setEditChatInput(""); const userMsg: EditChatMsg = { role: "user", text: instruction }; setEditChatHistory(prev => [...prev, userMsg].slice(-5)); setEditStreaming(true); setPendingDiff(null);
    try { const res = await fetch("/api/kb-file-edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: selectedFile.id, fileName: selectedFile.name, currentContent: editorContent, instruction }) }); if (!res.body) throw new Error("No response body"); const reader = res.body.getReader(); const decoder = new TextDecoder(); let fullText = ""; while (true) { const { done, value } = await reader.read(); if (done) break; fullText += decoder.decode(value, { stream: true }); setPendingDiff(fullText); } if (fullText.includes("[[DEL]]") || fullText.includes("[[ADD]]")) { setPendingDiff(fullText); setEditChatHistory(prev => [...prev, { role: "assistant" as const, text: "Changes suggested. Review and Accept or Reject." }].slice(-5)); } else { setPendingDiff(null); setEditChatHistory(prev => [...prev, { role: "assistant" as const, text: fullText }].slice(-5)); } } catch { setToast("Edit failed"); setPendingDiff(null); setEditChatHistory(prev => [...prev, { role: "assistant" as const, text: "Failed to process edit request." }].slice(-5)); } finally { setEditStreaming(false); }
  }
  function acceptAllChanges() { if (!pendingDiff) return; let clean = pendingDiff; clean = clean.replace(/\[\[DEL\]\][\s\S]*?\[\[\/DEL\]\]/g, ""); clean = clean.replace(/\[\[ADD\]\]([\s\S]*?)\[\[\/ADD\]\]/g, "$1"); setEditorContent(clean); setPendingDiff(null); if (selectedFile) { setSaving(true); fetch("/api/kb-file", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: selectedFile.id, content: clean }) }).then(r => r.json()).then(data => { if (data.error) setToast("Save failed"); else { setEditorOriginal(clean); setToast("Changes saved"); setConfirmRewrite(true); loadKbFiles(); } }).catch(() => setToast("Save failed")).finally(() => setSaving(false)); } }
  function rejectAllChanges() { setPendingDiff(null); setToast("Changes rejected"); }
  async function triggerRewrite() { setRewriting(true); setConfirmRewrite(false); setForceRewriteConfirm(false); setKbAddConfirmRewrite(false); try { const res = await fetch("/api/kb-rewrite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "", trigger: "manual" }) }); const data = await res.json(); if (data.error) throw new Error(data.error); setToast("Wyle's knowledge has been updated"); loadLog(); } catch { setToast("Update failed — please try again"); } finally { setRewriting(false); } }
  async function handleAddToKb() { if (!kbAddText.trim() || kbAdding) return; setKbAdding(true); try { const res = await fetch("/api/kb-update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: kbAddText.trim() }) }); const data = await res.json(); if (data.error) throw new Error(data.error); setKbAddText(""); setToast("Added to knowledge base"); setKbAddConfirmRewrite(true); } catch { setToast("Failed to add to knowledge base"); } finally { setKbAdding(false); } }

  // ── Loading (session check) ──
  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-onyx)" }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} />
    </div>
  );

  // ── Main app ── // force redeploy 2026-03-22
  return (
    <div className="h-screen flex" style={{ background: "var(--bg-content)" }}>
      {/* ── LEFT ZONE — Sidebar ── */}
      <nav ref={sidebarRef} aria-label="Conversation history" className={`shrink-0 flex flex-col sidebar-transition ${mobileMenuOpen ? "mobile-open" : ""}`}
        style={{ width: chatSidebarOpen ? 260 : 48, minWidth: chatSidebarOpen ? 260 : 48, background: "#161616", borderRight: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", position: "relative" }}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; touchCurrentX.current = e.touches[0].clientX; }}
        onTouchMove={e => { touchCurrentX.current = e.touches[0].clientX; const delta = (touchStartX.current || 0) - e.touches[0].clientX; if (delta > 0 && sidebarRef.current) sidebarRef.current.style.transform = `translateX(${-delta}px)`; }}
        onTouchEnd={() => { const delta = (touchStartX.current || 0) - (touchCurrentX.current || 0); if (sidebarRef.current) sidebarRef.current.style.transform = ""; if (delta > 80) setMobileMenuOpen(false); touchStartX.current = null; touchCurrentX.current = null; }}>
        {/* Sidebar header — logo + name + collapse */}
        <div className="shrink-0 flex items-center" style={{ height: 64, padding: chatSidebarOpen ? "0 12px 0 16px" : "0", justifyContent: chatSidebarOpen ? "space-between" : "center" }}>
          {chatSidebarOpen ? (
            <>
              <div className="flex items-center" style={{ gap: 10 }}>
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 8 }} aria-label="Wyle" role="img">
                  <rect width="100" height="100" rx="20" fill="#CC8A39"/><rect width="100" height="100" rx="20" fill="#663925" opacity="0.12"/>
                  <text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="58" fontWeight="700" fill="#3c3b22">W</text>
                  <text x="50" y="84" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fontWeight="600" fill="#3c3b22" letterSpacing="3" opacity="0.85">WYLE</text>
                </svg>
                <span style={{ fontSize: 18, fontWeight: 600, color: "#f8f6ee", fontFamily: "var(--font-heading)" }}>Wyle</span>
              </div>
              <div className="flex items-center gap-1">
                {mobileMenuOpen && (
                  <button onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="hide-desktop"
                    style={{ background: "none", border: "none", color: "rgba(248,246,238,0.5)", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44 }}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} style={{ width: 18, height: 18 }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                <button onClick={() => setChatSidebarOpen(false)} aria-label="Collapse sidebar" className="hide-mobile"
                  style={{ background: "none", border: "none", color: "rgba(248,246,238,0.5)", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44 }}
                  onMouseEnter={e => e.currentTarget.style.color = "#f8f6ee"} onMouseLeave={e => e.currentTarget.style.color = "rgba(248,246,238,0.5)"}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} style={{ width: 16, height: 16 }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </button>
              </div>
            </>
          ) : (
            <button onClick={() => setChatSidebarOpen(true)} aria-label="Expand sidebar" className="hide-mobile"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: 32, height: 32, borderRadius: 6 }} aria-hidden="true">
                <rect width="100" height="100" rx="20" fill="#CC8A39"/><rect width="100" height="100" rx="20" fill="#663925" opacity="0.12"/>
                <text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="58" fontWeight="700" fill="#3c3b22">W</text>
              </svg>
            </button>
          )}
        </div>

        {/* Collapsed: expand button below avatar */}
        {!chatSidebarOpen && (
          <div className="hide-mobile" style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
            <button onClick={() => setChatSidebarOpen(true)} aria-label="Expand sidebar"
              style={{ background: "none", border: "none", color: "rgba(248,246,238,0.5)", cursor: "pointer", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={e => e.currentTarget.style.color = "#f8f6ee"} onMouseLeave={e => e.currentTarget.style.color = "rgba(248,246,238,0.5)"}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} style={{ width: 16, height: 16 }}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
        )}

        {chatSidebarOpen ? (
          <>
            {/* New chat button */}
            <div style={{ margin: "12px 12px 8px 12px" }}>
              <button onClick={() => { setActiveConvId(null); setMessages([]); setInlineExpanded({}); setExpandOrder({}); setMobileMenuOpen(false); }} aria-label="Start new conversation"
                style={{ width: "100%", borderRadius: 8, background: "#CC8A39", color: "#161616", border: "none", cursor: "pointer", height: 40, fontSize: 14, fontWeight: 600, padding: "0 16px" }}>
                + New Chat
              </button>
            </div>
            {/* Search */}
            <div className="px-3 mb-2">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search conversations..." aria-label="Search conversations"
                className="w-full px-3 py-2 focus:outline-none"
                style={{ borderRadius: 6, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#f8f6ee", fontSize: 15 }} />
            </div>
            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto px-1.5">
              {searchResults !== null ? (
                searchResults.length === 0 ? <div className="text-xs text-center py-6" style={{ color: "var(--text-muted-dark)" }}>No conversations found</div> : (
                  searchResults.map((c: Conversation & { snippet?: string }) => (
                    <button key={c.id} onClick={() => { loadConversation(c.id); setSearchQuery(""); setSearchResults(null); }}
                      className="w-full text-left px-3 py-2 mb-0.5 transition-all" style={{ borderRadius: 6, background: "transparent", border: "none", cursor: "pointer", color: "rgba(248,246,238,0.85)", minHeight: 44 }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div className="text-xs truncate">{c.title}</div>
                      {c.snippet && <div className="text-xs truncate mt-0.5" style={{ color: "rgba(248,246,238,0.35)" }}>{c.snippet.substring(0, 80)}</div>}
                    </button>
                  ))
                )
              ) : (
                groupByDate(conversations).map(group => (
                  <div key={group.label} className="mb-2">
                    <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider sticky top-0" style={{ color: "var(--text-muted-dark)", background: "#161616", zIndex: 1, borderTop: group.label === "Pinned" ? "none" : "1px solid rgba(255,255,255,0.04)" }}>{group.label}</div>
                    {group.items.map(c => {
                      const badge = MODE_BADGES[c.mode] || MODE_BADGES.sales;
                      const isActive = c.id === activeConvId;
                      return (
                        <div key={c.id} className="group relative flex items-center px-1.5 mb-0.5">
                          <button onClick={() => { if (renamingId === c.id) return; loadConversation(c.id); }}
                            className="flex-1 text-left px-2 py-2 transition-all" style={{
                              borderRadius: 6, border: "none", cursor: "pointer",
                              background: isActive ? "rgba(204,138,57,0.15)" : "transparent",
                              borderLeft: isActive ? "2px solid #CC8A39" : "2px solid transparent",
                              color: "rgba(248,246,238,0.85)",
                            }}
                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                            {renamingId === c.id ? (
                              <input autoFocus value={renameText} onChange={e => setRenameText(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                onBlur={() => { if (renameText.trim()) renameConversation(c.id, renameText.trim()); else setRenamingId(null); }}
                                onKeyDown={e => { if (e.key === "Enter" && renameText.trim()) renameConversation(c.id, renameText.trim()); if (e.key === "Escape") setRenamingId(null); }}
                                className="w-full text-xs bg-transparent focus:outline-none" style={{ color: "rgba(248,246,238,0.85)", borderBottom: "1px solid #CC8A39" }} />
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 4, background: badge.bg, color: "#f8f6ee", fontWeight: 600 }}>{badge.label}</span>
                                <span className="truncate" style={{ maxWidth: 160, fontSize: 15, color: "#f8f6ee" }}>{c.title}</span>
                                {c.pinned && <span style={{ fontSize: 9, color: "#CC8A39" }}>&#x1F4CC;</span>}
                                {(bgStreaming.has(c.id) || (streamingConvRef.current === c.id && streaming)) && (
                                  <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: "#CC8A39", flexShrink: 0 }} />
                                )}
                              </div>
                            )}
                          </button>
                          {/* Hover actions */}
                          <div className={`absolute right-2 top-1/2 -translate-y-1/2 ${c.pinned ? "flex" : "hidden group-hover:flex"}`} style={{ gap: 4, background: "#161616", borderRadius: 4, padding: "2px" }}>
                            <button onClick={(e) => { e.stopPropagation(); setRenamingId(c.id); setRenameText(c.title); }} title="Rename" aria-label={`Rename ${c.title}`}
                              style={{ background: "none", border: "none", color: "rgba(248,246,238,0.7)", cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, borderRadius: 4 }}
                              onMouseEnter={e => e.currentTarget.style.color = "#f8f6ee"} onMouseLeave={e => e.currentTarget.style.color = "rgba(248,246,238,0.7)"}>&#9998;</button>
                            <button onClick={(e) => { e.stopPropagation(); pinConversation(c.id, !c.pinned); }} title={c.pinned ? "Unpin" : "Pin"} aria-label={`${c.pinned ? "Unpin" : "Pin"} ${c.title}`}
                              style={{ background: "none", border: "none", color: c.pinned ? "#CC8A39" : "rgba(248,246,238,0.7)", cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, borderRadius: 4 }}
                              onMouseEnter={e => { if (!c.pinned) e.currentTarget.style.color = "#f8f6ee"; }} onMouseLeave={e => { if (!c.pinned) e.currentTarget.style.color = "rgba(248,246,238,0.7)"; }}>&#x1F4CC;</button>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteConv(c.id); }} title="Delete" aria-label={`Delete ${c.title}`}
                              style={{ background: "none", border: "none", color: "rgba(248,246,238,0.7)", cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, borderRadius: 4 }}
                              onMouseEnter={e => e.currentTarget.style.color = "#ff6b6b"} onMouseLeave={e => e.currentTarget.style.color = "rgba(248,246,238,0.7)"}>&#x1F5D1;</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            {/* Profile row + popover */}
            <div ref={profileMenuRef} className="shrink-0 relative" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {/* Profile popover — opens upward */}
              {profileMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 modal-enter" style={{ background: "#fff", borderRadius: 10, boxShadow: "0 -8px 24px rgba(0,0,0,0.15)", zIndex: 1000, width: 240, overflow: "hidden" }}>
                  {/* Preferences */}
                  <div style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-muted)", marginBottom: 8 }}>I usually use Wyle for</div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {(["sales", "client-success", "fulfillment", "onboarding"] as ChatMode[]).map(m => (
                        <button key={m} onClick={() => { setChatMode(m); fetch("/api/user-preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ default_mode: m }) }); setToast("Preference saved"); }}
                          style={{ fontSize: 12, padding: "4px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: chatMode === m ? "#CC8A39" : "rgba(22,22,22,0.06)", color: chatMode === m ? "#161616" : "var(--color-onyx)", fontWeight: chatMode === m ? 600 : 400 }}>
                          {MODE_LABELS[m]}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-muted)", marginBottom: 8 }}>My default view</div>
                    <div className="flex gap-1 mb-1">
                      {(["client", "research"] as InteractionMode[]).map(v => (
                        <button key={v} onClick={() => { setInteractionMode(v); fetch("/api/user-preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ default_interaction: v }) }); setToast("Preference saved"); }}
                          style={{ fontSize: 12, padding: "4px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: interactionMode === v ? "#3c3b22" : "rgba(22,22,22,0.06)", color: interactionMode === v ? "#f8f6ee" : "var(--color-onyx)", fontWeight: interactionMode === v ? 600 : 400 }}>
                          {v === "client" ? "Client Mode" : "Strategy Mode"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid rgba(22,22,22,0.08)" }} />
                  {/* Actions */}
                  <div style={{ padding: "8px 0" }}>
                    {isAdminUser && <a href="/admin" style={{ display: "block", padding: "8px 16px", fontSize: 14, color: "var(--color-olive)", textDecoration: "none" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.03)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      Admin Panel
                    </a>}
                    <button onClick={() => { setProfileMenuOpen(false); setConfirmClearAll(true); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 16px", fontSize: 14, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.03)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      Clear History
                    </button>
                    <button onClick={() => signOut()} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 16px", fontSize: 14, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.03)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
              {/* Profile row trigger */}
              <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} className="w-full flex items-center gap-3 transition-all"
                style={{ padding: "12px 16px", height: 56, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--color-olive)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#f8f6ee", flexShrink: 0 }}>
                  {session?.user?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate" style={{ color: "#f8f6ee", fontSize: 15, fontWeight: 500 }}>{session?.user?.name || session?.user?.email || ""}</span>
                    {userRole === "admin" && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--color-olive)", color: "#f8f6ee", fontWeight: 600, flexShrink: 0 }}>Admin</span>}
                    {userRole === "knowledge_manager" && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--color-mustard)", color: "var(--color-onyx)", fontWeight: 600, flexShrink: 0 }}>KB</span>}
                  </div>
                </div>
                <span style={{ color: "rgba(248,246,238,0.4)", fontSize: 18 }}>&rsaquo;</span>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Collapsed conversation list — mode badge initials only */}
            <div className="flex-1 overflow-y-auto" style={{ padding: "4px 0" }}>
              {conversations.slice(0, 20).map(c => {
                const badge = MODE_BADGES[c.mode] || MODE_BADGES.sales;
                const isActive = c.id === activeConvId;
                return (
                  <button key={c.id} onClick={() => loadConversation(c.id)} title={c.title} aria-label={c.title}
                    style={{ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: isActive ? "rgba(204,138,57,0.15)" : "transparent", border: "none", cursor: "pointer" }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? "rgba(204,138,57,0.15)" : "transparent"; }}>
                    <span style={{ fontSize: 9, padding: "2px 4px", borderRadius: 4, background: badge.bg, color: "#f8f6ee", fontWeight: 600 }}>{badge.label}</span>
                  </button>
                );
              })}
            </div>
            {/* Collapsed profile — just initial avatar */}
            <div className="shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "center", padding: "10px 0" }}>
              <button onClick={() => { setChatSidebarOpen(true); setTimeout(() => setProfileMenuOpen(true), 250); }} aria-label="Open profile"
                style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-olive)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#f8f6ee", border: "none", cursor: "pointer" }}>
                {session?.user?.name?.charAt(0)?.toUpperCase() || "?"}
              </button>
            </div>
          </>
        )}
      </nav>

      {/* Mobile sidebar overlay backdrop */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 sidebar-overlay hide-desktop" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setMobileMenuOpen(false)} role="presentation" />
      )}

      {/* ── RIGHT ZONE — Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden sidebar-transition">
        {/* Right zone top bar — tabs only */}
        <div className="shrink-0 flex items-center" style={{ height: 52, background: "var(--bg-content)", borderBottom: "1px solid rgba(0,0,0,0.08)", paddingLeft: 16 }}>
          {/* Mobile hamburger */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Open conversation menu" className="hide-desktop"
            style={{ background: "none", border: "none", color: "var(--color-onyx)", cursor: "pointer", padding: 8, marginRight: 8 }}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
          </button>
          <div className="flex items-center" style={{ gap: 8 }}>
            <button onClick={() => setActiveTab("chat")}
              style={{ fontSize: 15, fontWeight: 500, padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "var(--font-body)", transition: "all 0.15s ease",
                background: activeTab === "chat" ? "#161616" : "transparent",
                color: activeTab === "chat" ? "#f8f6ee" : "#777" }}>
              Chat
            </button>
            {isKbUser && (
              <button onClick={() => setActiveTab("kb")}
                style={{ fontSize: 15, fontWeight: 500, padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "var(--font-body)", transition: "all 0.15s ease",
                  background: activeTab === "kb" ? "#161616" : "transparent",
                  color: activeTab === "kb" ? "#f8f6ee" : "#777" }}>
                Knowledge Base
              </button>
            )}
            <button onClick={() => setActiveTab("guide")}
              style={{ fontSize: 15, fontWeight: 500, padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "var(--font-body)", transition: "all 0.15s ease",
                background: activeTab === "guide" ? "#161616" : "transparent",
                color: activeTab === "guide" ? "#f8f6ee" : "#777" }}>
              Guide
            </button>
          </div>
        </div>

        {/* ── Chat tab content ── */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden"
            onTouchStart={e => { if (e.touches[0].clientX < 30) touchStartX.current = e.touches[0].clientX; else touchStartX.current = null; }}
            onTouchEnd={e => { if (touchStartX.current !== null && touchStartX.current < 30) { const endX = e.changedTouches[0].clientX; if (endX - touchStartX.current > 80) setMobileMenuOpen(true); } touchStartX.current = null; }}>
          {/* Interaction mode toggle */}
          <div className="shrink-0 flex justify-center py-2" style={{ background: "var(--bg-content)" }}>
            <div style={{ display: "flex", gap: 2, background: "rgba(22,22,22,0.04)", borderRadius: 20, padding: 4 }}>
              <button onClick={() => switchInteractionMode("client")}
                style={{ fontSize: 13, fontWeight: 600, padding: "4px 14px", borderRadius: 16, border: "none", cursor: "pointer", fontFamily: "var(--font-body)",
                  background: interactionMode === "client" ? "#3c3b22" : "transparent",
                  color: interactionMode === "client" ? "#f8f6ee" : "rgba(22,22,22,0.4)" }}>
                Client Mode
              </button>
              <button onClick={() => switchInteractionMode("research")}
                style={{ fontSize: 13, fontWeight: 600, padding: "4px 14px", borderRadius: 16, border: "none", cursor: "pointer", fontFamily: "var(--font-body)",
                  background: interactionMode === "research" ? "#3c3b22" : "transparent",
                  color: interactionMode === "research" ? "#f8f6ee" : "rgba(22,22,22,0.4)" }}>
                Strategy Mode
              </button>
            </div>
          </div>
          <div ref={chatScrollRef} role="log" aria-live="polite" aria-label="Conversation messages" className="flex-1 overflow-y-auto py-6 chat-content-container"
            style={{ width: "100%" }}
            onScroll={e => {
              const el = e.currentTarget;
              const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
              setUserScrolledUp(!atBottom);
              if (atBottom) setHasNewMessage(false);
            }}>
            {/* Skeleton loading */}
            {convLoading && (
              <div className="py-6" style={{ maxWidth: 600 }}>
                {[1,2,3].map(n => (
                  <div key={n} className="mb-6">
                    <div className={n % 2 === 1 ? "flex justify-end" : "flex gap-3"}>
                      {n % 2 === 0 && <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }} />}
                      <div style={{ maxWidth: n % 2 === 1 ? "60%" : "70%" }}>
                        <div className="skeleton" style={{ height: 14, width: "90%", marginBottom: 8 }} />
                        <div className="skeleton" style={{ height: 14, width: "70%", marginBottom: 8 }} />
                        {n % 2 === 0 && <div className="skeleton" style={{ height: 14, width: "50%" }} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!convLoading && messages.length === 0 && (
              <div className="text-center py-6">
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-3" style={{ width: 80, height: 80 }} aria-label="Wyle" role="img">
                  <rect width="100" height="100" rx="20" fill="#CC8A39"/><rect width="100" height="100" rx="20" fill="#663925" opacity="0.12"/>
                  <text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="58" fontWeight="700" fill="#3c3b22">W</text>
                  <text x="50" y="84" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fontWeight="600" fill="#3c3b22" letterSpacing="3" opacity="0.85">WYLE</text>
                </svg>
                <h2 className="text-base font-semibold mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-onyx)" }}>How can I help?</h2>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)", maxWidth: 360, margin: "0 auto" }}>Ask about Freewyld Foundry sales, clients, pricing, or processes.</p>
                <div className="text-left" style={{ maxWidth: 600, margin: "0 auto" }}>
                  {(interactionMode === "research" ? RESEARCH_QUESTIONS : MODE_QUESTIONS)[chatMode].map((group, gi) => (
                    <div key={gi} style={{ marginTop: gi > 0 ? 16 : 0 }}>
                      <div style={{ fontSize: 12, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase" }}>{group.label}</div>
                      <div className="grid grid-cols-2 gap-2 mobile-single-col">
                        {group.items.map((q, qi) => (
                          <button key={qi} onClick={() => sendMessage(q)} disabled={streaming} className="px-3 py-2 text-xs text-left transition-all"
                            style={{ borderRadius: "10px", background: "transparent", border: "1px solid var(--color-olive)", color: "var(--color-olive)", cursor: "pointer", lineHeight: "1.4" }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(60,59,34,0.08)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => {
              // Render divider messages
              if (msg.isDivider) {
                return (
                  <div key={i} className="flex items-center justify-center my-4" style={{ gap: 12 }}>
                    <div style={{ flex: 1, height: 1, background: "rgba(22,22,22,0.08)" }} />
                    <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{typeof msg.content === "string" ? msg.content : ""}</span>
                    <div style={{ flex: 1, height: 1, background: "rgba(22,22,22,0.08)" }} />
                  </div>
                );
              }
              const contentBlocks = Array.isArray(msg.content) ? msg.content : null;
              const textBlocks = contentBlocks ? contentBlocks.filter((b): b is { type: "text"; text: string } => b.type === "text") : [];
              const userText = contentBlocks ? textBlocks.filter(b => !b.text.startsWith("--- ")).map(b => b.text).join("\n") : (msg.content as string);
              const fileTextBlocks = contentBlocks ? textBlocks.filter(b => b.text.startsWith("--- ")) : [];
              const imageBlocks = contentBlocks ? contentBlocks.filter((b): b is ContentBlock & { type: "image" } => b.type === "image") : [];
              const docBlocks = contentBlocks ? contentBlocks.filter((b): b is ContentBlock & { type: "document" } => b.type === "document") : [];
              const hasMedia = imageBlocks.length > 0 || docBlocks.length > 0 || fileTextBlocks.length > 0;
              return (
                <div key={i} className={`msg-gap ${msg.role === "user" ? "flex justify-end" : ""}`}>
                  {msg.role === "assistant" ? (
                    <AssistantMessage text={userText} msgIdx={i} isStreaming={streaming && i === messages.length - 1} chatMode={chatMode}
                      msgInteractionMode={msg.interactionMode || "client"} draftLabel={msg.draftLabel}
                      isError={msg.isError} onRetry={msg.isError ? () => { const prevMsg = messages[i-1]; setMessages(prev => prev.filter((_, idx) => idx !== i)); if (prevMsg?.role === "user") { const txt = typeof prevMsg.content === "string" ? prevMsg.content : ""; setTimeout(() => sendMessage(txt), 100); } } : undefined}
                      inlineExpanded={inlineExpanded[i] || {}} sectionOrder={expandOrder[i] || []} expandLoading={expandLoading[i]} expandingAll={!!expandingAll[i]}
                      onExpand={(section) => expandSectionInline(i, section)} onExpandAll={() => expandAllInline(i)}
                      onDraft={(action) => sendDraftAction(action, i)}
                      handleClarifyOption={handleClarifyOption} clarifyInput={clarifyInput} setClarifyInput={setClarifyInput} />
                  ) : (
                    <div className="inline-block msg-bubble-user text-sm group/usrmsg relative" style={{ padding: hasMedia ? "0.5rem" : "0.625rem 1rem", paddingRight: 36 }}>
                      {userText && <div className="absolute opacity-0 group-hover/usrmsg:opacity-100 transition-opacity" style={{ top: 8, right: 8 }}><CopyButton text={userText} /></div>}
                      {imageBlocks.map((img, j) => <img key={j} src={`data:${img.source.media_type};base64,${img.source.data}`} alt="Uploaded" style={{ maxWidth: 200, borderRadius: "10px", display: "block", marginBottom: "0.5rem" }} />)}
                      {docBlocks.map((_, j) => <div key={`doc-${j}`} className="flex items-center gap-1.5 px-2 py-1 mb-1" style={{ background: "rgba(255,255,255,0.15)", borderRadius: "6px", fontSize: "11px" }}><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>PDF</div>)}
                      {fileTextBlocks.map((ftb, j) => { const fname = ftb.text.match(/^--- (.+?) ---/)?.[1] || "file"; return <div key={`ftb-${j}`} className="flex items-center gap-1.5 px-2 py-1 mb-1" style={{ background: "rgba(255,255,255,0.15)", borderRadius: "6px", fontSize: "11px" }}><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>{fname}</div>; })}
                      {userText && <div style={{ padding: hasMedia ? "0 0.5rem 0.5rem" : undefined }}>{userText}</div>}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Mode switch inline prompt */}
            {modeSwitchPrompt && (
              <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: "16px 18px", maxWidth: 480, margin: "16px auto", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <p style={{ fontSize: 15, lineHeight: 1.4, color: "var(--color-onyx)", margin: "0 0 10px 0" }}>
                  You switched to <span style={{ fontWeight: 600 }}>{MODE_LABELS[modeSwitchPrompt]}</span>. Start fresh or bring your conversation with you?
                </p>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                  <button onClick={handleModeSwitchNewChat}
                    style={{ borderRadius: 8, background: "#CC8A39", color: "#161616", border: "none", height: 38, padding: "0 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                    New Chat
                  </button>
                  <button onClick={handleModeSwitchRecontextualize}
                    style={{ borderRadius: 8, background: "#3c3b22", color: "#f8f6ee", border: "none", height: 38, padding: "0 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                    Bring Context
                  </button>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.3, color: "#999", margin: 0 }}>Wyle will re-read this conversation and respond as {MODE_LABELS[modeSwitchPrompt]}</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {/* New message indicator */}
          {hasNewMessage && userScrolledUp && (
            <button className="new-msg-btn" onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); setUserScrolledUp(false); setHasNewMessage(false); }}>
              ↓ New message
            </button>
          )}
          {/* Input area */}
          <div className="shrink-0 px-4 py-4 border-t" style={{ background: "var(--bg-card)", borderColor: "rgba(22,22,22,0.08)" }}>
            <div className="chat-content-container" style={{ margin: "0 auto" }}>
              {pendingFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap items-start gap-2">
                  {pendingFiles.map((f, idx) => (
                    <div key={idx} className="relative inline-block">
                      {f.preview ? <img src={f.preview} alt={f.name} style={{ maxWidth: 80, maxHeight: 60, borderRadius: "8px", display: "block" }} /> : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs" style={{ borderRadius: "8px", background: "var(--color-cream)", border: "1px solid rgba(22,22,22,0.1)", color: "var(--color-onyx)", maxWidth: 140 }}>
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} className="w-3.5 h-3.5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                          <span className="truncate">{f.name}</span>
                        </div>
                      )}
                      <button onClick={() => removePendingFile(idx)} className="absolute flex items-center justify-center" style={{ top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "var(--color-onyx)", color: "var(--color-cream)", border: "2px solid #ffffff", cursor: "pointer", fontSize: "11px", lineHeight: 1, padding: 0 }}>&times;</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-end">
                {/* Mode selector */}
                <div className="relative shrink-0" ref={modeDropdownRef}>
                  <button onClick={() => setModeDropdownOpen(!modeDropdownOpen)} className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium transition-all"
                    style={{ borderRadius: "10px", background: "var(--color-olive)", color: "var(--color-cream)", border: "none", cursor: "pointer", minHeight: 44, whiteSpace: "nowrap" }}>
                    <span className="hidden sm:inline">{MODE_LABELS[chatMode]}</span>
                    <span className="sm:hidden">{MODE_LABELS[chatMode].split(" ")[0]}</span>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} className="w-3 h-3 shrink-0" style={{ transform: modeDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {modeDropdownOpen && (
                    <div className="absolute left-0 bottom-full mb-1 py-1 shadow-lg" style={{ borderRadius: "10px", background: "var(--color-onyx)", border: "1px solid rgba(255,255,255,0.12)", zIndex: 40, minWidth: 200 }}>
                      {(Object.keys(MODE_LABELS) as ChatMode[]).map(mode => (
                        <button key={mode} onClick={() => switchMode(mode)} className="w-full text-left px-4 py-2 text-sm transition-all"
                          style={{ background: "transparent", color: mode === chatMode ? "var(--color-mustard)" : "var(--color-cream)", fontWeight: mode === chatMode ? 600 : 400, border: "none", cursor: "pointer" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          {MODE_LABELS[mode]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept={ACCEPTED_TYPES} multiple className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={streaming || pendingFiles.length >= 10} className="shrink-0 flex items-center justify-center disabled:opacity-40 transition-all"
                  style={{ width: 44, minHeight: 44, borderRadius: "12px", background: "var(--color-cream)", border: "1px solid rgba(22,22,22,0.08)", cursor: "pointer", color: "var(--color-olive)" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-mustard)"; e.currentTarget.style.color = "var(--color-mustard)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(22,22,22,0.08)"; e.currentTarget.style.color = "var(--color-olive)"; }} title="Attach files" aria-label="Attach file">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                </button>
                <textarea ref={textareaRef} className="flex-1 px-4 py-3 focus:outline-none transition-all" rows={1}
                  style={{ borderRadius: "12px", background: "var(--bg-card)", border: "1px solid rgba(22,22,22,0.08)", color: "var(--color-onyx)", resize: "none", overflow: "hidden", maxHeight: 200 }}
                  onFocus={e => { e.currentTarget.style.borderColor = "var(--color-mustard)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(204,138,57,0.12)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(22,22,22,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
                  placeholder="Ask Wyle anything..." aria-label="Message input" value={input} onChange={e => { setInput(e.target.value); autoResizeTextarea(); }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} disabled={streaming} />
                <button onClick={handleSend} disabled={streaming || (!input.trim() && pendingFiles.length === 0)} aria-label="Send message" className="btn-primary px-5 py-3 font-semibold disabled:opacity-40"
                  style={{ borderRadius: "12px", minHeight: 44 }}>
                  {streaming ? <Spinner size={16} color="var(--color-onyx)" /> : "Send"}
                </button>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* ── Knowledge Base tab ── */}
        {activeTab === "kb" && isKbUser && (
          <div className="flex-1 flex overflow-hidden">
            {/* KB Sidebar: Source Files */}
            <div className="shrink-0 flex flex-col sidebar-transition" style={{ width: sidebarOpen ? 280 : 40, minWidth: sidebarOpen ? 280 : 40, background: "var(--bg-sidebar)", overflow: "hidden" }}>
              <div className="shrink-0 flex items-center justify-between px-3 py-3">
                {sidebarOpen && <h2 className="text-sm font-semibold" style={{ color: "var(--color-cream)", fontFamily: "var(--font-heading)" }}>Source Files</h2>}
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex items-center justify-center" style={{ width: 24, height: 24, background: "transparent", border: "none", cursor: "pointer", color: "var(--color-cream)", marginLeft: sidebarOpen ? 0 : "auto", marginRight: sidebarOpen ? 0 : "auto" }}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} className="w-4 h-4" style={{ transform: sidebarOpen ? "none" : "rotate(180deg)", transition: "transform 0.2s" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
              </div>
              {sidebarOpen && (
                <div className="flex-1 overflow-y-auto">
                  {kbFilesLoading ? (
                    <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} /></div>
                  ) : kbFiles.length === 0 ? (
                    <p className="text-xs px-4 py-4" style={{ color: "rgba(237,233,225,0.4)" }}>No source files found</p>
                  ) : (
                    kbFiles.map(file => (
                      <button key={file.id} onClick={() => openFile(file)} className="w-full text-left px-4 py-3 transition-all"
                        style={{ background: selectedFile?.id === file.id ? "rgba(204,138,57,0.12)" : "transparent", cursor: "pointer", border: "none", borderLeft: selectedFile?.id === file.id ? "3px solid var(--color-mustard)" : "3px solid transparent", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                        onMouseEnter={e => { if (selectedFile?.id !== file.id) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                        onMouseLeave={e => { if (selectedFile?.id !== file.id) e.currentTarget.style.background = "transparent"; }}>
                        <div className="text-sm font-medium truncate" style={{ color: "var(--color-cream)" }}>{file.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: "rgba(237,233,225,0.5)" }}>{new Date(file.modifiedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Editor + Chat to edit — side by side */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Top bar: Update Wyle's Knowledge + Rewrite Log */}
              <div className="shrink-0 flex items-start justify-between px-5 py-3 border-b" style={{ borderColor: "rgba(22,22,22,0.06)", background: "var(--bg-card)" }}>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Recent Rewrites</div>
                  {logLoading ? (
                    <div className="text-xs" style={{ color: "rgba(22,22,22,0.3)" }}>Loading...</div>
                  ) : logEntries.length === 0 ? (
                    <div className="text-xs" style={{ color: "rgba(22,22,22,0.3)" }}>No rewrite history</div>
                  ) : (
                    logEntries.slice(0, 5).map((entry, i) => (
                      <div key={i} className="text-xs" style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>
                        {new Date(entry.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        {" "}<span style={{ color: "rgba(22,22,22,0.3)" }}>{entry.trigger}</span>
                      </div>
                    ))
                  )}
                </div>
                <button onClick={() => setForceRewriteConfirm(true)} disabled={rewriting}
                  className="shrink-0 disabled:opacity-50"
                  style={{ borderRadius: 20, background: "#CC8A39", color: "#161616", border: "none", padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)" }}>
                  {rewriting ? <span className="flex items-center gap-2"><Spinner size={14} color="#161616" /> Updating...</span> : "Update Wyle's Knowledge"}
                </button>
              </div>

              {/* Editor content */}
              <div className="flex-1 flex min-w-0 overflow-hidden">
              {!selectedFile ? (
                <div className="flex-1 flex items-center justify-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>Select a file from the sidebar to view and edit it</p></div>
              ) : editorLoading ? (
                <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} /></div>
              ) : (
                <>
                  {/* Left column: Chat to edit (40%) */}
                  <div className="flex flex-col" style={{ flex: "0 0 40%", borderRight: "1px solid rgba(22,22,22,0.1)", background: "var(--bg-card)" }}>
                    <div className="shrink-0 px-4 py-3 border-b" style={{ borderColor: "rgba(22,22,22,0.06)" }}>
                      <h3 className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Chat to Edit</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-3">
                      {editChatHistory.length === 0 && !editStreaming && <p className="text-xs text-center py-4" style={{ color: "rgba(22,22,22,0.3)" }}>Ask Claude to make changes to this file</p>}
                      {editChatHistory.map((msg, i) => (
                        <div key={i} className={`mb-2 ${msg.role === "user" ? "flex justify-end" : ""}`}>
                          {msg.role === "user" ? (
                            <div className="inline-block max-w-[85%] px-3 py-1.5 text-xs" style={{ background: "var(--color-bark)", borderRadius: "10px 10px 2px 10px", color: "var(--color-cream)" }}>{msg.text}</div>
                          ) : (
                            <div className="text-xs" style={{ color: "rgba(22,22,22,0.55)" }}>{msg.text}</div>
                          )}
                        </div>
                      ))}
                      {editStreaming && <div className="text-xs flex items-center gap-1.5" style={{ color: "var(--color-mustard)" }}><div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} />Editing file...</div>}
                      <div ref={editChatEndRef} />
                    </div>
                    <div className="shrink-0 px-4 py-3 border-t" style={{ borderColor: "rgba(22,22,22,0.06)" }}>
                      <div className="flex gap-2">
                        <input className="flex-1 px-3 py-2 text-xs focus:outline-none transition-all"
                          style={{ borderRadius: "8px", background: "var(--color-cream)", border: "1px solid rgba(22,22,22,0.08)", color: "var(--color-onyx)" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "var(--color-mustard)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(204,138,57,0.12)"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "rgba(22,22,22,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
                          placeholder="Ask Claude to update this file..." value={editChatInput} onChange={e => setEditChatInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendEditChat(); } }} disabled={editStreaming} />
                        <button onClick={sendEditChat} disabled={editStreaming || !editChatInput.trim()} className="px-3 py-2 text-xs font-semibold disabled:opacity-40 transition-all"
                          style={{ borderRadius: "8px", background: "var(--color-mustard)", color: "var(--color-onyx)", border: "none", cursor: "pointer" }}>Send</button>
                      </div>
                    </div>
                  </div>

                  {/* Right column: File content (60%) */}
                  <div className="flex flex-col" style={{ flex: 1, minWidth: 0 }}>
                    <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(22,22,22,0.06)", background: "var(--bg-card)", boxShadow: "0 1px 3px rgba(22,22,22,0.08)" }}>
                      <h2 className="text-sm font-semibold truncate" style={{ color: "var(--color-onyx)", fontFamily: "var(--font-heading)" }}>{selectedFile.name}</h2>
                    </div>
                    {(pendingDiff || editStreaming) && (
                      <div className="shrink-0 flex items-center justify-between px-4 py-2" style={{ background: "rgba(60,59,34,0.06)", borderBottom: "1px solid rgba(22,22,22,0.08)" }}>
                        <span className="text-xs font-medium" style={{ color: "var(--color-olive)" }}>{editStreaming ? "Generating changes..." : "Review suggested changes before saving"}</span>
                        {pendingDiff && !editStreaming && (
                          <div className="flex gap-2">
                            <button onClick={rejectAllChanges} className="px-3 py-1 text-xs font-semibold transition-all" style={{ borderRadius: "6px", background: "transparent", border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", cursor: "pointer" }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-bark)"; e.currentTarget.style.color = "var(--color-bark)"; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(22,22,22,0.15)"; e.currentTarget.style.color = "rgba(22,22,22,0.5)"; }}>Reject All</button>
                            <button onClick={acceptAllChanges} disabled={saving} className="px-3 py-1 text-xs font-semibold disabled:opacity-40 transition-all"
                              style={{ borderRadius: "6px", background: "var(--color-olive)", color: "var(--color-cream)", border: "none", cursor: "pointer" }}>{saving ? "Saving\u2026" : "Accept All Changes"}</button>
                          </div>
                        )}
                      </div>
                    )}
                    {pendingDiff || editStreaming ? (
                      <div className="flex-1 p-4 overflow-auto" style={{ fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: "1.6", color: "var(--color-onyx)", background: "rgba(248,246,238,0.8)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                        dangerouslySetInnerHTML={{ __html: renderDiff(pendingDiff || "") }} />
                    ) : (
                      <textarea value={editorContent} onChange={e => setEditorContent(e.target.value)} className="flex-1 w-full p-4 resize-none focus:outline-none"
                        style={{ fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: "1.6", color: "var(--color-onyx)", background: "rgba(248,246,238,0.8)", border: "none", overflow: "auto" }} spellCheck={false} />
                    )}
                    {/* Bottom bar: Save/Cancel */}
                    <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: "rgba(22,22,22,0.06)", background: "var(--bg-card)" }}>
                      {!pendingDiff && !editStreaming && (
                        <>
                          <button onClick={cancelEdit} className="px-3 py-1.5 text-xs font-semibold transition-all" style={{ borderRadius: "6px", background: "transparent", border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", cursor: "pointer" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-bark)"; e.currentTarget.style.color = "var(--color-bark)"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(22,22,22,0.15)"; e.currentTarget.style.color = "rgba(22,22,22,0.5)"; }}>Cancel</button>
                          <button onClick={saveFile} disabled={saving || editorContent === editorOriginal} className="px-3 py-1.5 text-xs font-semibold disabled:opacity-40 transition-all"
                            style={{ borderRadius: "6px", background: "var(--color-mustard)", color: "var(--color-onyx)", border: "none", cursor: "pointer" }}>{saving ? "Saving\u2026" : "Save"}</button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
              </div>
            </div>
          </div>
        )}
        {/* ── Guide tab ── */}
        {activeTab === "guide" && (
          <GuideContent userRole={userRole as string || "user"} />
        )}
      </div>{/* end RIGHT ZONE */}

      {/* Delete conversation confirm */}
      {confirmDeleteConv && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-enter" style={{ background: "rgba(22,22,22,0.5)", zIndex: 50 }}>
          <div className="modal-enter" style={{ width: 400, background: "var(--bg-card)", borderRadius: 16, padding: "1.5rem", boxShadow: "0 8px 32px rgba(22,22,22,0.25)" }}>
            <h3 className="text-base font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Delete conversation?</h3>
            <p className="text-sm mb-4" style={{ color: "rgba(22,22,22,0.55)" }}>This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDeleteConv(null)} style={{ borderRadius: 8, background: "transparent", border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteConversation(confirmDeleteConv)} style={{ borderRadius: 8, background: "#b91c1c", color: "white", border: "none", padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Clear all confirm */}
      {confirmClearAll && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-enter" style={{ background: "rgba(22,22,22,0.5)", zIndex: 50 }}>
          <div className="modal-enter" style={{ width: 400, background: "var(--bg-card)", borderRadius: 16, padding: "1.5rem", boxShadow: "0 8px 32px rgba(22,22,22,0.25)" }}>
            <h3 className="text-base font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Delete all conversations?</h3>
            <p className="text-sm mb-4" style={{ color: "rgba(22,22,22,0.55)" }}>This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmClearAll(false)} style={{ borderRadius: 8, background: "transparent", border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={clearAllConversations} style={{ borderRadius: 8, background: "#b91c1c", color: "white", border: "none", padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Delete All</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div role="status" aria-live="polite" className="fixed bottom-14 right-6 px-4 py-2.5 text-sm font-medium shadow-lg toast-enter" style={{ borderRadius: "10px", background: "var(--color-onyx)", color: "var(--color-cream)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>{toast}</div>}

      {/* Modals */}
      {confirmRewrite && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-enter" style={{ background: "rgba(22,22,22,0.5)", zIndex: 50 }}>
          <div style={{ width: 400, background: "var(--bg-card)", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 8px 32px rgba(22,22,22,0.25)" }}>
            <h3 className="text-base font-semibold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-onyx)" }}>Trigger rewrite now?</h3>
            <p className="text-sm mb-4" style={{ color: "rgba(22,22,22,0.55)" }}>Apply your changes to the compiled knowledge base now?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmRewrite(false)} className="px-4 py-2 text-sm font-semibold transition-all" style={{ borderRadius: "8px", background: "transparent", border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", cursor: "pointer" }}>No</button>
              <button onClick={triggerRewrite} className="px-4 py-2 text-sm font-semibold transition-all" style={{ borderRadius: "8px", background: "var(--color-mustard)", color: "var(--color-onyx)", border: "none", cursor: "pointer" }}>Yes, rewrite now</button>
            </div>
          </div>
        </div>
      )}
      {kbAddConfirmRewrite && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-enter" style={{ background: "rgba(22,22,22,0.5)", zIndex: 50 }}>
          <div style={{ width: 400, background: "var(--bg-card)", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 8px 32px rgba(22,22,22,0.25)" }}>
            <h3 className="text-base font-semibold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-onyx)" }}>Trigger rewrite now to apply changes?</h3>
            <p className="text-sm mb-4" style={{ color: "rgba(22,22,22,0.55)" }}>Your update has been added. Rewrite the compiled knowledge base now to include it?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setKbAddConfirmRewrite(false)} className="px-4 py-2 text-sm font-semibold transition-all" style={{ borderRadius: "8px", background: "transparent", border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", cursor: "pointer" }}>No</button>
              <button onClick={triggerRewrite} className="px-4 py-2 text-sm font-semibold transition-all" style={{ borderRadius: "8px", background: "var(--color-mustard)", color: "var(--color-onyx)", border: "none", cursor: "pointer" }}>Yes, rewrite now</button>
            </div>
          </div>
        </div>
      )}
      {forceRewriteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-enter" style={{ background: "rgba(22,22,22,0.5)", zIndex: 50 }}>
          <div style={{ width: 400, background: "var(--bg-card)", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 8px 32px rgba(22,22,22,0.25)" }}>
            <h3 className="text-base font-semibold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-onyx)" }}>Update Wyle's Knowledge?</h3>
            <p className="text-sm mb-4" style={{ color: "rgba(22,22,22,0.55)" }}>This will rewrite and recompile Wyle's entire knowledge base. This takes 30-60 seconds. Wyle will have updated knowledge immediately after.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setForceRewriteConfirm(false)} className="px-4 py-2 text-sm font-semibold transition-all" style={{ borderRadius: "8px", background: "transparent", border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", cursor: "pointer" }}>Cancel</button>
              <button onClick={triggerRewrite} className="px-4 py-2 text-sm font-semibold transition-all" style={{ borderRadius: "8px", background: "var(--color-mustard)", color: "var(--color-onyx)", border: "none", cursor: "pointer" }}>Update Knowledge</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
