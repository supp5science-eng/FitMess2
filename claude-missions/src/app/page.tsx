import Link from "next/link";

import { HeroDemo } from "@/components/landing/hero-demo";

import "./landing.css";
import "./landing-demo.css";

/**
 * The public marketing landing page at `/`.
 *
 * Deliberately minimal (Cal-AI-style): a single phone frame playing the hero
 * demo — a pure-CSS motion graphic of the app's signature journey (početna →
 * slikaj obrok → AI procena → ring se popuni), see
 * `components/landing/hero-demo.tsx` — one bold line, and a single primary
 * action. There is NO "install the app" CTA here anymore — the whole
 * onboarding (questionnaire → plan) runs on the web first, and the PWA
 * install prompt only comes at the very end, once the user has finished. So
 * the landing's only jobs are:
 *   - "Započni" → the pre-auth questionnaire (`/upitnik`), and
 *   - "Prijavi se" → sign in, for returning users.
 *
 * `/` is a public route (`isPublicPath` in
 * `src/lib/auth/route-protection.ts`) and renders full-bleed — the app shell
 * (`src/components/shell/app-shell.tsx`) drops its mobile column and bottom
 * navigation here. Server Component; the hero demo animates with CSS only.
 */
export default function LandingPage() {
  return (
    <div className="lp">
      <main className="lp-hero">
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
      </main>
    </div>
  );
}
