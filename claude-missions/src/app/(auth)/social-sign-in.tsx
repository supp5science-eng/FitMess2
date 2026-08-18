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
 * ## Why Google is not offered inside the native shell
 *
 * Because Google refuses it — confirmed on a real device, which is the only
 * place it is visible. The history is worth keeping, because the obvious
 * check gives the wrong answer:
 *
 *  - The original claim was that Google's OAuth policy blocks embedded web
 *    views outright (`disallowed_useragent`), so the button was hidden.
 *  - On 18.08.2026 that was tested from outside: the authorize URL Supabase
 *    generates for this project was requested with four user agents — iPhone
 *    Safari, iPhone Safari + `FitMessApp/1.0`, Android Chrome, and an Android
 *    WebView UA carrying the `; wv)` token Google is said to key on. All four
 *    were served the ordinary `Sign in - Google Accounts` page. Nothing was
 *    blocked, so the button was restored.
 *  - On 19.08.2026 it was tapped inside a TestFlight build. Google served a
 *    degraded flow: no saved accounts offered, and an extra verification
 *    challenge instead of a sign-in.
 *
 * So Google does enforce the policy — just not by refusing the first request,
 * which is all an HTTP client outside a web view can observe. A curl trace
 * cannot settle this question; only a real device can.
 *
 * A reviewer tapping a button that demands an unexplained verification and
 * forgets the user's accounts is a functional defect under guideline 2.1, so
 * the shell offers Sign in with Apple and email/password — both of which
 * complete inside the web view — while the site keeps all three for every
 * browser, Android included.
 *
 * A user who created their account with Google and then installs the app is
 * not locked out: "Zaboravljena lozinka" sets a password on the same email
 * address and signs them in.
 *
 * The real fix is `ASWebAuthenticationSession` (iOS) / Custom Tabs (Android)
 * through a Capacitor plugin with a deep link back — those are system browser
 * surfaces, not embedded web views, so Google accepts them and the session
 * still lands in the app. That is native work with its own binary, tracked in
 * `docs/prijava-sa-apple.md`.
 *
 * Note that hiding the button is a WEB change and reaches installed phones
 * with a `git push`; `capacitor.config.ts` still allows Google's hosts, so
 * when the plugin lands the button can come back without touching the shell.
 *
 * A synchronous server component on purpose: it renders two client components
 * and holds no state, and an async component nested inside another one cannot
 * be rendered by React's test renderer — which is exactly the code that must
 * stay tested. The page resolves `isNativeShell` and hands it down.
 */
export function SocialSignIn({
  t,
  isNativeShell = false,
}: {
  t: TFunction;
  isNativeShell?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="auth-or" aria-hidden="true">
        <span>{t("auth.oauth.or")}</span>
      </div>
      <AppleSignInButton />
      {isNativeShell ? null : <GoogleSignInButton />}
    </div>
  );
}
