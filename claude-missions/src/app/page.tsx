import Link from "next/link";

import { HeroVideo } from "@/components/landing/hero-video";
import { getT } from "@/lib/i18n/server";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/device/stores";
import type { MessageKey } from "@/lib/i18n/messages";

import "./landing.css";

/**
 * The public marketing landing page at `/`.
 *
 * The first screen stays deliberately minimal (Cal-AI-style): the FitMess
 * motion-graphics film playing full-bleed (see
 * `components/landing/hero-video.tsx`) — one bold line, and a single primary
 * action ("Započni" → `/upitnik`; "Prijavi se" → sign in). Below the fold a
 * short, app-styled feature showcase hints at what's inside, then a closing
 * CTA. Kept intentionally brief.
 *
 * The page is printed on the app's own cream plate: the `.lp` root carries
 * `.light` (the app has ONE theme now, and that class is what a subtree pins
 * it with), so `bg-card` / `text-foreground` / `--primary` / the macro colours
 * resolve to the real app tokens (globals.css), and the cards reuse the same
 * `rounded-2xl border-border bg-card` surface the authenticated screens use.
 * So the landing reads as the same product, not a separate marketing skin.
 *
 * The hero film was rendered on WHITE, though, and this page is cream — it is
 * printed onto the paper with `mix-blend-mode: multiply` rather than pasted
 * over it, which is what keeps it from drawing a white box (see `.lp-video`
 * in `landing.css`).
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
 * mobile-first. Server Component; apart from the hero video every animation is
 * CSS only (the below-fold blocks reveal via scroll-driven
 * `animation-timeline`, a progressive enhancement that no-ops to plain-visible
 * where unsupported).
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

function IconCheck() {
  // Shipped — the one thing on the availability list you can use today.
  return (
    <svg {...iconProps} strokeWidth={2.6}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function IconBuilding() {
  // Still in the works. A calm clock, not a spinner: nothing is loading, we
  // just haven't shipped it yet.
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

/**
 * One line of the availability list: what it is, and where it stands.
 *
 * `live` is what separates a fact from a plan, and it is the only thing that
 * changes the row's colour — the teal is reserved for the thing you can
 * actually open right now, so a pending row can never read as shipped.
 *
 * `href` turns the row into a real link. Only a live row ever gets one: a
 * store link before the listing is public lands on "item not found", which
 * reads as a broken app rather than an unfinished rollout.
 */
function StoreRow({
  label,
  note,
  live = false,
  href,
}: {
  label: string;
  note: string;
  live?: boolean;
  href?: string | null;
}) {
  const Row = href ? "a" : "span";
  return (
    <li className="flex items-center gap-3">
      <span
        className={`grid size-7 shrink-0 place-items-center rounded-full [&_svg]:size-[15px] ${
          live ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        {live ? <IconCheck /> : <IconBuilding />}
      </span>
      <Row
        {...(href
          ? { href, target: "_blank", rel: "noopener noreferrer" }
          : {})}
        className="min-w-0 flex-1 text-[14.5px] font-semibold text-foreground"
      >
        {label}
      </Row>
      <span
        className={`shrink-0 text-[12.5px] font-semibold ${
          live ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {note}
      </span>
    </li>
  );
}

/** The showcase features. `tint` uses the app's own accent + macro palette
 * (the `--primary` / `--macro-*` tokens in globals.css) so the row doubles as
 * a peek at the product's visual language: the plate's ultramarine, then the
 * three earthy macro inks. */
const FEATURES: {
  icon: React.ReactNode;
  tint: string;
  titleKey: MessageKey;
  bodyKey: MessageKey;
}[] = [
  {
    icon: <IconPlan />,
    tint: "#2f2ce6",
    titleKey: "app.landing.feature.plan.title",
    bodyKey: "app.landing.feature.plan.body",
  },
  {
    icon: <IconLog />,
    tint: "#2c7a58",
    titleKey: "app.landing.feature.log.title",
    bodyKey: "app.landing.feature.log.body",
  },
  {
    icon: <IconToday />,
    tint: "#c05028",
    titleKey: "app.landing.feature.ring.title",
    bodyKey: "app.landing.feature.ring.body",
  },
  {
    icon: <IconWeek />,
    tint: "#9a7112",
    titleKey: "app.landing.feature.week.title",
    bodyKey: "app.landing.feature.week.body",
  },
];

export default async function LandingPage() {
  const { t } = await getT();
  return (
    <div className="lp light">
      <script
        type="application/ld+json"
        // JSON.stringify output is safe to inline; no user data is interpolated.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <main>
        {/* ---------- Hero (first screen) ---------- */}
        <section className="lp-hero">
          {/* The motion-graphics film — full-bleed, no phone frame: it brings
              its own device mockup and its own white ground. */}
          <div className="lp-video-wrap">
            <HeroVideo />
          </div>

          {/* Prelaunch status, stated up front. The hero is otherwise
              deliberately minimal, so this earns its place by answering the
              question a store-less product raises before the CTA does ("is
              this real / where do I get it?") — quietly, above the headline,
              rather than as an apology below it. The full story is the
              availability section further down. */}
          <span className="lp-badge">{t("app.landing.hero.badge")}</span>

          <h1 className="lp-title">{t("app.landing.hero.title")}</h1>

          <div className="lp-cta">
            <Link className="lp-start" href="/upitnik">
              {t("app.landing.hero.start")}
            </Link>
            <p className="lp-signin">
              {t("app.landing.hero.haveAccount")}{" "}
              <Link href="/prijava">{t("app.landing.hero.signIn")}</Link>
            </p>
          </div>

          <span className="lp-scroll" aria-hidden="true">
            <span className="lp-scroll-label">{t("app.landing.hero.peek")}</span>
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
            {t("app.landing.features.heading")}
          </h2>
          <ul className="grid gap-3">
            {FEATURES.map((f) => (
              <li
                key={f.titleKey}
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
                    {t(f.titleKey)}
                  </h3>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">
                    {t(f.bodyKey)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Availability: App Store live, Play in progress ----------
            Sits between the features and the closing CTA on purpose: by here
            the visitor wants the product, and "where do I get it" is the last
            thing standing between them and "Kreni besplatno". Framed as a
            deliberate rollout rather than a missing feature — the web app is
            a shipped row on the list, not a stand-in for one.

            No date is promised anywhere in this block. A missed launch date on
            a landing page costs more trust than the wait itself, so the copy
            says "u pripremi" and stops.

            The Play row stays pending until the closed test finishes and the
            listing is public; `@/lib/device/stores` is the single switch, so
            this block flips itself the day `PLAY_STORE_URL` stops being null. */}
        <section
          className="mx-auto w-full max-w-[460px] px-[22px] pb-14"
          aria-labelledby="lp-stores-h"
        >
          <div className="lp-reveal rounded-2xl border border-border bg-card p-5">
            <h2
              id="lp-stores-h"
              className="text-[17px] font-bold tracking-tight text-foreground"
            >
              {t("app.landing.stores.heading")}
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
              {t("app.landing.stores.body")}
            </p>

            <ul className="mt-4 grid gap-2.5 border-t border-border/60 pt-4">
              <StoreRow
                label={t("app.landing.stores.appStore")}
                note={t("app.landing.stores.nowNote")}
                href={APP_STORE_URL}
                live
              />
              <StoreRow
                label={t("app.landing.stores.play")}
                note={t(
                  PLAY_STORE_URL
                    ? "app.landing.stores.nowNote"
                    : "app.landing.stores.soonNote"
                )}
                href={PLAY_STORE_URL}
                live={PLAY_STORE_URL !== null}
              />
              <StoreRow
                label={t("app.landing.stores.web")}
                note={t("app.landing.stores.nowNote")}
                live
              />
            </ul>

            <p className="mt-4 text-[12.5px] leading-snug text-muted-foreground">
              {t("app.landing.stores.foot")}
            </p>
          </div>
        </section>

        {/* ---------- Closing CTA (carries the zero-shame line) ---------- */}
        <section className="mx-auto w-full max-w-[460px] px-[22px] pb-14 text-center">
          <p className="lp-reveal text-lg font-bold text-foreground">
            {t("app.landing.close.title")}
          </p>
          <p className="lp-reveal mx-auto mb-6 mt-1 max-w-[34ch] text-sm leading-snug text-muted-foreground">
            {t("app.landing.close.body")}
          </p>
          <Link className="lp-start" href="/upitnik">
            {t("app.landing.close.cta")}
          </Link>
        </section>

        {/* The legal documents, quiet and last. They live here because both
            store listings point at them and a reviewer looks for them on the
            site too — and because the landing is the only public page a person
            who has not signed up can reach. Deliberately understated: nobody
            arrives wanting to read a privacy policy, but the person who does
            want it should not have to guess the URL. */}
        <footer className="mx-auto w-full max-w-[460px] px-[22px] pb-10 text-center">
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
            <Link className="underline underline-offset-4" href="/privatnost">
              {t("legal.link.privacy")}
            </Link>
            <Link className="underline underline-offset-4" href="/uslovi">
              {t("legal.link.terms")}
            </Link>
            <Link
              className="underline underline-offset-4"
              href="/brisanje-naloga"
            >
              {t("legal.link.delete")}
            </Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
