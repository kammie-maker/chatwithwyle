"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInContent() {
  const params = useSearchParams();
  const error = params.get("error");

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--color-onyx)" }}>
      <div className="w-full max-w-sm text-center" style={{
        background: "rgba(60,59,34,0.3)", borderRadius: "16px", padding: "2.5rem 2rem",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)", border: "1px solid rgba(237,233,225,0.15)",
      }}>
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4" style={{ width: 56, height: 56 }}>
          <rect width="100" height="100" rx="20" fill="#CC8A39"/><rect width="100" height="100" rx="20" fill="#663925" opacity="0.12"/>
          <text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="58" fontWeight="700" fill="#3c3b22">W</text>
          <text x="50" y="84" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fontWeight="600" fill="#3c3b22" letterSpacing="3" opacity="0.85">WYLE</text>
        </svg>
        <h1 className="text-2xl font-semibold mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-cream)" }}>Wyle</h1>
        <p className="text-sm mb-8" style={{ color: "var(--color-mustard)", fontFamily: "var(--font-body)" }}>Freewyld Foundry AI Assistant</p>

        {error && (
          <div className="mb-4 px-4 py-3 text-sm" style={{ borderRadius: "10px", background: "rgba(180,30,30,0.15)", color: "#f87171", border: "1px solid rgba(180,30,30,0.3)" }}>
            {error === "AccessDenied"
              ? "Access restricted to Freewyld team members (@freewyld.com)"
              : error === "Suspended"
              ? "Your Wyle access has been suspended. Contact your admin."
              : error === "NoAccess"
              ? "You don't have access to Wyle yet. Contact your admin to get set up."
              : "Sign in failed. Please try again."}
          </div>
        )}

        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full py-3 text-sm font-semibold transition-all flex items-center justify-center gap-3"
          style={{
            borderRadius: "10px", background: "var(--color-mustard)", color: "var(--color-onyx)",
            border: "none", fontFamily: "var(--font-body)", cursor: "pointer",
          }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

        <p className="text-xs mt-6" style={{ color: "rgba(237,233,225,0.35)" }}>
          Restricted to @freewyld.com accounts
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-onyx)" }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-mustard)", borderTopColor: "transparent" }} />
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
