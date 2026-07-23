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

const DEFAULT_TITLE = "FitMess — dijeta koja ti oprašta";

export const metadata: Metadata = {
  metadataBase: new URL("https://fitmess.app"),
  applicationName: APP_NAME,
  title: {
    default: DEFAULT_TITLE,
    template: "%s · FitMess",
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  // Every indexable page resolves to itself as the canonical; the marketing
  // root is the primary entry point. Relative paths resolve against
  // `metadataBase` above.
  alternates: { canonical: "/" },
  keywords: [
    "praćenje kalorija",
    "brojanje kalorija",
    "kalorije",
    "ishrana",
    "makronutrijenti",
    "dijeta",
    "mršavljenje",
    "zdrava ishrana",
    "fitnes aplikacija",
    "srpski",
    "FitMess",
  ],
  authors: [{ name: "FitMess" }],
  creator: "FitMess",
  publisher: "FitMess",
  category: "health",
  // Let the marketing surface be indexed; the private app routes are kept out
  // via `robots.ts`. Explicit here so Google/Bot get the full crawl directives.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Google Search Console site verification — set `GOOGLE_SITE_VERIFICATION`
  // (the token from the "HTML tag" method) in the deployment env to emit the
  // `<meta name="google-site-verification">` tag. Absent → no tag rendered.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: DEFAULT_TITLE,
    description: APP_DESCRIPTION,
    url: "/",
    locale: "sr_RS",
    // The 1200×630 card image is supplied by `opengraph-image.tsx`.
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: APP_DESCRIPTION,
  },
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
  // the wrong theme on first paint. Anyone without a cookie gets the default
  // (light).
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
