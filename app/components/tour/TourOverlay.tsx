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

function ExpandIllustration() {
  return (
    <div style={{ marginBottom: 16, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: 16, background: "#fafaf6", textAlign: "left" }}>
      <svg viewBox="0 0 400 130" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%" }}>
        <rect width="400" height="130" rx="8" fill="white" stroke="rgba(22,22,22,0.08)" strokeWidth="1" />
        <rect x="16" y="14" width="240" height="6" rx="2" fill="rgba(22,22,22,0.1)" />
        <rect x="16" y="26" width="340" height="6" rx="2" fill="rgba(22,22,22,0.07)" />
        <rect x="16" y="38" width="180" height="6" rx="2" fill="rgba(22,22,22,0.07)" />
        <line x1="16" y1="56" x2="384" y2="56" stroke="rgba(22,22,22,0.06)" strokeWidth="1" />
        <text x="16" y="74" fontFamily="sans-serif" fontSize="11" fill={C.olive}>+ More Detail</text>
        <text x="112" y="74" fontFamily="sans-serif" fontSize="11" fill={C.olive}>+ Full Script</text>
        <text x="200" y="74" fontFamily="sans-serif" fontSize="11" fill={C.olive}>+ Rep Notes</text>
        <text x="280" y="74" fontFamily="sans-serif" fontSize="11" fontWeight="600" fill={C.olive}>Expand All</text>
        <rect x="16" y="88" width="68" height="22" rx="11" fill={C.bark} />
        <text x="50" y="102" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={C.cream}>Draft Text</text>
        <rect x="90" y="88" width="72" height="22" rx="11" fill={C.bark} />
        <text x="126" y="102" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={C.cream}>Draft Email</text>
        <rect x="168" y="88" width="86" height="22" rx="11" fill={C.bark} />
        <text x="211" y="102" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={C.cream}>Draft Voicemail</text>
      </svg>
    </div>
  );
}

// ── Always-mounted modal layer ──
function TourModal({ visible, step, stepNum, totalSteps, onNext, onPrev, onSkip }: {
  visible: boolean; step: { id: string; title: string; content: string } | null;
  stepNum: number; totalSteps: number;
  onNext: () => void; onPrev: () => void; onSkip: () => void;
}) {
  const isWelcome = step?.id === "welcome";
  const isCompletion = step?.id === "completion";
  const isExpand = step?.id === "expand-info";

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.7)",
      opacity: visible ? 1 : 0,
      visibility: visible ? "visible" : "hidden",
      pointerEvents: visible ? "all" : "none",
      transition: "opacity 200ms ease, visibility 200ms ease",
    }}>
      <div style={{
        width: isWelcome || isCompletion ? 480 : isExpand ? 460 : 400,
        maxWidth: "calc(100vw - 32px)", background: "white", borderRadius: 16,
        padding: isWelcome || isCompletion ? "40px" : "24px 28px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.3)", textAlign: "center",
        transform: visible ? "scale(1)" : "scale(0.96)",
        transition: "transform 200ms ease",
      }}>
        {(isWelcome || isCompletion) && <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><WyleAvatar /></div>}
        {isExpand && <ExpandIllustration />}
        <h2 style={{ fontSize: isWelcome || isCompletion ? 24 : 18, fontFamily: "Georgia, serif", fontWeight: 600, color: C.onyx, marginBottom: 8 }}>{step?.title}</h2>
        <p style={{ fontSize: isWelcome ? 15 : 14, color: "#555", lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: isWelcome ? 8 : 20 }}>{step?.content}</p>
        {isWelcome && <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>This quick tour walks you through everything you need. Takes about 2 minutes.</p>}
        {isWelcome ? (
          <>
            <button onClick={onNext} style={{ width: "100%", height: 48, borderRadius: 10, background: C.mustard, color: C.onyx, border: "none", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)" }}>Let&apos;s Go</button>
            <button onClick={onSkip} style={{ background: "none", border: "none", color: "#aaa", fontSize: 13, cursor: "pointer", marginTop: 12, fontFamily: "var(--font-body)" }}>Skip Tour</button>
          </>
        ) : isCompletion ? (
          <button onClick={onSkip} style={{ width: "100%", height: 48, borderRadius: 10, background: C.mustard, color: C.onyx, border: "none", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)" }}>Start Chatting</button>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#aaa" }}>Step {stepNum} of {totalSteps}</span>
            <div style={{ display: "flex", gap: 8 }}>
              {stepNum > 1 && <button onClick={onPrev} style={{ height: 36, padding: "0 16px", borderRadius: 8, background: "transparent", border: "1px solid rgba(0,0,0,0.15)", color: "#555", fontSize: 14, cursor: "pointer" }}>Back</button>}
              <button onClick={onNext} style={{ height: 36, padding: "0 16px", borderRadius: 8, background: C.mustard, color: C.onyx, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Always-mounted tooltip layer ──
function TourTooltip({ visible, step, stepNum, totalSteps, isLast, targetRect, onNext, onPrev, onSkip }: {
  visible: boolean; step: { title: string; content: string; placement: string } | null;
  stepNum: number; totalSteps: number; isLast: boolean; targetRect: DOMRect | null;
  onNext: () => void; onPrev: () => void; onSkip: () => void;
}) {
  // Position calculation
  let tooltipStyle: React.CSSProperties = { position: "fixed", zIndex: 10002, width: 300 };
  let arrowStyle: React.CSSProperties = {};

  if (targetRect && step) {
    const gap = 12; const tw = 300; const th = 180; const pad = 10;
    const vw = window.innerWidth; const vh = window.innerHeight;
    const preferred = step.placement;
    const spaceRight = vw - targetRect.right - gap - pad;
    const spaceLeft = targetRect.left - gap - pad;
    const spaceAbove = targetRect.top - gap - pad;
    const spaceBelow = vh - targetRect.bottom - gap - pad;

    let chosen: string = preferred === "center" ? "top" : preferred;
    if (chosen === "right" && spaceRight < tw) chosen = spaceLeft >= tw ? "left" : spaceAbove >= th ? "top" : "bottom";
    else if (chosen === "left" && spaceLeft < tw) chosen = spaceRight >= tw ? "right" : spaceAbove >= th ? "top" : "bottom";
    else if (chosen === "top" && spaceAbove < th) chosen = spaceBelow >= th ? "bottom" : spaceRight >= tw ? "right" : "left";
    else if (chosen === "bottom" && spaceBelow < th) chosen = spaceAbove >= th ? "top" : spaceRight >= tw ? "right" : "left";

    const clampY = (y: number) => Math.max(16, Math.min(y, vh - th - 16));
    const clampX = (x: number) => Math.max(16, Math.min(x, vw - tw - 16));
    const arrowSize = 8;

    if (chosen === "top") {
      tooltipStyle = { ...tooltipStyle, bottom: vh - targetRect.top + gap + pad, left: clampX(targetRect.left) };
      arrowStyle = { position: "absolute", bottom: -arrowSize, left: 24, width: 0, height: 0, borderLeft: `${arrowSize}px solid transparent`, borderRight: `${arrowSize}px solid transparent`, borderTop: `${arrowSize}px solid white` };
    } else if (chosen === "bottom") {
      tooltipStyle = { ...tooltipStyle, top: targetRect.bottom + gap + pad, left: clampX(targetRect.left) };
      arrowStyle = { position: "absolute", top: -arrowSize, left: 24, width: 0, height: 0, borderLeft: `${arrowSize}px solid transparent`, borderRight: `${arrowSize}px solid transparent`, borderBottom: `${arrowSize}px solid white` };
    } else if (chosen === "right") {
      tooltipStyle = { ...tooltipStyle, top: clampY(targetRect.top - pad), left: targetRect.right + gap + pad };
      arrowStyle = { position: "absolute", left: -arrowSize, top: 16, width: 0, height: 0, borderTop: `${arrowSize}px solid transparent`, borderBottom: `${arrowSize}px solid transparent`, borderRight: `${arrowSize}px solid white` };
    } else if (chosen === "left") {
      tooltipStyle = { ...tooltipStyle, top: clampY(targetRect.top - pad), left: Math.max(16, targetRect.left - gap - pad - tw) };
      arrowStyle = { position: "absolute", right: -arrowSize, top: 16, width: 0, height: 0, borderTop: `${arrowSize}px solid transparent`, borderBottom: `${arrowSize}px solid transparent`, borderLeft: `${arrowSize}px solid white` };
    }
  }

  return (
    <div style={{
      ...tooltipStyle, background: "white", borderRadius: 12, padding: "20px 24px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      opacity: visible && targetRect ? 1 : 0,
      visibility: visible && targetRect ? "visible" : "hidden",
      pointerEvents: visible && targetRect ? "all" : "none",
      transition: "opacity 200ms ease, visibility 200ms ease",
    }}>
      <div style={arrowStyle} />
      <h3 style={{ fontSize: 16, fontFamily: "Georgia, serif", fontWeight: 600, color: C.onyx, marginBottom: 6 }}>{step?.title}</h3>
      <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 16 }}>{step?.content}</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#aaa" }}>Step {stepNum} of {totalSteps}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={onSkip} style={{ background: "none", border: "none", color: "#bbb", fontSize: 12, cursor: "pointer", padding: "4px 8px" }}>Skip</button>
          {stepNum > 2 && <button onClick={onPrev} style={{ height: 36, padding: "0 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(0,0,0,0.15)", color: "#555", fontSize: 13, cursor: "pointer" }}>Back</button>}
          <button onClick={onNext} style={{ height: 36, padding: "0 14px", borderRadius: 8, background: C.mustard, color: C.onyx, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main overlay — both layers always mounted ──
export default function TourOverlay() {
  const { isTourActive, currentStep, steps, nextStep, prevStep, skipTour,
    isKbTourActive, kbTourStep, kbTourSteps, nextKbStep, prevKbStep, skipKbTour } = useTour();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const prevTargetRef = useRef<Element | null>(null);

  // Use KB tour values when KB tour is active, otherwise main tour
  const activeTour = isKbTourActive;
  const activeStep = activeTour ? kbTourStep : currentStep;
  const activeSteps = activeTour ? kbTourSteps : steps;
  const activeNext = activeTour ? nextKbStep : nextStep;
  const activePrev = activeTour ? prevKbStep : prevStep;
  const activeSkip = activeTour ? skipKbTour : skipTour;
  const isActive = isTourActive || isKbTourActive;

  const step = activeSteps[activeStep];
  const isModal = step?.isModal;
  const isTooltip = step && !isModal;
  const isLast = activeStep === activeSteps.length - 1;

  // Measure target element for tooltip steps
  const measureTarget = useCallback(() => {
    if (!step || isModal) {
      if (prevTargetRef.current) { prevTargetRef.current.classList.remove("tour-spotlight-target"); prevTargetRef.current = null; }
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
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
    if (!isActive) {
      if (prevTargetRef.current) { prevTargetRef.current.classList.remove("tour-spotlight-target"); prevTargetRef.current = null; }
      setTargetRect(null);
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
  }, [isActive, activeStep, measureTarget]);

  useEffect(() => {
    return () => { if (prevTargetRef.current) prevTargetRef.current.classList.remove("tour-spotlight-target"); };
  }, []);

  if (!isActive) return null;

  // Spotlight cutout for tooltip steps
  const padding = 10;
  const spotStyle: React.CSSProperties = targetRect && isTooltip ? {
    position: "fixed",
    top: targetRect.top - padding, left: targetRect.left - padding,
    width: targetRect.width + padding * 2, height: targetRect.height + padding * 2,
    borderRadius: 10, boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
    zIndex: 10000, pointerEvents: "none", transition: "all 200ms ease",
  } : {};

  return (
    <>
      {/* Backdrop for tooltip steps — always mounted, visible only for tooltip steps */}
      <div className="tour-backdrop" style={{
        background: isTooltip && targetRect ? "transparent" : "transparent",
        opacity: isTooltip ? 1 : 0,
        visibility: isTooltip ? "visible" : "hidden",
        pointerEvents: isTooltip ? "all" : "none",
      }} onClick={activeSkip} />

      {/* Spotlight cutout */}
      {targetRect && isTooltip && <div style={spotStyle} />}

      {/* Tooltip — always mounted, shown via CSS */}
      <TourTooltip
        visible={!!isTooltip}
        step={step || null}
        stepNum={activeStep + 1}
        totalSteps={activeSteps.length}
        isLast={isLast}
        targetRect={targetRect}
        onNext={activeNext}
        onPrev={activePrev}
        onSkip={activeSkip}
      />

      {/* Modal — always mounted, shown via CSS */}
      <TourModal
        visible={!!isModal}
        step={step || null}
        stepNum={activeStep + 1}
        totalSteps={activeSteps.length}
        onNext={activeNext}
        onPrev={activePrev}
        onSkip={activeSkip}
      />
    </>
  );
}
