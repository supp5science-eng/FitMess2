import type { Metadata, Viewport } from "next";
import { Inter, Archivo_Black, Poppins } from "next/font/google";
import { cookies } from "next/headers";
import { preload } from "react-dom";
import "./globals.css";

import { AppShell } from "@/components/shell/app-shell";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { HapticProvider } from "@/components/pwa/haptic-provider";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n/locale";
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
//
// `latin` ONLY (2026-07-31): every place this face renders draws the literal
// string "FitMess" -- the /danas header lockup, the launch splash, and the
// landing demo's `.lpd-wordmark`. Not one of them is translatable, and
// "FitMess" is pure ASCII, so the `latin-ext` cut (č/ć/ž/š/đ and friends) could
// never paint a single glyph. It was still a render-blocking font request on
// every cold launch. Dropping it removes one of the six font files the browser
// fetched before first paint. Do NOT copy this to Inter or Poppins: those DO
// render Serbian copy and need latin-ext.
const archivoBlack = Archivo_Black({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// Brand heading face (geometric, friendly). Poppins gives a section heading
// more character than body Inter without shouting like the Archivo Black
// wordmark. Exposed via --font-brand.
//
// ONE weight on purpose (2026-07-30): 500 and 600 were only ever used by the
// launch splash's tagline, which is gone. Every remaining `--font-brand` use
// (the "Dnevni unos" heading) renders at `font-bold` = 700, so the other two
// weights were four extra font files -- ~70 KB across four render-blocking
// requests -- downloaded on every cold launch for nothing. Fonts were the
// single heaviest thing between the HTML landing and the first paint, so keep
// this list minimal: adding a weight here costs two files (latin + latin-ext).
const poppins = Poppins({
  variable: "--font-brand",
  subsets: ["latin", "latin-ext"],
  weight: "700",
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
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  // The onboarding ring hand-off drops `fm_intro` just before landing on
  // `/danas`; while it's present the launch splash yields to that animation.
  const introActive = cookieStore.get("fm_intro") != null;

  // The pear mark, fetched at HIGH priority from the document head instead of
  // being discovered late in the body.
  //
  // It is the first thing the app shows (the launch splash) and it sits in the
  // /danas header, but it is a plain <img> deep inside the body, so the browser
  // reached it only after the HTML around it — behind fonts and JS in the queue.
  // That was survivable while the splash ran ~2.4s; now that the splash clears
  // in ~1s, the mark routinely lost the race and the launch showed a bare
  // "FitMess" wordmark with an empty box where the logo belongs (and the same
  // gap in the header underneath). Preloading here starts the request as soon as
  // the head is parsed, so the bytes are in hand before either paints.
  preload("/brand/fitmess-icon.png", { as: "image", fetchPriority: "high" });

  return (
    <html
      lang={locale}
      className={`${theme} ${inter.variable} ${archivoBlack.variable} ${poppins.variable} h-full antialiased`}
      style={{ colorScheme: theme }}
    >
      <body className="min-h-full">
        <LocaleProvider locale={locale}>
          <AppShell introActive={introActive}>{children}</AppShell>
        </LocaleProvider>
        <ServiceWorkerRegister />
        <HapticProvider />
      </body>
    </html>
  );
}
