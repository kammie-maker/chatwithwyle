"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: string; data: string } };
interface Message { role: "user" | "assistant"; content: string | ContentBlock[]; interactionMode?: InteractionMode }
interface PendingFile { name: string; base64: string; mediaType: string; preview: string | null; fileType: "image" | "pdf" | "text" }
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const ACCEPTED_TYPES = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.md,.csv";
interface KbFile { id: string; name: string; modifiedDate: string }
interface LogEntry { timestamp: string; trigger: string }
interface EditChatMsg { role: "user" | "assistant"; text: string }

type Tab = "chat" | "kb";
type ChatMode = "sales" | "client-success" | "fulfillment" | "onboarding";
type InteractionMode = "client" | "research";

const MODE_LABELS: Record<ChatMode, string> = {
  sales: "Sales Chat",
  "client-success": "Client Success Chat",
  fulfillment: "Fulfillment Chat",
  onboarding: "Onboarding Chat",
};

const MODE_QUESTIONS: Record<ChatMode, string[]> = {
  sales: [
    "How do I handle a pricing objection?",
    "Walk me through the revenue guarantee",
    "How do I respond to \u2018we already have a manager\u2019?",
    "What makes us different from other revenue managers?",
    "How do I close someone who\u2019s on the fence?",
    "What\u2019s the typical ROI for a new client?",
    "Give me a discovery question opener",
    "How do I handle \u2018I need to think about it\u2019?",
    "What\u2019s our response to a lowball counter?",
    "How do I reframe RPM value for a skeptic?",
  ],
  "client-success": [
    "How do I explain a down month to a client?",
    "What\u2019s our response to a client threatening to leave?",
    "How do I present the monthly revenue report?",
    "What do I say when a client asks why their competitor is outperforming them?",
    "How do I handle a client who wants more control?",
    "What\u2019s our escalation process for unhappy clients?",
    "How do I reframe a bad month positively?",
    "What metrics should I lead with in a client call?",
  ],
  fulfillment: [
    "What\u2019s our process for a new listing setup?",
    "How do we handle orphan nights?",
    "What\u2019s our MNS strategy for peak season?",
    "How do we approach OTA ranking optimization?",
    "What\u2019s our pricing review cadence?",
    "How do we handle a client who overrides our pricing?",
    "What\u2019s the process for a revenue audit?",
    "How do we calculate MPI for a new market?",
  ],
  onboarding: [
    "What does our first 30 days look like?",
    "What do I need from the client in week 1?",
    "How do I set revenue expectations at kickoff?",
    "What\u2019s our onboarding call agenda?",
    "How do I explain our pricing methodology to a new client?",
    "What access do we need from the client?",
    "How do we handle a client who\u2019s impatient for results in month 1?",
    "What\u2019s our communication cadence with new clients?",
  ],
};

// ── Structured response parsing ──

interface ParsedSection { key: string; label: string; content: string }
interface ParsedResponse { sections: ParsedSection[]; clarify: { question: string; options: string[] } | null; raw: string; hasStructure: boolean; hadExpandToken: boolean }

const SECTION_HEADERS = ["SIMPLE", "DEEPER", "DEEPEST", "INTERNAL FULL PICTURE", "STRATEGY", "ANSWER TO CLIENT", "PROBLEM", "OPTIONS", "RECOMMENDATION"];
const EXPAND_ORDER = ["SIMPLE", "DEEPER", "DEEPEST", "INTERNAL FULL PICTURE"];

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
  // Match ## SIMPLE, ### SIMPLE, **SIMPLE**, or standalone SIMPLE/DEEPER/etc on its own line
  const sectionNames = "SIMPLE|DEEPER|DEEPEST|INTERNAL FULL PICTURE|INTERNAL|STRATEGY|ANSWER TO CLIENT|PROBLEM|OPTIONS|RECOMMENDATION";
  const headerPattern = new RegExp("^(?:#{2,4}\\s+|\\*\\*)?(" + sectionNames + ")(?:\\*\\*)?\\s*$", "gm");
  const matches: { key: string; index: number; fullMatch: string }[] = [];
  let m;
  while ((m = headerPattern.exec(raw)) !== null) {
    const key = m[1] === "INTERNAL" ? "INTERNAL FULL PICTURE" : m[1];
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

function AssistantMessage({ text, msgIdx, isStreaming, chatMode, msgInteractionMode, inlineExpanded, expandLoading, expandingAll, onExpand, onExpandAll, onDraft, onCopyBrief, handleClarifyOption, clarifyInput, setClarifyInput }: {
  text: string; msgIdx: number; isStreaming: boolean; chatMode: ChatMode; msgInteractionMode: InteractionMode;
  inlineExpanded: Record<string, string>; expandLoading: string | undefined; expandingAll: boolean;
  onExpand: (section: string) => void; onExpandAll: () => void; onDraft: (action: string) => void; onCopyBrief: () => void;
  handleClarifyOption: (opt: string) => void;
  clarifyInput: string; setClarifyInput: (v: string) => void;
}) {
  const isResearch = msgInteractionMode === "research";
  const parsed = parseResponse(text);
  const showPills = !isStreaming && (parsed.hasStructure || parsed.hadExpandToken);

  // Clean content: strip "---" horizontal rules
  function clean(s: string) { return s.replace(/^---+$/gm, "").replace(/\u2014/g, " ").replace(/\u2013/g, " ").replace(/ {2,}/g, " ").replace(/^- /gm, "").trim(); }

  // Get SIMPLE content (first section or entire text)
  const simpleContent = clean(parsed.sections[0]?.content || text);

  // Which sections are already expanded inline
  const expandedKeys = Object.keys(inlineExpanded);
  const allExpandKeys = isResearch ? ["DEEPER", "DEEPEST"] : ["DEEPER", "DEEPEST", "INTERNAL FULL PICTURE"];
  const availablePills = allExpandKeys.filter(k => !expandedKeys.includes(k) && k !== expandLoading);

  return (
    <div className="flex gap-3 max-w-[85%]">
      <div className="w-7 h-7 shrink-0 flex items-center justify-center mt-0.5" style={{ background: "var(--color-mustard)", borderRadius: "8px" }}>
        <svg fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
      </div>
      <div style={{ color: "var(--color-onyx)", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid rgba(22,22,22,0.08)", boxShadow: "0 1px 3px rgba(22,22,22,0.08)", overflow: "hidden", minWidth: 0, position: "relative" }}>
        {isResearch && (
          <div style={{ position: "absolute", top: 8, right: 8, background: "#3c3b22", color: "#f8f6ee", fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>INTERNAL</div>
        )}
        <div className="px-4 py-3">
          {/* SIMPLE / base content */}
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{simpleContent}</div>
          {isStreaming && <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded" style={{ background: "var(--color-mustard)" }} />}

          {/* Inline expanded sections */}
          {allExpandKeys.map(k => {
            const content = inlineExpanded[k];
            if (!content && k !== expandLoading) return null;
            return (
              <div key={k} className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(22,22,22,0.08)" }}>
                <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-mustard)" }}>
                  {k === "INTERNAL FULL PICTURE" ? "INTERNAL" : k}
                </div>
                {content ? (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{clean(content)}</div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-mustard)" }}>
                    <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} />
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
                  style={{ background: "none", border: "none", padding: 0, fontSize: 13, color: "#3c3b22", cursor: "pointer", fontFamily: "var(--font-body)", textDecoration: "none" }}
                  onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                  + {k === "INTERNAL FULL PICTURE" ? "Internal" : k.charAt(0) + k.slice(1).toLowerCase()}
                </button>
              ))}
              {availablePills.length > 1 && (
                <>
                  <span style={{ color: "rgba(60,59,34,0.3)", fontSize: 13 }}>&middot;</span>
                  <button onClick={onExpandAll}
                    style={{ background: "none", border: "none", padding: 0, fontSize: 13, color: "#3c3b22", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 600, textDecoration: "none" }}
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
                  + {k === "INTERNAL FULL PICTURE" ? "Internal" : k.charAt(0) + k.slice(1).toLowerCase()}
                </span>
              ))}
              {expandingAll && !expandLoading && (
                <span style={{ fontSize: 13, color: "rgba(60,59,34,0.4)", fontFamily: "var(--font-body)" }}>Expanding all...</span>
              )}
            </div>
          )}

          {/* Action buttons */}
          {showPills && !expandLoading && (
            <div className="flex flex-wrap mt-2" style={{ gap: 8 }}>
              {isResearch ? (
                <button onClick={onCopyBrief}
                  style={{ borderRadius: 20, background: "#663925", border: "none", color: "#f8f6ee", padding: "6px 16px", fontSize: 13, cursor: "pointer", fontFamily: "var(--font-body)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(102,57,37,0.85)"}
                  onMouseLeave={e => e.currentTarget.style.background = "#663925"}>
                  Copy as Brief
                </button>
              ) : (
                MODE_ACTIONS[chatMode].map(action => (
                  <button key={action} onClick={() => onDraft(action)}
                    style={{ borderRadius: 20, background: "#663925", border: "none", color: "#f8f6ee", padding: "6px 16px", fontSize: 13, cursor: "pointer", fontFamily: "var(--font-body)" }}
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
                  <button key={oi} onClick={() => handleClarifyOption(opt)} className="px-2.5 py-1 text-[11px] font-medium transition-all"
                    style={{ borderRadius: "14px", background: "transparent", border: "1px solid var(--color-olive)", color: "var(--color-olive)", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(60,59,34,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    {opt}
                  </button>
                ))}
                <div className="flex gap-1 w-full mt-1">
                  <input className="flex-1 px-2 py-1 text-[11px] focus:outline-none" placeholder="Custom answer..."
                    style={{ borderRadius: "6px", border: "1px solid rgba(22,22,22,0.1)", background: "var(--color-cream)", color: "var(--color-onyx)" }}
                    value={clarifyInput} onChange={e => setClarifyInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && clarifyInput.trim()) { handleClarifyOption(clarifyInput.trim()); setClarifyInput(""); } }} />
                  <button onClick={() => { if (clarifyInput.trim()) { handleClarifyOption(clarifyInput.trim()); setClarifyInput(""); } }} className="px-2 py-1 text-[11px] font-semibold"
                    style={{ borderRadius: "6px", background: "var(--color-olive)", color: "var(--color-cream)", border: "none", cursor: "pointer" }}>Send</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const RESEARCH_QUESTIONS: Record<ChatMode, string[]> = {
  sales: [
    "What are the most common reasons deals stall?",
    "What objections are hardest to handle and why?",
    "What do our best closes have in common?",
    "What should I know before calling a prospect cold?",
    "What makes a prospect a bad fit for us?",
    "What's our competitive positioning?",
    "How do I know when a deal is truly dead?",
    "What does our guarantee actually cover?",
  ],
  "client-success": [
    "What are the most common reasons clients churn?",
    "What does a healthy client relationship look like?",
    "How do we handle an underperforming market?",
    "What are early warning signs a client is unhappy?",
    "How do we approach a difficult renewal conversation?",
    "What results should a client expect in month 1?",
  ],
  fulfillment: [
    "What are the most common pricing mistakes we see?",
    "How do we approach a market we've never managed?",
    "What does a full portfolio audit look like?",
    "When should we push back on a client override?",
    "What's our process for a new listing launch?",
  ],
  onboarding: [
    "What do new clients most commonly misunderstand?",
    "What sets up a client relationship for long-term success?",
    "What should we accomplish in the first 30 days?",
    "What are common onboarding mistakes to avoid?",
    "How do we set revenue expectations without overpromising?",
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
  const { status } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [chatMode, setChatMode] = useState<ChatMode>("sales");
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("client");
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  // Per-message inline expanded sections: msgIndex -> { sectionKey: content }
  const [inlineExpanded, setInlineExpanded] = useState<Record<number, Record<string, string>>>({});
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

  // Auth handled by NextAuth middleware — no manual check needed
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (activeTab === "kb") { loadKbFiles(); loadLog(); } }, [activeTab]);
  useEffect(() => {
    function handleClick(e: MouseEvent) { if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) setModeDropdownOpen(false); }
    if (modeDropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modeDropdownOpen]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  function switchMode(mode: ChatMode) { if (mode === chatMode) { setModeDropdownOpen(false); return; } setChatMode(mode); setMessages([]); setInput(""); setPendingFiles([]); setModeDropdownOpen(false); setToast(`Switched to ${MODE_LABELS[mode]}`); }

  function autoResizeTextarea() { const el = textareaRef.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 200) + "px"; }

  function cleanResponse(text: string): string {
    return text.replace(/\u2014/g, " ").replace(/\u2013/g, " ").replace(/ {2,}/g, " ");
  }

  async function sendMessage(text: string) {
    if (!text.trim() && pendingFiles.length === 0) return; if (streaming) return;
    let userContent: string | ContentBlock[];
    if (pendingFiles.length > 0) { const blocks: ContentBlock[] = []; for (const f of pendingFiles) { if (f.fileType === "image") blocks.push({ type: "image", source: { type: "base64", media_type: f.mediaType, data: f.base64 } }); else if (f.fileType === "pdf") blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.base64 } }); else { const decoded = atob(f.base64); blocks.push({ type: "text", text: `--- ${f.name} ---\n${decoded}` }); } } if (text.trim()) blocks.push({ type: "text", text: text.trim() }); userContent = blocks; } else { userContent = text.trim(); }
    const userMsg: Message = { role: "user", content: userContent }; const updated = [...messages, userMsg]; setMessages([...updated, { role: "assistant", content: "", interactionMode }]); setInput(""); setPendingFiles([]); if (textareaRef.current) textareaRef.current.style.height = "auto"; setStreaming(true);
    try { const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: updated, mode: chatMode, interactionMode }) }); if (!res.body) throw new Error("No response body"); const reader = res.body.getReader(); const decoder = new TextDecoder(); let fullText = ""; while (true) { const { done, value } = await reader.read(); if (done) break; fullText += decoder.decode(value, { stream: true }); setMessages([...updated, { role: "assistant", content: fullText, interactionMode }]); } fullText = cleanResponse(fullText); setMessages([...updated, { role: "assistant", content: fullText, interactionMode }]); } catch { setMessages([...updated, { role: "assistant", content: "Sorry, I'm unable to respond right now. Please try again.", interactionMode }]); } finally { setStreaming(false); }
  }
  function handleSend() { sendMessage(input); }
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) { const fileList = e.target.files; if (!fileList) return; const files = Array.from(fileList); if (pendingFiles.length + files.length > 10) { setToast("Maximum 10 files at once"); e.target.value = ""; return; } for (const file of files) { if (file.size > 10 * 1024 * 1024) { setToast(`${file.name} exceeds 10MB limit`); continue; } const isImage = IMAGE_TYPES.includes(file.type); const isPdf = file.type === "application/pdf"; const isText = /\.(txt|md|csv)$/i.test(file.name); if (!isImage && !isPdf && !isText) continue; const reader = new FileReader(); reader.onload = () => { const result = reader.result as string; const base64 = result.split(",")[1]; const preview = isImage ? result : null; const fileType: PendingFile["fileType"] = isImage ? "image" : isPdf ? "pdf" : "text"; setPendingFiles(prev => prev.length >= 10 ? prev : [...prev, { name: file.name, base64, mediaType: file.type, preview, fileType }]); }; reader.readAsDataURL(file); } e.target.value = ""; }
  function removePendingFile(index: number) { setPendingFiles(prev => prev.filter((_, i) => i !== index)); }
  function clearConversation() { setMessages([]); setInlineExpanded({}); setExpandLoading({}); setExpandingAll({}); }

  async function expandSectionInline(msgIdx: number, sectionKey: string) {
    if (expandLoading[msgIdx]) return; // already loading something for this msg

    // Find the original user question and assistant response for context
    const assistantMsg = messages[msgIdx];
    const userMsg = msgIdx > 0 ? messages[msgIdx - 1] : null;
    if (!assistantMsg || !userMsg) return;

    setExpandLoading(prev => ({ ...prev, [msgIdx]: sectionKey }));

    try {
      const contextMessages = [
        { role: userMsg.role, content: userMsg.content },
        { role: assistantMsg.role, content: assistantMsg.content },
        { role: "user", content: `Give me only the ${sectionKey} section. No SIMPLE section. Start directly with the ## ${sectionKey} header.` }
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: contextMessages, mode: chatMode, interactionMode }),
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
    } finally {
      setExpandLoading(prev => { const copy = { ...prev }; delete copy[msgIdx]; return copy; });
    }
  }

  async function expandAllInline(msgIdx: number) {
    const isResearch = interactionMode === "research";
    const allKeys = isResearch ? ["DEEPER", "DEEPEST"] : ["DEEPER", "DEEPEST", "INTERNAL FULL PICTURE"];
    const existing = inlineExpanded[msgIdx] || {};
    const remaining = allKeys.filter(k => !existing[k]);
    if (remaining.length === 0) return;

    setExpandingAll(prev => ({ ...prev, [msgIdx]: true }));
    for (const key of remaining) {
      await expandSectionInline(msgIdx, key);
    }
    setExpandingAll(prev => { const copy = { ...prev }; delete copy[msgIdx]; return copy; });
  }

  function handleDraftAction(msgIdx: number) {
    // Build context from all visible sections for this message
    const msg = messages[msgIdx];
    if (!msg) return;
    const baseText = typeof msg.content === "string" ? msg.content : "";
    const expanded = inlineExpanded[msgIdx] || {};
    const allContent = [baseText, ...Object.values(expanded)].join("\n\n");
    return allContent;
  }

  function sendDraftAction(action: string, msgIdx: number) {
    const context = handleDraftAction(msgIdx);
    sendMessage(`Draft a ${action.toLowerCase()} based on this response:\n\n${context}`);
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
  async function triggerRewrite() { setRewriting(true); setConfirmRewrite(false); setForceRewriteConfirm(false); setKbAddConfirmRewrite(false); try { const res = await fetch("/api/kb-rewrite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "", trigger: "manual" }) }); const data = await res.json(); if (data.error) throw new Error(data.error); setToast("Rewrite complete"); loadLog(); } catch { setToast("Rewrite failed"); } finally { setRewriting(false); } }
  async function handleAddToKb() { if (!kbAddText.trim() || kbAdding) return; setKbAdding(true); try { const res = await fetch("/api/kb-update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: kbAddText.trim() }) }); const data = await res.json(); if (data.error) throw new Error(data.error); setKbAddText(""); setToast("Added to knowledge base"); setKbAddConfirmRewrite(true); } catch { setToast("Failed to add to knowledge base"); } finally { setKbAdding(false); } }

  // ── Loading (session check) ──
  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-onyx)" }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} />
    </div>
  );

  // ── Main app ──
  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg-content)" }}>
      {/* ── Header ── */}
      <header className="shrink-0 flex items-center justify-between px-5" style={{ height: 60, background: "var(--bg-header)", borderBottom: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 2px 8px rgba(22,22,22,0.2)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ background: "var(--color-mustard)", borderRadius: "8px" }}>
            <svg fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2} className="w-4.5 h-4.5" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h1 className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-cream)" }}>Wyle</h1>
          {/* Tabs */}
          <div className="flex gap-1 ml-6">
            {(["chat", "kb"] as Tab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className="px-3 py-1.5 text-xs font-medium transition-all"
                style={{ borderRadius: "6px", background: activeTab === tab ? "rgba(255,255,255,0.12)" : "transparent", color: activeTab === tab ? "var(--color-cream)" : "rgba(237,233,225,0.5)", border: "none", cursor: "pointer", fontFamily: "var(--font-body)" }}>
                {tab === "chat" ? "Chat" : "Knowledge Base"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "chat" && messages.length > 0 && (
            <button onClick={clearConversation} className="text-xs font-medium px-3 py-1.5 transition-all"
              style={{ borderRadius: "6px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(237,233,225,0.5)", fontFamily: "var(--font-body)", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-mustard)"; e.currentTarget.style.color = "var(--color-mustard)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "rgba(237,233,225,0.5)"; }}>
              Clear
            </button>
          )}
          <button onClick={() => signOut()} className="text-xs font-medium px-3 py-1.5 transition-all"
            style={{ borderRadius: "6px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(237,233,225,0.35)", fontFamily: "var(--font-body)", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.color = "rgba(237,233,225,0.6)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(237,233,225,0.35)"; }}>
            Sign out
          </button>
        </div>
      </header>

      {/* ── Chat tab ── */}
      {activeTab === "chat" && (
        <>
          {/* Interaction mode toggle — fixed at top center */}
          <div className="shrink-0 flex justify-center py-2" style={{ background: "var(--bg-content)" }}>
            <div style={{ display: "flex", gap: 2, background: "rgba(22,22,22,0.04)", borderRadius: 20, padding: 4 }}>
              <button onClick={() => setInteractionMode("client")}
                style={{ fontSize: 13, fontWeight: 600, padding: "4px 14px", borderRadius: 16, border: "none", cursor: "pointer", fontFamily: "var(--font-body)",
                  background: interactionMode === "client" ? "#3c3b22" : "transparent",
                  color: interactionMode === "client" ? "#f8f6ee" : "rgba(22,22,22,0.4)" }}>
                Client Interaction
              </button>
              <button onClick={() => setInteractionMode("research")}
                style={{ fontSize: 13, fontWeight: 600, padding: "4px 14px", borderRadius: 16, border: "none", cursor: "pointer", fontFamily: "var(--font-body)",
                  background: interactionMode === "research" ? "#3c3b22" : "transparent",
                  color: interactionMode === "research" ? "#f8f6ee" : "rgba(22,22,22,0.4)" }}>
                Internal Research
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6" style={{ maxWidth: 860, margin: "0 auto", width: "100%" }}>
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(204,138,57,0.1)", borderRadius: "16px" }}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} className="w-8 h-8" style={{ color: "var(--color-mustard)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-onyx)" }}>How can I help?</h2>
                <p className="text-sm mb-8" style={{ color: "rgba(22,22,22,0.45)", maxWidth: 400, margin: "0 auto" }}>Ask me anything about Freewyld Foundry, revenue management, or the short-term rental industry.</p>
                <div className="grid grid-cols-2 gap-2 text-left" style={{ maxWidth: 560, margin: "0 auto" }}>
                  {(interactionMode === "research" ? RESEARCH_QUESTIONS : MODE_QUESTIONS)[chatMode].map((q, i) => (
                    <button key={i} onClick={() => sendMessage(q)} disabled={streaming} className="px-3 py-2.5 text-xs text-left transition-all"
                      style={{ borderRadius: "10px", background: "transparent", border: "1px solid var(--color-olive)", color: "var(--color-olive)", cursor: "pointer", lineHeight: "1.4" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(60,59,34,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => {
              const contentBlocks = Array.isArray(msg.content) ? msg.content : null;
              const textBlocks = contentBlocks ? contentBlocks.filter((b): b is { type: "text"; text: string } => b.type === "text") : [];
              const userText = contentBlocks ? textBlocks.filter(b => !b.text.startsWith("--- ")).map(b => b.text).join("\n") : (msg.content as string);
              const fileTextBlocks = contentBlocks ? textBlocks.filter(b => b.text.startsWith("--- ")) : [];
              const imageBlocks = contentBlocks ? contentBlocks.filter((b): b is ContentBlock & { type: "image" } => b.type === "image") : [];
              const docBlocks = contentBlocks ? contentBlocks.filter((b): b is ContentBlock & { type: "document" } => b.type === "document") : [];
              const hasMedia = imageBlocks.length > 0 || docBlocks.length > 0 || fileTextBlocks.length > 0;
              return (
                <div key={i} className={`mb-4 ${msg.role === "user" ? "flex justify-end" : ""}`}>
                  {msg.role === "assistant" ? (
                    <AssistantMessage text={userText} msgIdx={i} isStreaming={streaming && i === messages.length - 1} chatMode={chatMode}
                      msgInteractionMode={msg.interactionMode || "client"}
                      inlineExpanded={inlineExpanded[i] || {}} expandLoading={expandLoading[i]} expandingAll={!!expandingAll[i]}
                      onExpand={(section) => expandSectionInline(i, section)} onExpandAll={() => expandAllInline(i)}
                      onDraft={(action) => sendDraftAction(action, i)}
                      onCopyBrief={() => { const ctx = handleDraftAction(i); if (ctx) { navigator.clipboard.writeText(ctx); setToast("Copied to clipboard"); } }}
                      handleClarifyOption={handleClarifyOption} clarifyInput={clarifyInput} setClarifyInput={setClarifyInput} />
                  ) : (
                    <div className="inline-block max-w-[80%] text-sm" style={{ background: "var(--color-bark)", borderRadius: "16px 16px 4px 16px", color: "var(--color-cream)", padding: hasMedia ? "0.5rem" : undefined }}>
                      {imageBlocks.map((img, j) => <img key={j} src={`data:${img.source.media_type};base64,${img.source.data}`} alt="Uploaded" style={{ maxWidth: 200, borderRadius: "10px", display: "block", marginBottom: "0.5rem" }} />)}
                      {docBlocks.map((_, j) => <div key={`doc-${j}`} className="flex items-center gap-1.5 px-2 py-1 mb-1" style={{ background: "rgba(255,255,255,0.15)", borderRadius: "6px", fontSize: "11px" }}><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>PDF</div>)}
                      {fileTextBlocks.map((ftb, j) => { const fname = ftb.text.match(/^--- (.+?) ---/)?.[1] || "file"; return <div key={`ftb-${j}`} className="flex items-center gap-1.5 px-2 py-1 mb-1" style={{ background: "rgba(255,255,255,0.15)", borderRadius: "6px", fontSize: "11px" }}><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>{fname}</div>; })}
                      {userText && <div style={{ padding: hasMedia ? "0 0.5rem 0.5rem" : "0.625rem 1rem" }}>{userText}</div>}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          {/* Input area */}
          <div className="shrink-0 px-4 py-4 border-t" style={{ background: "var(--bg-card)", borderColor: "rgba(22,22,22,0.08)" }}>
            <div style={{ maxWidth: 860, margin: "0 auto" }}>
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
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(22,22,22,0.08)"; e.currentTarget.style.color = "var(--color-olive)"; }} title="Attach files">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                </button>
                <textarea ref={textareaRef} className="flex-1 px-4 py-3 text-sm focus:outline-none transition-all" rows={1}
                  style={{ borderRadius: "12px", background: "var(--bg-card)", border: "1px solid rgba(22,22,22,0.08)", color: "var(--color-onyx)", resize: "none", overflow: "hidden", maxHeight: 200 }}
                  onFocus={e => { e.currentTarget.style.borderColor = "var(--color-mustard)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(204,138,57,0.12)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(22,22,22,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
                  placeholder="Ask Wyle anything..." value={input} onChange={e => { setInput(e.target.value); autoResizeTextarea(); }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} disabled={streaming} />
                <button onClick={handleSend} disabled={streaming || (!input.trim() && pendingFiles.length === 0)} className="px-5 py-3 text-sm font-semibold disabled:opacity-40 transition-all"
                  style={{ borderRadius: "12px", background: "var(--color-mustard)", color: "var(--color-onyx)", border: "none", cursor: "pointer", minHeight: 44 }}>
                  Send
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Knowledge Base tab ── */}
      {activeTab === "kb" && (
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar: Source Files */}
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
          <div className="flex-1 flex min-w-0">
            {!selectedFile ? (
              <div className="flex-1 flex items-center justify-center"><p className="text-sm" style={{ color: "rgba(22,22,22,0.35)" }}>Select a file from the sidebar to view and edit it</p></div>
            ) : editorLoading ? (
              <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} /></div>
            ) : (
              <>
                {/* Left column: Chat to edit (40%) */}
                <div className="flex flex-col" style={{ flex: "0 0 40%", borderRight: "1px solid rgba(22,22,22,0.1)", background: "var(--bg-card)" }}>
                  <div className="shrink-0 px-4 py-3 border-b" style={{ borderColor: "rgba(22,22,22,0.06)" }}>
                    <h3 className="text-xs font-semibold" style={{ color: "rgba(22,22,22,0.45)" }}>Chat to Edit</h3>
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
      )}

      {/* ── Footer ── */}
      <footer className="shrink-0 flex items-center justify-center" style={{ height: 40, background: "var(--bg-footer)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <p className="text-xs" style={{ color: "rgba(237,233,225,0.4)" }}>Wyle — Freewyld Foundry Internal Tool</p>
      </footer>

      {/* Toast */}
      {toast && <div className="fixed bottom-14 right-6 px-4 py-2.5 text-sm font-medium shadow-lg" style={{ borderRadius: "10px", background: "var(--color-onyx)", color: "var(--color-cream)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>{toast}</div>}

      {/* Modals */}
      {confirmRewrite && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(22,22,22,0.5)", zIndex: 50 }}>
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
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(22,22,22,0.5)", zIndex: 50 }}>
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
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(22,22,22,0.5)", zIndex: 50 }}>
          <div style={{ width: 400, background: "var(--bg-card)", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 8px 32px rgba(22,22,22,0.25)" }}>
            <h3 className="text-base font-semibold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-onyx)" }}>Force rewrite?</h3>
            <p className="text-sm mb-4" style={{ color: "rgba(22,22,22,0.55)" }}>This will recompile the entire knowledge base from all source files. It may take a few minutes.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setForceRewriteConfirm(false)} className="px-4 py-2 text-sm font-semibold transition-all" style={{ borderRadius: "8px", background: "transparent", border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", cursor: "pointer" }}>Cancel</button>
              <button onClick={triggerRewrite} className="px-4 py-2 text-sm font-semibold transition-all" style={{ borderRadius: "8px", background: "var(--color-bark)", color: "var(--color-cream)", border: "none", cursor: "pointer" }}>Rewrite now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
