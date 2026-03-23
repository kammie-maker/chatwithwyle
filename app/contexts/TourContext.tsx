"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getStepsForRole, KB_ONBOARDING_STEPS, type TourStep } from "../components/tour/tour-steps";

interface TourAction {
  setActiveTab?: "chat" | "kb" | "guide";
  ensureSidebarOpen?: boolean;
}

interface TourContextValue {
  isTourActive: boolean;
  currentStep: number;
  steps: TourStep[];
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  tourAction: TourAction | null;
  clearTourAction: () => void;
  // KB tour
  isKbTourActive: boolean;
  kbTourStep: number;
  kbTourSteps: TourStep[];
  startKbTour: () => void;
  nextKbStep: () => void;
  prevKbStep: () => void;
  skipKbTour: () => void;
  checkAndStartKbTour: () => void;
}

const TourContext = createContext<TourContextValue>({
  isTourActive: false,
  currentStep: 0,
  steps: [],
  startTour: () => {},
  nextStep: () => {},
  prevStep: () => {},
  skipTour: () => {},
  tourAction: null,
  clearTourAction: () => {},
  isKbTourActive: false,
  kbTourStep: 0,
  kbTourSteps: [],
  startKbTour: () => {},
  nextKbStep: () => {},
  prevKbStep: () => {},
  skipKbTour: () => {},
  checkAndStartKbTour: () => {},
});

export function useTour() { return useContext(TourContext); }

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const userRole = (session?.user as Record<string, unknown>)?.role as string || "user";
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tourAction, setTourAction] = useState<TourAction | null>(null);
  const [checked, setChecked] = useState(false);

  // KB tour state
  const [isKbTourActive, setIsKbTourActive] = useState(false);
  const [kbTourStep, setKbTourStep] = useState(0);
  const [kbTourChecked, setKbTourChecked] = useState(false);

  const steps = getStepsForRole(userRole);
  const kbTourSteps = KB_ONBOARDING_STEPS;

  // Check tour status on mount
  useEffect(() => {
    if (status !== "authenticated" || checked) return;
    setChecked(true);
    fetch("/api/user/tour").then(r => r.json()).then(data => {
      if (!data.tourCompleted) {
        setTimeout(() => { setCurrentStep(0); setIsTourActive(true); }, 800);
      }
      if (data.kbTourCompleted) setKbTourChecked(true);
    }).catch(() => {});
  }, [status, checked]);

  const completeTour = useCallback(() => {
    setIsTourActive(false);
    setCurrentStep(0);
    fetch("/api/user/tour", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tourCompleted: true }) }).catch(() => {});
  }, []);

  const nextStep = useCallback(() => {
    const next = currentStep + 1;
    if (next >= steps.length) { completeTour(); return; }
    const step = steps[next];
    if (step.beforeShow) setTourAction(step.beforeShow);
    if (step.beforeShow?.setActiveTab) {
      setTimeout(() => setCurrentStep(next), 300);
    } else {
      setCurrentStep(next);
    }
  }, [currentStep, steps, completeTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      const step = steps[prev];
      if (step.beforeShow) setTourAction(step.beforeShow);
      setCurrentStep(prev);
    }
  }, [currentStep, steps]);

  const skipTour = useCallback(() => { completeTour(); }, [completeTour]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsTourActive(true);
    fetch("/api/user/tour", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tourCompleted: false }) }).catch(() => {});
  }, []);

  const clearTourAction = useCallback(() => setTourAction(null), []);

  // ── KB Tour ──
  const completeKbTour = useCallback(() => {
    setIsKbTourActive(false);
    setKbTourStep(0);
    setKbTourChecked(true);
    fetch("/api/user/tour", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kbTourCompleted: true }) }).catch(() => {});
  }, []);

  const nextKbStep = useCallback(() => {
    const next = kbTourStep + 1;
    if (next >= kbTourSteps.length) { completeKbTour(); return; }
    const step = kbTourSteps[next];
    if (step.beforeShow) setTourAction(step.beforeShow);
    if (step.beforeShow?.setActiveTab) {
      setTimeout(() => setKbTourStep(next), 300);
    } else {
      setKbTourStep(next);
    }
  }, [kbTourStep, kbTourSteps, completeKbTour]);

  const prevKbStep = useCallback(() => {
    if (kbTourStep > 0) {
      const prev = kbTourStep - 1;
      const step = kbTourSteps[prev];
      if (step.beforeShow) setTourAction(step.beforeShow);
      setKbTourStep(prev);
    }
  }, [kbTourStep, kbTourSteps]);

  const skipKbTour = useCallback(() => { completeKbTour(); }, [completeKbTour]);

  const startKbTour = useCallback(() => {
    setKbTourStep(0);
    setIsKbTourActive(true);
  }, []);

  const checkAndStartKbTour = useCallback(() => {
    if (kbTourChecked || isKbTourActive || isTourActive) return;
    setKbTourChecked(true);
    setTimeout(() => { setKbTourStep(0); setIsKbTourActive(true); }, 500);
  }, [kbTourChecked, isKbTourActive, isTourActive]);

  // Keyboard navigation
  useEffect(() => {
    if (!isTourActive && !isKbTourActive) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        if (isKbTourActive) nextKbStep();
        else nextStep();
      } else if (e.key === "ArrowLeft") {
        if (isKbTourActive) prevKbStep();
        else prevStep();
      } else if (e.key === "Escape") {
        if (isKbTourActive) skipKbTour();
        else skipTour();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isTourActive, isKbTourActive, nextStep, prevStep, skipTour, nextKbStep, prevKbStep, skipKbTour]);

  return (
    <TourContext.Provider value={{
      isTourActive, currentStep, steps, startTour, nextStep, prevStep, skipTour, tourAction, clearTourAction,
      isKbTourActive, kbTourStep, kbTourSteps, startKbTour, nextKbStep, prevKbStep, skipKbTour, checkAndStartKbTour,
    }}>
      {children}
    </TourContext.Provider>
  );
}
