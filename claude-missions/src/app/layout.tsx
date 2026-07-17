import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { AppShell } from "@/components/shell/app-shell";

// F005: single app-wide typeface, loaded via next/font (self-hosted, no
// layout shift) and applied through the --font-sans CSS variable that
// globals.css already wires into Tailwind's `font-sans`.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Adaptive Cut",
  description: "Adaptivno praćenje ishrane i mršavljenja",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
