"use client";

import React, { useState, useEffect, useRef } from "react";

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };
interface Message { role: "user" | "assistant"; content: string | ContentBlock[] }
interface KbFile { id: string; name: string; modifiedDate: string }
interface LogEntry { timestamp: string; trigger: string }

type Tab = "chat" | "kb";

const STARTER_QUESTIONS = [
  "How do I handle a pricing objection?",
  "Walk me through the revenue guarantee",
  "What\u2019s our onboarding process?",
  "How do I respond to \u2018we already have a manager\u2019?",
  "What makes us different from other revenue managers?",
  "How do I explain RPM to a new lead?",
  "What\u2019s the typical ROI for a new client?",
  "How do I handle a client who wants to cancel?",
  "What does our first 30 days look like?",
  "How do I close someone who\u2019s on the fence?",
];

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Tab
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image upload state
  const [pendingImage, setPendingImage] = useState<{ base64: string; mediaType: string; preview: string } | null>(null);

  // KB state
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

  // KB add-to-kb state
  const [kbAddText, setKbAddText] = useState("");
  const [kbAdding, setKbAdding] = useState(false);
  const [kbAddConfirmRewrite, setKbAddConfirmRewrite] = useState(false);

  // Check auth on mount
  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(j => setAuthenticated(j.authenticated)).catch(() => setAuthenticated(false));
  }, []);

  // Auto-scroll chat
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Load KB data when switching to KB tab
  useEffect(() => {
    if (activeTab === "kb" && authenticated) {
      loadKbFiles();
      loadLog();
    }
  }, [activeTab, authenticated]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (res.ok) { setAuthenticated(true); }
      else { setAuthError("Incorrect password"); }
    } catch { setAuthError("Connection error"); }
    finally { setAuthLoading(false); }
  }

  async function sendMessage(text: string, image?: { base64: string; mediaType: string; preview: string } | null) {
    if ((!text.trim() && !image) || streaming) return;
    const attachedImage = image || pendingImage;

    // Build user message content
    let userContent: string | ContentBlock[];
    if (attachedImage) {
      const blocks: ContentBlock[] = [
        { type: "image", source: { type: "base64", media_type: attachedImage.mediaType, data: attachedImage.base64 } },
      ];
      if (text.trim()) blocks.push({ type: "text", text: text.trim() });
      userContent = blocks;
    } else {
      userContent = text.trim();
    }

    const userMsg: Message = { role: "user", content: userContent };
    const updated = [...messages, userMsg];
    setMessages([...updated, { role: "assistant", content: "" }]);
    setInput("");
    setPendingImage(null);
    setStreaming(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMessages([...updated, { role: "assistant", content: fullText }]);
      }
    } catch {
      setMessages([...updated, { role: "assistant", content: "Sorry, I\u2019m unable to respond right now. Please try again." }]);
    } finally {
      setStreaming(false);
    }
  }

  function handleSend() { sendMessage(input); }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setToast("Image must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setPendingImage({ base64, mediaType: file.type, preview: result });
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  }

  function clearConversation() { setMessages([]); }

  // KB functions
  async function loadKbFiles() {
    setKbFilesLoading(true);
    try {
      const res = await fetch("/api/kb-files");
      const data = await res.json();
      setKbFiles(data.files || []);
    } catch { setKbFiles([]); }
    finally { setKbFilesLoading(false); }
  }

  async function loadLog() {
    setLogLoading(true);
    try {
      const res = await fetch("/api/kb-log");
      const data = await res.json();
      setLogEntries((data.rewrites || []).slice(0, 10));
    } catch { setLogEntries([]); }
    finally { setLogLoading(false); }
  }

  async function openFile(file: KbFile) {
    setSelectedFile(file);
    setEditorLoading(true);
    try {
      const res = await fetch(`/api/kb-file?fileId=${encodeURIComponent(file.id)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEditorContent(data.content || "");
      setEditorOriginal(data.content || "");
    } catch (err) {
      setToast("Failed to load file");
      setSelectedFile(null);
    } finally {
      setEditorLoading(false);
    }
  }

  async function saveFile() {
    if (!selectedFile) return;
    setSaving(true);
    try {
      const res = await fetch("/api/kb-file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: selectedFile.id, content: editorContent }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEditorOriginal(editorContent);
      setToast("File saved");
      setConfirmRewrite(true);
      loadKbFiles();
    } catch {
      setToast("Save failed");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setSelectedFile(null);
    setEditorContent("");
    setEditorOriginal("");
  }

  async function triggerRewrite() {
    setRewriting(true);
    setConfirmRewrite(false);
    setForceRewriteConfirm(false);
    setKbAddConfirmRewrite(false);
    try {
      const res = await fetch("/api/kb-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "", trigger: "manual" }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setToast("Rewrite complete");
      loadLog();
    } catch {
      setToast("Rewrite failed");
    } finally {
      setRewriting(false);
    }
  }

  async function handleAddToKb() {
    if (!kbAddText.trim() || kbAdding) return;
    setKbAdding(true);
    try {
      const res = await fetch("/api/kb-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: kbAddText.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setKbAddText("");
      setToast("Added to knowledge base");
      setKbAddConfirmRewrite(true);
    } catch {
      setToast("Failed to add to knowledge base");
    } finally {
      setKbAdding(false);
    }
  }

  // ── Loading state ──
  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-cream)" }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  // ── Password gate ──
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--color-cream)" }}>
        <form onSubmit={handleLogin} className="w-full max-w-sm text-center" style={{
          background: "#ffffff", borderRadius: "16px", padding: "2.5rem 2rem",
          boxShadow: "0 4px 24px rgba(22,22,22,0.08)", border: "1px solid rgba(22,22,22,0.06)",
        }}>
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--color-mustard)", borderRadius: "12px" }}>
            <svg fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2} className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)", color: "var(--color-onyx)" }}>Wyle</h1>
          <p className="text-sm mb-6" style={{ color: "rgba(22,22,22,0.5)", fontFamily: "var(--font-body)" }}>Freewyld Foundry AI Assistant</p>

          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full px-4 py-3 text-sm mb-3 focus:outline-none transition-all"
            style={{
              borderRadius: "10px", background: "var(--color-cream)", border: "1px solid rgba(22,22,22,0.1)",
              color: "var(--color-onyx)", fontFamily: "var(--font-body)",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--color-mustard)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(204,138,57,0.15)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(22,22,22,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
            autoFocus
          />

          {authError && <p className="text-sm mb-3" style={{ color: "var(--color-bark)", fontFamily: "var(--font-body)" }}>{authError}</p>}

          <button type="submit" disabled={authLoading || !password}
            className="w-full py-3 text-sm font-semibold disabled:opacity-50 transition-all"
            style={{
              borderRadius: "10px", background: "var(--color-mustard)", color: "var(--color-cream)",
              border: "none", fontFamily: "var(--font-body)", cursor: "pointer",
            }}>
            {authLoading ? "Checking\u2026" : "Enter"}
          </button>
        </form>
      </div>
    );
  }

  // ── Main app ──
  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--color-cream)" }}>
      {/* Header with tabs */}
      <header className="shrink-0 border-b" style={{ background: "#ffffff", borderColor: "rgba(22,22,22,0.06)" }}>
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ background: "var(--color-mustard)", borderRadius: "10px" }}>
              <svg fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-onyx)" }}>Wyle</h1>
              <p className="text-xs" style={{ color: "rgba(22,22,22,0.4)", fontFamily: "var(--font-body)" }}>Freewyld Foundry AI</p>
            </div>
          </div>
          {activeTab === "chat" && messages.length > 0 && (
            <button onClick={clearConversation} className="text-xs font-semibold px-3 py-1.5 transition-all"
              style={{ borderRadius: "8px", background: "transparent", border: "1px solid rgba(22,22,22,0.1)", color: "rgba(22,22,22,0.4)", fontFamily: "var(--font-body)", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-mustard)"; e.currentTarget.style.color = "var(--color-mustard)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(22,22,22,0.1)"; e.currentTarget.style.color = "rgba(22,22,22,0.4)"; }}>
              Clear
            </button>
          )}
        </div>
        {/* Tabs */}
        <div className="flex px-5 gap-1" style={{ fontFamily: "var(--font-body)" }}>
          {(["chat", "kb"] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-sm font-semibold transition-all"
              style={{
                borderRadius: "8px 8px 0 0",
                background: activeTab === tab ? "var(--color-olive)" : "transparent",
                color: activeTab === tab ? "var(--color-cream)" : "rgba(22,22,22,0.45)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {tab === "chat" ? "Chat" : "Knowledge Base"}
            </button>
          ))}
        </div>
      </header>

      {/* Chat tab */}
      {activeTab === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-6" style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(204,138,57,0.1)", borderRadius: "16px" }}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} className="w-8 h-8" style={{ color: "var(--color-mustard)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--color-onyx)" }}>How can I help?</h2>
                <p className="text-sm mb-8" style={{ color: "rgba(22,22,22,0.45)", fontFamily: "var(--font-body)", maxWidth: 400, margin: "0 auto" }}>
                  Ask me anything about Freewyld Foundry, revenue management, or the short-term rental industry.
                </p>
                {/* Starter questions */}
                <div className="grid grid-cols-2 gap-2 text-left" style={{ maxWidth: 560, margin: "0 auto" }}>
                  {STARTER_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      disabled={streaming}
                      className="px-3 py-2.5 text-xs text-left transition-all"
                      style={{
                        borderRadius: "10px",
                        background: "transparent",
                        border: "1px solid var(--color-bark)",
                        color: "var(--color-bark)",
                        fontFamily: "var(--font-body)",
                        cursor: "pointer",
                        lineHeight: "1.4",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(204,138,57,0.1)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => {
              // Extract text and image from message content
              const contentBlocks = Array.isArray(msg.content) ? msg.content : null;
              const textContent = contentBlocks
                ? (contentBlocks.find((b): b is { type: "text"; text: string } => b.type === "text")?.text || "")
                : (msg.content as string);
              const imageBlock = contentBlocks
                ? contentBlocks.find((b): b is ContentBlock & { type: "image" } => b.type === "image")
                : null;

              return (
              <div key={i} className={`mb-4 ${msg.role === "user" ? "flex justify-end" : ""}`}>
                {msg.role === "assistant" ? (
                  <div className="flex gap-3 max-w-[85%]">
                    <div className="w-7 h-7 shrink-0 flex items-center justify-center mt-0.5" style={{ background: "var(--color-mustard)", borderRadius: "8px" }}>
                      <svg fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2} className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-onyx)", fontFamily: "var(--font-body)" }}>
                      {textContent}
                      {streaming && i === messages.length - 1 && (
                        <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded" style={{ background: "var(--color-mustard)" }} />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="inline-block max-w-[80%] text-sm" style={{
                    background: "var(--color-mustard)", borderRadius: "16px 16px 4px 16px",
                    color: "var(--color-cream)", fontFamily: "var(--font-body)",
                    padding: imageBlock ? "0.5rem" : undefined,
                  }}>
                    {imageBlock && (
                      <img
                        src={`data:${imageBlock.source.media_type};base64,${imageBlock.source.data}`}
                        alt="Uploaded"
                        style={{ maxWidth: 200, borderRadius: "10px", display: "block", marginBottom: textContent ? "0.5rem" : 0 }}
                      />
                    )}
                    {textContent && (
                      <div style={{ padding: imageBlock ? "0 0.5rem 0.5rem" : "0.625rem 1rem" }}>{textContent}</div>
                    )}
                  </div>
                )}
              </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="shrink-0 px-4 py-4 border-t" style={{ background: "#ffffff", borderColor: "rgba(22,22,22,0.06)" }}>
            <div style={{ maxWidth: 720, margin: "0 auto" }}>
              {/* Image preview */}
              {pendingImage && (
                <div className="mb-2 flex items-start gap-2">
                  <div className="relative inline-block">
                    <img src={pendingImage.preview} alt="Preview" style={{ maxWidth: 120, maxHeight: 80, borderRadius: "8px", display: "block" }} />
                    <button
                      onClick={() => setPendingImage(null)}
                      className="absolute flex items-center justify-center"
                      style={{
                        top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
                        background: "var(--color-onyx)", color: "var(--color-cream)",
                        border: "2px solid #ffffff", cursor: "pointer", fontSize: "11px", lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      &times;
                    </button>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={streaming}
                  className="shrink-0 flex items-center justify-center disabled:opacity-40 transition-all"
                  style={{
                    width: 44, height: 44, borderRadius: "12px",
                    background: "var(--color-cream)", border: "1px solid rgba(22,22,22,0.08)",
                    cursor: "pointer", color: "rgba(22,22,22,0.4)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-mustard)"; e.currentTarget.style.color = "var(--color-mustard)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(22,22,22,0.08)"; e.currentTarget.style.color = "rgba(22,22,22,0.4)"; }}
                  title="Attach image"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                  </svg>
                </button>
                <input
                  className="flex-1 px-4 py-3 text-sm focus:outline-none transition-all"
                  style={{
                    borderRadius: "12px", background: "var(--color-cream)", border: "1px solid rgba(22,22,22,0.08)",
                    color: "var(--color-onyx)", fontFamily: "var(--font-body)",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "var(--color-mustard)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(204,138,57,0.12)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(22,22,22,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
                  placeholder="Ask Wyle anything\u2026"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  disabled={streaming}
                />
                <button
                  onClick={handleSend}
                  disabled={streaming || (!input.trim() && !pendingImage)}
                  className="px-5 py-3 text-sm font-semibold disabled:opacity-40 transition-all"
                  style={{
                    borderRadius: "12px", background: "var(--color-mustard)", color: "var(--color-cream)",
                    border: "none", fontFamily: "var(--font-body)", cursor: "pointer",
                  }}>
                  Send
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Knowledge Base tab */}
      {activeTab === "kb" && (
        <div className="flex-1 flex overflow-hidden" style={{ fontFamily: "var(--font-body)" }}>
          {/* Panel 1: Source Files */}
          <div className="shrink-0 flex flex-col border-r" style={{ width: 260, borderColor: "rgba(22,22,22,0.06)" }}>
            <div className="shrink-0 px-4 py-3 border-b" style={{ borderColor: "rgba(22,22,22,0.06)" }}>
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-onyx)", fontFamily: "var(--font-display)" }}>Source Files</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {kbFilesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} />
                </div>
              ) : kbFiles.length === 0 ? (
                <p className="text-xs px-4 py-4" style={{ color: "rgba(22,22,22,0.4)" }}>No source files found</p>
              ) : (
                kbFiles.map(file => (
                  <button
                    key={file.id}
                    onClick={() => openFile(file)}
                    className="w-full text-left px-4 py-3 transition-all"
                    style={{
                      background: selectedFile?.id === file.id ? "rgba(60,59,34,0.08)" : "transparent",
                      cursor: "pointer",
                      border: "none",
                      borderBottom: "1px solid rgba(22,22,22,0.04)",
                    }}
                    onMouseEnter={e => { if (selectedFile?.id !== file.id) e.currentTarget.style.background = "rgba(22,22,22,0.03)"; }}
                    onMouseLeave={e => { if (selectedFile?.id !== file.id) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div className="text-sm font-medium truncate" style={{ color: "var(--color-onyx)" }}>{file.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: "rgba(22,22,22,0.4)" }}>
                      {new Date(file.modifiedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Panel 2: Editor + Add to KB */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Editor area */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {!selectedFile ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm" style={{ color: "rgba(22,22,22,0.35)" }}>Select a file to edit</p>
                </div>
              ) : editorLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} />
                </div>
              ) : (
                <>
                  <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(22,22,22,0.06)" }}>
                    <h2 className="text-sm font-semibold truncate" style={{ color: "var(--color-onyx)", fontFamily: "var(--font-display)" }}>{selectedFile.name}</h2>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 text-xs font-semibold transition-all"
                        style={{
                          borderRadius: "6px", background: "transparent",
                          border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)",
                          cursor: "pointer",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-bark)"; e.currentTarget.style.color = "var(--color-bark)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(22,22,22,0.15)"; e.currentTarget.style.color = "rgba(22,22,22,0.5)"; }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveFile}
                        disabled={saving || editorContent === editorOriginal}
                        className="px-3 py-1.5 text-xs font-semibold disabled:opacity-40 transition-all"
                        style={{
                          borderRadius: "6px", background: "var(--color-mustard)",
                          color: "var(--color-cream)", border: "none", cursor: "pointer",
                        }}
                      >
                        {saving ? "Saving\u2026" : "Save"}
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={editorContent}
                    onChange={e => setEditorContent(e.target.value)}
                    className="flex-1 w-full p-4 resize-none focus:outline-none"
                    style={{
                      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                      fontSize: "13px",
                      lineHeight: "1.6",
                      color: "var(--color-onyx)",
                      background: "var(--color-cream)",
                      border: "none",
                    }}
                    spellCheck={false}
                  />
                </>
              )}
            </div>

            {/* Add to Knowledge Base section */}
            <div className="shrink-0 border-t px-4 py-4" style={{ borderColor: "rgba(22,22,22,0.06)" }}>
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--color-onyx)", fontFamily: "var(--font-display)" }}>Add to Knowledge Base</h3>
              <textarea
                value={kbAddText}
                onChange={e => setKbAddText(e.target.value)}
                placeholder="Type new knowledge, corrections, or updates here..."
                className="w-full p-3 text-sm resize-none focus:outline-none transition-all"
                style={{
                  borderRadius: "10px",
                  background: "#ffffff",
                  border: "1px solid rgba(22,22,22,0.1)",
                  color: "var(--color-onyx)",
                  fontFamily: "var(--font-body)",
                  height: 80,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "var(--color-mustard)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(204,138,57,0.12)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(22,22,22,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleAddToKb}
                  disabled={kbAdding || !kbAddText.trim()}
                  className="px-4 py-2 text-xs font-semibold disabled:opacity-40 transition-all"
                  style={{
                    borderRadius: "8px", background: "var(--color-mustard)",
                    color: "var(--color-cream)", border: "none", cursor: "pointer",
                  }}
                >
                  {kbAdding ? "Adding\u2026" : "Add to Knowledge Base"}
                </button>
              </div>
            </div>
          </div>

          {/* Panel 3: Rewrite Log */}
          <div className="shrink-0 flex flex-col border-l" style={{ width: 280, borderColor: "rgba(22,22,22,0.06)" }}>
            <div className="shrink-0 px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(22,22,22,0.06)" }}>
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-onyx)", fontFamily: "var(--font-display)" }}>Rewrite Log</h2>
              <button
                onClick={() => setForceRewriteConfirm(true)}
                disabled={rewriting}
                className="px-2.5 py-1 text-xs font-semibold disabled:opacity-40 transition-all"
                style={{
                  borderRadius: "6px", background: "var(--color-bark)",
                  color: "var(--color-cream)", border: "none", cursor: "pointer",
                }}
              >
                {rewriting ? "Rewriting\u2026" : "Force Rewrite Now"}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {logLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} />
                </div>
              ) : logEntries.length === 0 ? (
                <p className="text-xs px-4 py-4" style={{ color: "rgba(22,22,22,0.4)" }}>No rewrite history</p>
              ) : (
                logEntries.map((entry, i) => (
                  <div key={i} className="px-4 py-3 border-b" style={{ borderColor: "rgba(22,22,22,0.04)" }}>
                    <div className="text-xs font-medium" style={{ color: "var(--color-onyx)" }}>
                      {new Date(entry.timestamp).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "rgba(22,22,22,0.45)" }}>
                      Trigger: {entry.trigger}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-2.5 text-sm font-medium shadow-lg" style={{
          borderRadius: "10px", background: "var(--color-onyx)", color: "var(--color-cream)",
          fontFamily: "var(--font-body)",
        }}>
          {toast}
        </div>
      )}

      {/* Confirm rewrite after save */}
      {confirmRewrite && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(22,22,22,0.4)", zIndex: 50 }}>
          <div style={{
            width: 400, background: "#ffffff", borderRadius: "16px",
            padding: "1.5rem", boxShadow: "0 8px 32px rgba(22,22,22,0.15)",
          }}>
            <h3 className="text-base font-semibold mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--color-onyx)" }}>
              Trigger rewrite now?
            </h3>
            <p className="text-sm mb-4" style={{ color: "rgba(22,22,22,0.55)" }}>
              Apply your changes to the compiled knowledge base now?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmRewrite(false)}
                className="px-4 py-2 text-sm font-semibold transition-all"
                style={{
                  borderRadius: "8px", background: "transparent",
                  border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", cursor: "pointer",
                }}
              >
                No
              </button>
              <button
                onClick={triggerRewrite}
                className="px-4 py-2 text-sm font-semibold transition-all"
                style={{
                  borderRadius: "8px", background: "var(--color-mustard)",
                  color: "var(--color-cream)", border: "none", cursor: "pointer",
                }}
              >
                Yes, rewrite now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm rewrite after KB add */}
      {kbAddConfirmRewrite && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(22,22,22,0.4)", zIndex: 50 }}>
          <div style={{
            width: 400, background: "#ffffff", borderRadius: "16px",
            padding: "1.5rem", boxShadow: "0 8px 32px rgba(22,22,22,0.15)",
          }}>
            <h3 className="text-base font-semibold mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--color-onyx)" }}>
              Trigger rewrite now to apply changes?
            </h3>
            <p className="text-sm mb-4" style={{ color: "rgba(22,22,22,0.55)" }}>
              Your update has been added. Rewrite the compiled knowledge base now to include it?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setKbAddConfirmRewrite(false)}
                className="px-4 py-2 text-sm font-semibold transition-all"
                style={{
                  borderRadius: "8px", background: "transparent",
                  border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", cursor: "pointer",
                }}
              >
                No
              </button>
              <button
                onClick={triggerRewrite}
                className="px-4 py-2 text-sm font-semibold transition-all"
                style={{
                  borderRadius: "8px", background: "var(--color-mustard)",
                  color: "var(--color-cream)", border: "none", cursor: "pointer",
                }}
              >
                Yes, rewrite now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Force rewrite confirm */}
      {forceRewriteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(22,22,22,0.4)", zIndex: 50 }}>
          <div style={{
            width: 400, background: "#ffffff", borderRadius: "16px",
            padding: "1.5rem", boxShadow: "0 8px 32px rgba(22,22,22,0.15)",
          }}>
            <h3 className="text-base font-semibold mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--color-onyx)" }}>
              Force rewrite?
            </h3>
            <p className="text-sm mb-4" style={{ color: "rgba(22,22,22,0.55)" }}>
              This will recompile the entire knowledge base from all source files. It may take a few minutes.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setForceRewriteConfirm(false)}
                className="px-4 py-2 text-sm font-semibold transition-all"
                style={{
                  borderRadius: "8px", background: "transparent",
                  border: "1px solid rgba(22,22,22,0.15)", color: "rgba(22,22,22,0.5)", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={triggerRewrite}
                className="px-4 py-2 text-sm font-semibold transition-all"
                style={{
                  borderRadius: "8px", background: "var(--color-bark)",
                  color: "var(--color-cream)", border: "none", cursor: "pointer",
                }}
              >
                Rewrite now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
