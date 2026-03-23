"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTour } from "../../contexts/TourContext";

const C = { onyx: "#161616", mustard: "#CC8A39", olive: "#3c3b22", cream: "#f8f6ee", bark: "#663925" };

function WyleAvatar({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: size, height: size }}>
      <rect width="100" height="100" rx="20" fill={C.mustard} /><rect width="100" height="100" rx="20" fill={C.bark} opacity="0.12" />
      <text x="50" y="67" textAnchor="middle" fontFamily="Georgia, serif" fontSize="58" fontWeight="700" fill={C.olive}>W</text>
      <text x="50" y="83" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fontWeight="600" fill={C.olive} letterSpacing="3" opacity="0.85">WYLE</text>
    </svg>
  );
}

export default function TourOverlay() {
  const { isTourActive, currentStep, steps, nextStep, prevStep, skipTour } = useTour();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const prevTargetRef = useRef<Element | null>(null);

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const isWelcome = step?.id === "welcome";
  const isCompletion = step?.id === "completion";
  const isModal = step?.isModal;

  // Find and measure target element
  const measureTarget = useCallback(() => {
    if (!step || isModal) { setTargetRect(null); return; }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
      // Add spotlight class
      if (prevTargetRef.current && prevTargetRef.current !== el) {
        prevTargetRef.current.classList.remove("tour-spotlight-target");
      }
      el.classList.add("tour-spotlight-target");
      prevTargetRef.current = el;
    } else {
      setTargetRect(null);
    }
  }, [step, isModal]);

  useEffect(() => {
    if (!isTourActive) {
      if (prevTargetRef.current) { prevTargetRef.current.classList.remove("tour-spotlight-target"); prevTargetRef.current = null; }
      return;
    }
    measureTarget();
    const interval = setInterval(measureTarget, 300);
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [isTourActive, currentStep, measureTarget]);

  // Cleanup spotlight class on unmount
  useEffect(() => {
    return () => { if (prevTargetRef.current) prevTargetRef.current.classList.remove("tour-spotlight-target"); };
  }, []);

  if (!isTourActive || !step) return null;

  // ── Modal rendering (welcome, completion, info steps) ──
  if (isModal) {
    return (
      <div className="tour-backdrop" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)" }}>
        <div className="tour-tooltip-enter" style={{ width: isWelcome || isCompletion ? 480 : 400, maxWidth: "calc(100vw - 32px)", background: "white", borderRadius: 16, padding: isWelcome || isCompletion ? "40px" : "24px 28px", boxShadow: "0 8px 40px rgba(0,0,0,0.3)", textAlign: "center" }}>
          {(isWelcome || isCompletion) && <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><WyleAvatar /></div>}
          <h2 style={{ fontSize: isWelcome || isCompletion ? 24 : 18, fontFamily: "Georgia, serif", fontWeight: 600, color: C.onyx, marginBottom: 8 }}>{step.title}</h2>
          <p style={{ fontSize: isWelcome ? 15 : 14, color: "#555", lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: isWelcome ? 8 : 20 }}>{step.content}</p>
          {isWelcome && <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>This quick tour walks you through everything you need. Takes about 2 minutes.</p>}
          {isWelcome ? (
            <>
              <button onClick={nextStep} style={{ width: "100%", height: 48, borderRadius: 10, background: C.mustard, color: C.onyx, border: "none", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)" }}>Let&apos;s Go</button>
              <button onClick={skipTour} style={{ background: "none", border: "none", color: "#aaa", fontSize: 13, cursor: "pointer", marginTop: 12, fontFamily: "var(--font-body)" }}>Skip Tour</button>
            </>
          ) : isCompletion ? (
            <button onClick={skipTour} style={{ width: "100%", height: 48, borderRadius: 10, background: C.mustard, color: C.onyx, border: "none", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)" }}>Start Chatting</button>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#aaa" }}>Step {currentStep + 1} of {steps.length}</span>
              <div style={{ display: "flex", gap: 8 }}>
                {currentStep > 0 && <button onClick={prevStep} style={{ height: 36, padding: "0 16px", borderRadius: 8, background: "transparent", border: "1px solid rgba(0,0,0,0.15)", color: "#555", fontSize: 14, cursor: "pointer" }}>Back</button>}
                <button onClick={nextStep} style={{ height: 36, padding: "0 16px", borderRadius: 8, background: C.mustard, color: C.onyx, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Spotlight + tooltip rendering ──
  const padding = 8;
  const spotStyle: React.CSSProperties = targetRect ? {
    position: "fixed",
    top: targetRect.top - padding,
    left: targetRect.left - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
    borderRadius: 10,
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
    zIndex: 10000,
    pointerEvents: "none",
    transition: "all 200ms ease",
  } : {};

  // Calculate tooltip position
  let tooltipStyle: React.CSSProperties = {};
  let arrowStyle: React.CSSProperties = {};
  let arrowDir: "top" | "bottom" | "left" | "right" = "top";

  if (targetRect) {
    const gap = 12;
    const tw = 300;
    const placement = step.placement;

    if (placement === "top") {
      tooltipStyle = { position: "fixed", bottom: window.innerHeight - targetRect.top + gap + padding, left: Math.max(16, Math.min(targetRect.left, window.innerWidth - tw - 16)), width: tw, zIndex: 10002 };
      arrowDir = "bottom";
    } else if (placement === "bottom") {
      tooltipStyle = { position: "fixed", top: targetRect.bottom + gap + padding, left: Math.max(16, Math.min(targetRect.left, window.innerWidth - tw - 16)), width: tw, zIndex: 10002 };
      arrowDir = "top";
    } else if (placement === "right") {
      tooltipStyle = { position: "fixed", top: Math.max(16, targetRect.top - padding), left: targetRect.right + gap + padding, width: tw, zIndex: 10002 };
      arrowDir = "left";
    } else if (placement === "left") {
      tooltipStyle = { position: "fixed", top: Math.max(16, targetRect.top - padding), right: window.innerWidth - targetRect.left + gap + padding, width: tw, zIndex: 10002 };
      arrowDir = "right";
    }

    // Arrow
    const arrowSize = 8;
    if (arrowDir === "bottom") arrowStyle = { position: "absolute", bottom: -arrowSize, left: 24, width: 0, height: 0, borderLeft: `${arrowSize}px solid transparent`, borderRight: `${arrowSize}px solid transparent`, borderTop: `${arrowSize}px solid white` };
    if (arrowDir === "top") arrowStyle = { position: "absolute", top: -arrowSize, left: 24, width: 0, height: 0, borderLeft: `${arrowSize}px solid transparent`, borderRight: `${arrowSize}px solid transparent`, borderBottom: `${arrowSize}px solid white` };
    if (arrowDir === "left") arrowStyle = { position: "absolute", left: -arrowSize, top: 16, width: 0, height: 0, borderTop: `${arrowSize}px solid transparent`, borderBottom: `${arrowSize}px solid transparent`, borderRight: `${arrowSize}px solid white` };
    if (arrowDir === "right") arrowStyle = { position: "absolute", right: -arrowSize, top: 16, width: 0, height: 0, borderTop: `${arrowSize}px solid transparent`, borderBottom: `${arrowSize}px solid transparent`, borderLeft: `${arrowSize}px solid white` };
  }

  return (
    <>
      {/* Backdrop — click to skip */}
      <div className="tour-backdrop" style={{ background: "transparent" }} onClick={skipTour} />
      {/* Spotlight cutout */}
      {targetRect && <div style={spotStyle} />}
      {/* Outline on target */}
      {targetRect && (
        <div style={{ position: "fixed", top: targetRect.top - padding, left: targetRect.left - padding, width: targetRect.width + padding * 2, height: targetRect.height + padding * 2, borderRadius: 10, border: `3px solid ${C.mustard}`, zIndex: 10001, pointerEvents: "none", transition: "all 200ms ease" }} />
      )}
      {/* Tooltip */}
      {targetRect && (
        <div ref={tooltipRef} className="tour-tooltip-enter" style={{ ...tooltipStyle, background: "white", borderRadius: 12, padding: "20px 24px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
          <div style={arrowStyle} />
          <h3 style={{ fontSize: 16, fontFamily: "Georgia, serif", fontWeight: 600, color: C.onyx, marginBottom: 6 }}>{step.title}</h3>
          <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 16 }}>{step.content}</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#aaa" }}>Step {currentStep + 1} of {steps.length}</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={skipTour} style={{ background: "none", border: "none", color: "#bbb", fontSize: 12, cursor: "pointer", padding: "4px 8px" }}>Skip</button>
              {currentStep > 1 && <button onClick={prevStep} style={{ height: 36, padding: "0 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(0,0,0,0.15)", color: "#555", fontSize: 13, cursor: "pointer" }}>Back</button>}
              <button onClick={nextStep} style={{ height: 36, padding: "0 14px", borderRadius: 8, background: C.mustard, color: C.onyx, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {isLast ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Fallback: target not found, show as centered card */}
      {!targetRect && !isModal && (
        <div className="tour-backdrop" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
          <div className="tour-tooltip-enter" style={{ width: 380, maxWidth: "calc(100vw - 32px)", background: "white", borderRadius: 12, padding: "24px 28px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <h3 style={{ fontSize: 16, fontFamily: "Georgia, serif", fontWeight: 600, color: C.onyx, marginBottom: 6 }}>{step.title}</h3>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 16 }}>{step.content}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#aaa" }}>Step {currentStep + 1} of {steps.length}</span>
              <div style={{ display: "flex", gap: 8 }}>
                {currentStep > 1 && <button onClick={prevStep} style={{ height: 36, padding: "0 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(0,0,0,0.15)", color: "#555", fontSize: 13, cursor: "pointer" }}>Back</button>}
                <button onClick={nextStep} style={{ height: 36, padding: "0 14px", borderRadius: 8, background: C.mustard, color: C.onyx, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Next</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
