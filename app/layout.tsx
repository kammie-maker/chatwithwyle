import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wyle — Freewyld Foundry",
  description: "AI assistant by Freewyld Foundry",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
