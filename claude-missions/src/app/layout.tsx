import type { Metadata, Viewport } from "next";
import { Inter, Archivo_Black } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

import { AppShell } from "@/components/shell/app-shell";
import { HapticProvider } from "@/components/pwa/haptic-provider";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { resolveTheme, THEME_COOKIE } from "@/lib/theme/theme";

// F005: single app-wide typeface, loaded via next/font (self-hosted, no
// layout shift) and applied through the --font-sans CSS variable that
// globals.css already wires into Tailwind's `font-sans`.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

// Display face for the FitMess wordmark only (heavy, geometric). Archivo Black
// ships a single weight (400 = black); exposed via --font-display and applied
// locally where the brand lockup renders -- body copy stays on Inter.
const archivoBlack = Archivo_Black({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
});

const APP_NAME = "FitMess";
const APP_DESCRIPTION =
  "Adaptivno praćenje ishrane na srpskom. Nedelja je jedinica uspeha — jedan loš obrok te ne ruši.";

export const metadata: Metadata = {
  metadataBase: new URL("https://fitmess.app"),
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

// Theme-color (PWA status-bar tint) follows the chosen theme -- read per
// request from the same cookie the root layout uses.
export async function generateViewport(): Promise<Viewport> {
  const cookieStore = await cookies();
  const theme = resolveTheme(cookieStore.get(THEME_COOKIE)?.value);
  return {
    themeColor: theme === "light" ? "#ffffff" : "#0a0c0b",
    width: "device-width",
    initialScale: 1,
    // iOS PWA: let content extend into the notch/home-indicator area; the
    // `env(safe-area-inset-*)` paddings below keep UI clear of them.
    viewportFit: "cover",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The chosen theme is server-rendered onto <html> so there is no flash of
  // the wrong theme on first paint. Existing users (no cookie) stay dark.
  const cookieStore = await cookies();
  const theme = resolveTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <html
      lang="sr"
      className={`${theme} ${inter.variable} ${archivoBlack.variable} h-full antialiased`}
      style={{ colorScheme: theme }}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegister />
        <HapticProvider />
      </body>
    </html>
  );
}
