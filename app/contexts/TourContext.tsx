"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getStepsForRole, type TourStep } from "../components/tour/tour-steps";

interface TourAction {
  setActiveTab?: "chat" | "kb" | "guide";
  ensureSidebarOpen?: boolean;
}

interface TourContextValue {
  isTourActive: boolean;
  isTransitioning: boolean;
  currentStep: number;
  steps: TourStep[];
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  tourAction: TourAction | null;
  clearTourAction: () => void;
}

const TourContext = createContext<TourContextValue>({
  isTourActive: false,
  isTransitioning: false,
  currentStep: 0,
  steps: [],
  startTour: () => {},
  nextStep: () => {},
  prevStep: () => {},
  skipTour: () => {},
  tourAction: null,
  clearTourAction: () => {},
});

export function useTour() { return useContext(TourContext); }

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const userRole = (session?.user as Record<string, unknown>)?.role as string || "user";
  const [isTourActive, setIsTourActive] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tourAction, setTourAction] = useState<TourAction | null>(null);
  const [checked, setChecked] = useState(false);

  const steps = getStepsForRole(userRole);

  // Check tour status on mount
  useEffect(() => {
    if (status !== "authenticated" || checked) return;
    setChecked(true);
    fetch("/api/user/tour").then(r => r.json()).then(data => {
      if (!data.tourCompleted) {
        setTimeout(() => { setCurrentStep(0); setIsTourActive(true); }, 800);
      }
    }).catch(() => {});
  }, [status, checked]);

  const completeTour = useCallback(() => {
    setIsTourActive(false);
    setIsTransitioning(false);
    setCurrentStep(0);
    fetch("/api/user/tour", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tourCompleted: true }) }).catch(() => {});
  }, []);

  // Transition helper: hide tooltip, wait for DOM to settle, then show new step
  const transitionToStep = useCallback((idx: number, delay = 100) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(idx);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsTransitioning(false);
        });
      });
    }, delay);
  }, []);

  const nextStep = useCallback(() => {
    const next = currentStep + 1;
    if (next >= steps.length) { completeTour(); return; }
    const step = steps[next];
    if (step.beforeShow) setTourAction(step.beforeShow);
    const delay = step.beforeShow?.setActiveTab ? 300 : 100;
    transitionToStep(next, delay);
  }, [currentStep, steps, completeTour, transitionToStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      const step = steps[prev];
      if (step.beforeShow) setTourAction(step.beforeShow);
      transitionToStep(prev, 100);
    }
  }, [currentStep, steps, transitionToStep]);

  const skipTour = useCallback(() => { completeTour(); }, [completeTour]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsTourActive(true);
    fetch("/api/user/tour", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tourCompleted: false }) }).catch(() => {});
  }, []);

  const clearTourAction = useCallback(() => setTourAction(null), []);

  // Keyboard navigation
  useEffect(() => {
    if (!isTourActive) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "Enter") nextStep();
      else if (e.key === "ArrowLeft") prevStep();
      else if (e.key === "Escape") skipTour();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isTourActive, nextStep, prevStep, skipTour]);

  // Dev shortcut: Cmd+Shift+Y to reset and restart tour
  useEffect(() => {
    function handleDevKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Y") {
        e.preventDefault();
        console.log("🎯 Tour reset — Cmd+Shift+Y — Dev mode only");
        startTour();
      }
    }
    document.addEventListener("keydown", handleDevKey);
    return () => document.removeEventListener("keydown", handleDevKey);
  }, [startTour]);

  return (
    <TourContext.Provider value={{ isTourActive, isTransitioning, currentStep, steps, startTour, nextStep, prevStep, skipTour, tourAction, clearTourAction }}>
      {children}
    </TourContext.Provider>
  );
}
