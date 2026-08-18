import type { TFunction } from "@/lib/i18n/translate";

import { AppleSignInButton } from "./apple-sign-in-button";
import { GoogleSignInButton } from "./google-sign-in-button";

/**
 * The third-party sign-in block shown under the form on both `/prijava` and
 * `/registracija`: one "ili" divider, then Apple, then (in a browser) Google.
 *
 * Both providers live here rather than being dropped into each page separately
 * so the two screens can never drift into offering different options — which
 * for guideline 4.8 is not a cosmetic problem. Apple's requirement is that a
 * compliant login service is offered as an **equivalent** option: same
 * screens, same prominence, not tucked away. Apple goes first because it is
 * the one that satisfies the guideline; Google follows in the identical button
 * size and shape.
 *
 * ## Why Google is not offered inside the native shell
 *
 * Not a product preference — Google refuses the request. Google's OAuth policy
 * blocks sign-in from embedded web views (`disallowed_useragent`), and both
 * shells are exactly that: WKWebView on iOS, Android WebView on Android. A
 * tapped Google button inside the app can only end in one of two ways, and
 * both are worse than not offering it:
 *
 *  - the host is in `server.allowNavigation` → Google answers inside the app
 *    with its own "this browser or app may not be secure" page;
 *  - the host is not → Capacitor hands the URL to the system browser, the user
 *    signs in **in Safari**, the session cookie lands in Safari's cookie jar,
 *    and the app is still sitting on the login screen it never left.
 *
 * Either one is a functional defect a reviewer finds on the first tap
 * (guideline 2.1). So the shell offers Sign in with Apple and email/password —
 * both of which work end to end inside the web view — while the site keeps all
 * three for every browser, including Android's.
 *
 * A user who created their account with Google and then installs the app is
 * not locked out: "Zaboravljena lozinka" sets a password on the same email
 * address and signs them in. Restoring the in-app Google button properly needs
 * `ASWebAuthenticationSession` (iOS) / Custom Tabs (Android) via a Capacitor
 * plugin and a deep link back — a native change, tracked in
 * `docs/prijava-sa-apple.md`, not something the site can fix on its own.
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
