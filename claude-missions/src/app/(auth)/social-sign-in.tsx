import type { TFunction } from "@/lib/i18n/translate";

import { AppleSignInButton } from "./apple-sign-in-button";
import { GoogleSignInButton } from "./google-sign-in-button";

/**
 * The third-party sign-in block shown under the form on both `/prijava` and
 * `/registracija`: one "ili" divider, then Apple, then Google.
 *
 * Both providers live here rather than being dropped into each page separately
 * so the two screens can never drift into offering different options — which
 * for guideline 4.8 is not a cosmetic problem. Apple's requirement is that a
 * compliant login service is offered as an **equivalent** option: same
 * screens, same prominence, not tucked away. Apple goes first because it is
 * the one that satisfies the guideline; Google follows in the identical button
 * size and shape (`.auth-btn` sets the geometry, the modifier only the colour).
 *
 * ## Google used to be hidden inside the native shell. It is not any more.
 *
 * The claim was that Google's OAuth policy blocks sign-in from embedded web
 * views (`disallowed_useragent`), so a tap inside the shell could only end in
 * Google's "this browser or app may not be secure" page. It was written from
 * memory, not measured, and it does not hold: on 18.08.2026 the authorize URL
 * Supabase generates for this project was requested with four user agents —
 * iPhone Safari, iPhone Safari + `FitMessApp/1.0`, Android Chrome, and an
 * Android WebView UA carrying the `; wv)` token Google is said to key on. All
 * four were served the same ordinary `Sign in - Google Accounts` page. Nothing
 * was blocked.
 *
 * That makes sense for iOS in particular: Capacitor's WKWebView sends Mobile
 * Safari's user agent with our token appended, so there is nothing for Google
 * to key on in the first place.
 *
 * What is genuinely required for the round trip to finish inside the app is
 * `server.allowNavigation` in `capacitor.config.ts` — without it Capacitor
 * cancels the navigation and hands the URL to the system browser, signing the
 * user in inside Safari while the app sits on the login screen it never left.
 * Both providers' hosts are listed there.
 *
 * The residual risk is that Google enforces the policy later in the flow
 * (after credentials are entered), which no request from outside a real web
 * view can prove either way. That is a TestFlight question, and a cheap one:
 * showing or hiding a button here is a WEB change, so if Google does break
 * inside the shell it goes back to Apple-only with a `git push` — no new
 * binary, no submission. Re-hiding means restoring the `isNativeShell` prop
 * (`@/lib/device/native-server` still provides the answer) and gating the
 * Google button on it.
 *
 * A synchronous server component on purpose: it renders two client components
 * and holds no state, and an async component nested inside another one cannot
 * be rendered by React's test renderer — which is exactly the code that must
 * stay tested.
 */
export function SocialSignIn({ t }: { t: TFunction }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="auth-or" aria-hidden="true">
        <span>{t("auth.oauth.or")}</span>
      </div>
      <AppleSignInButton />
      <GoogleSignInButton />
    </div>
  );
}
