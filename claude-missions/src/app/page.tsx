import Link from "next/link";

import { HeroDemo } from "@/components/landing/hero-demo";

import "./landing.css";
import "./landing-demo.css";

/**
 * The public marketing landing page at `/`.
 *
 * The first screen stays deliberately minimal (Cal-AI-style): a single phone
 * frame playing the hero demo — a pure-CSS motion graphic of the app's
 * signature journey (početna → slikaj obrok → AI procena → ring se popuni),
 * see `components/landing/hero-demo.tsx` — one bold line, and a single primary
 * action ("Započni" → `/upitnik`; "Prijavi se" → sign in). Below the fold a
 * short, app-styled feature showcase hints at what's inside, then a closing
 * CTA. Kept intentionally brief.
 *
 * The below-fold sections adopt the app's own look — the `.lp` root carries
 * `.dark`, so `bg-card` / `text-foreground` / `--primary` / the macro colours
 * resolve to the real app tokens (globals.css), and the cards reuse the same
 * `rounded-2xl border-border bg-card` surface the authenticated screens use.
 * So the landing reads as the same product, not a separate marketing skin.
 *
 * There is NO "install the app" CTA here — the whole onboarding
 * (questionnaire → plan) runs on the web first, and the PWA install prompt
 * only comes at the very end, once the user has finished.
 *
 * `/` is a public route (`isPublicPath` in
 * `src/lib/auth/route-protection.ts`) and renders full-bleed — the app shell
 * (`src/components/shell/app-shell.tsx`) drops its mobile column and bottom
 * navigation here. It's only ever served on a phone: the middleware bounces
 * non-mobile visitors to `/samo-za-telefon`, so the layout is single-column
 * mobile-first. Server Component; every animation is CSS only (the below-fold
 * blocks reveal via scroll-driven `animation-timeline`, a progressive
 * enhancement that no-ops to plain-visible where unsupported).
 */
// Structured data (schema.org) so Google can render a rich result for the
// brand: a health/fitness web application, in Serbian, free to use. Emitted as
// a JSON-LD <script> — the canonical way to expose structured data to crawlers.
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "FitMess",
  url: "https://fitmess.app",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web, iOS, Android",
  inLanguage: "sr-Latn",
  description:
    "Adaptivno praćenje ishrane na srpskom. Nedelja je jedinica uspeha — jedan loš obrok te ne ruši.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "RSD",
  },
};

/* Hand-rolled stroke icons (no icon-lib dependency, per the repo's
 * "charts/icons are hand-rolled SVG" convention). All 24×24, `currentColor`,
 * `aria-hidden` — the feature's accessible name is the heading beside them. */
const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconPlan() {
  // Target — a personalized daily goal.
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconLog() {
  // Plus-in-plate — logging a meal fast.
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

function IconToday() {
  // Calorie ring — today at a glance.
  return (
    <svg {...iconProps}>
      <path d="M12 3a9 9 0 1 1-6.4 2.7" />
      <path d="M12 7.5v4.5l3 2" />
    </svg>
  );
}

function IconWeek() {
  // Trend line — the week, and the weight trend.
  return (
    <svg {...iconProps}>
      <path d="M3 17l5-5 3.5 3.5L21 7" />
      <path d="M21 12V7h-5" />
    </svg>
  );
}

/** The showcase features. `tint` uses the app's own accent + macro palette
 * (globals.css dark tokens) so the row doubles as a peek at the product's
 * visual language: primary teal, carbs green, protein coral, fat amber. */
const FEATURES: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  body: string;
}[] = [
  {
    icon: <IconPlan />,
    tint: "#17d1a8",
    title: "Dnevni cilj skrojen za tebe",
    body: "Kalorije i makroi na osnovu par pitanja o tebi.",
  },
  {
    icon: <IconLog />,
    tint: "#45c78d",
    title: "Unos obroka za par sekundi",
    body: "Pretraga hrane, porcije i tvoji proizvodi.",
  },
  {
    icon: <IconToday />,
    tint: "#f9745f",
    title: "Prsten kalorija i makro trake",
    body: "Potrošeno ↔ preostalo, na prvi pogled.",
  },
  {
    icon: <IconWeek />,
    tint: "#f2c14e",
    title: "Nedeljni pregled i trend težine",
    body: "Gledaš nedelju, ne pojedinačan dan.",
  },
];

export default function LandingPage() {
  return (
    <div className="lp dark">
      <script
        type="application/ld+json"
        // JSON.stringify output is safe to inline; no user data is interpolated.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <main>
        {/* ---------- Hero (first screen) ---------- */}
        <section className="lp-hero">
          {/* Phone playing the in-app journey demo */}
          <div className="lp-phone-wrap">
            <div className="phone" aria-hidden="true">
              <div className="screen">
                <HeroDemo />
              </div>
            </div>
          </div>

          <h1 className="lp-title">Prati kalorije bez muke</h1>

          <div className="lp-cta">
            <Link className="lp-start" href="/upitnik">
              Započni
            </Link>
            <p className="lp-signin">
              Već imaš nalog? <Link href="/prijava">Prijavi se</Link>
            </p>
          </div>

          <span className="lp-scroll" aria-hidden="true">
            <span className="lp-scroll-label">Zaviri</span>
            <svg viewBox="0 0 24 24" className="lp-scroll-chevron" aria-hidden>
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </section>

        {/* ---------- Feature showcase (app-styled) ---------- */}
        <section
          className="mx-auto w-full max-w-[460px] px-[22px] py-14"
          aria-labelledby="lp-features-h"
        >
          <h2
            id="lp-features-h"
            className="lp-reveal mb-6 text-center text-[26px] font-extrabold tracking-tight text-foreground"
          >
            Šta te čeka unutra
          </h2>
          <ul className="grid gap-3">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="lp-reveal flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
              >
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-xl [&_svg]:size-[22px]"
                  style={{ backgroundColor: `${f.tint}22`, color: f.tint }}
                >
                  {f.icon}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15.5px] font-semibold text-foreground">
                    {f.title}
                  </h3>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Closing CTA (carries the zero-shame line) ---------- */}
        <section className="mx-auto w-full max-w-[460px] px-[22px] pb-14 text-center">
          <p className="lp-reveal text-lg font-bold text-foreground">
            Nedelja je jedinica uspeha.
          </p>
          <p className="lp-reveal mx-auto mb-6 mt-1 max-w-[34ch] text-sm leading-snug text-muted-foreground">
            Jedan loš obrok te ne ruši — samo miran, održiv tempo.
          </p>
          <Link className="lp-start" href="/upitnik">
            Kreni besplatno
          </Link>
        </section>
      </main>
    </div>
  );
}
