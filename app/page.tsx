"use client";

import React, { useState, useEffect, useRef } from "react";

interface Message { role: "user" | "assistant"; content: string }

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check auth on mount
  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(j => setAuthenticated(j.authenticated)).catch(() => setAuthenticated(false));
  }, []);

  // Auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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

  async function handleSend() {
    if (!input.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages([...updated, { role: "assistant", content: "" }]);
    setInput("");
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
      setMessages([...updated, { role: "assistant", content: "Sorry, I'm unable to respond right now. Please try again." }]);
    } finally {
      setStreaming(false);
    }
  }

  function clearConversation() { setMessages([]); }

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
            {authLoading ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    );
  }

  // ── Chat UI ──
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-cream)" }}>
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-5 py-4 border-b" style={{ background: "#ffffff", borderColor: "rgba(22,22,22,0.06)" }}>
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
        {messages.length > 0 && (
          <button onClick={clearConversation} className="text-xs font-semibold px-3 py-1.5 transition-all"
            style={{ borderRadius: "8px", background: "transparent", border: "1px solid rgba(22,22,22,0.1)", color: "rgba(22,22,22,0.4)", fontFamily: "var(--font-body)", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-mustard)"; e.currentTarget.style.color = "var(--color-mustard)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(22,22,22,0.1)"; e.currentTarget.style.color = "rgba(22,22,22,0.4)"; }}>
            Clear
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6" style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
        {messages.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(204,138,57,0.1)", borderRadius: "16px" }}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} className="w-8 h-8" style={{ color: "var(--color-mustard)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--color-onyx)" }}>How can I help?</h2>
            <p className="text-sm" style={{ color: "rgba(22,22,22,0.45)", fontFamily: "var(--font-body)", maxWidth: 400, margin: "0 auto" }}>
              Ask me anything about Freewyld Foundry, revenue management, or the short-term rental industry.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 ${msg.role === "user" ? "flex justify-end" : ""}`}>
            {msg.role === "assistant" ? (
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-7 h-7 shrink-0 flex items-center justify-center mt-0.5" style={{ background: "var(--color-mustard)", borderRadius: "8px" }}>
                  <svg fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-onyx)", fontFamily: "var(--font-body)" }}>
                  {msg.content}
                  {streaming && i === messages.length - 1 && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded" style={{ background: "var(--color-mustard)" }} />
                  )}
                </div>
              </div>
            ) : (
              <div className="inline-block max-w-[80%] px-4 py-2.5 text-sm" style={{
                background: "var(--color-mustard)", borderRadius: "16px 16px 4px 16px",
                color: "var(--color-cream)", fontFamily: "var(--font-body)",
              }}>
                {msg.content}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-4 border-t" style={{ background: "#ffffff", borderColor: "rgba(22,22,22,0.06)" }}>
        <div className="flex gap-2" style={{ maxWidth: 720, margin: "0 auto" }}>
          <input
            className="flex-1 px-4 py-3 text-sm focus:outline-none transition-all"
            style={{
              borderRadius: "12px", background: "var(--color-cream)", border: "1px solid rgba(22,22,22,0.08)",
              color: "var(--color-onyx)", fontFamily: "var(--font-body)",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--color-mustard)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(204,138,57,0.12)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(22,22,22,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
            placeholder="Ask Wyle anything…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={streaming}
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
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
  );
}
