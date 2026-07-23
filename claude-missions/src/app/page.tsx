import Link from "next/link";

import "./landing.css";

/**
 * The public marketing landing page at `/`.
 *
 * Deliberately minimal (Cal-AI-style): a single phone frame playing the hero
 * video (`/civava.mp4`), one bold line, and a single primary action. There is
 * NO "install the app" CTA here anymore — the whole onboarding (questionnaire
 * → plan) runs on the web first, and the PWA install prompt only comes at the
 * very end, once the user has finished. So the landing's only jobs are:
 *   - "Započni" → the pre-auth questionnaire (`/upitnik`), and
 *   - "Prijavi se" → sign in, for returning users.
 *
 * `/` is a public route (`isPublicPath` in
 * `src/lib/auth/route-protection.ts`) and renders full-bleed — the app shell
 * (`src/components/shell/app-shell.tsx`) drops its mobile column and bottom
 * navigation here. Server Component; the hero is an autoplaying muted video.
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

export default function LandingPage() {
  return (
    <div className="lp">
      <script
        type="application/ld+json"
        // JSON.stringify output is safe to inline; no user data is interpolated.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <main className="lp-hero">
        {/* Phone showing the hero video */}
        <div className="lp-phone-wrap">
          <div className="phone" aria-hidden="true">
            <div className="screen">
              <video
                className="lp-video"
                src="/civava.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
              />
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
      </main>
    </div>
  );
}
