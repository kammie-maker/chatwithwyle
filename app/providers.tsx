"use client";

import { SessionProvider } from "next-auth/react";
import { TourProvider } from "./contexts/TourContext";
import TourOverlay from "./components/tour/TourOverlay";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TourProvider>
        {children}
        <TourOverlay />
      </TourProvider>
    </SessionProvider>
  );
}
