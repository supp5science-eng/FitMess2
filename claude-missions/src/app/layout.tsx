import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { AppShell } from "@/components/shell/app-shell";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

// F005: single app-wide typeface, loaded via next/font (self-hosted, no
// layout shift) and applied through the --font-sans CSS variable that
// globals.css already wires into Tailwind's `font-sans`.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const APP_NAME = "FitMess";
const APP_DESCRIPTION =
  "Adaptivno praćenje ishrane na srpskom. Nedelja je jedinica uspeha — jedan loš obrok te ne ruši.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: "FitMess — dijeta koja ti oprašta",
    template: "%s · FitMess",
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
