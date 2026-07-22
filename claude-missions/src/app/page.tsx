import Link from "next/link";

import "./landing.css";

/**
 * The public marketing landing page at `/`.
 *
 * Deliberately minimal (Cal-AI-style): a single animated phone showing the
 * food-scanning motion, one bold line, and a single primary action. There is
 * NO "install the app" CTA here anymore — the whole onboarding (questionnaire
 * → plan) runs on the web first, and the PWA install prompt only comes at the
 * very end, once the user has finished. So the landing's only jobs are:
 *   - "Započni" → the pre-auth questionnaire (`/upitnik`), and
 *   - "Prijavi se" → sign in, for returning users.
 *
 * `/` is a public route (`isPublicPath` in
 * `src/lib/auth/route-protection.ts`) and renders full-bleed — the app shell
 * (`src/components/shell/app-shell.tsx`) drops its mobile column and bottom
 * navigation here. Server Component; the scan animation is pure CSS.
 */
export default function LandingPage() {
  return (
    <div className="lp">
      <main className="lp-hero">
        {/* Animated phone — food-scanning motion (placeholder; will be edited) */}
        <div className="lp-phone-wrap">
          <div className="phone" aria-hidden="true">
            <div className="screen">
              <div className="ds-cam">
                <div className="ds-plate">🍽️</div>
                <div className="ds-food ds-food-a">🍖</div>
                <div className="ds-food ds-food-b">🥔</div>
                <div className="ds-food ds-food-c">🥗</div>
                <span className="ds-bracket tl" />
                <span className="ds-bracket tr" />
                <span className="ds-bracket bl" />
                <span className="ds-bracket br" />
                <div className="ds-scanline" />
              </div>
              <div className="ds-hint">
                <span className="ds-rec" /> Skeniram tanjir…
              </div>
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
