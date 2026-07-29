import { getT } from "@/lib/i18n/server";

import { PhoneForm } from "./phone-form";

/**
 * The `/telefon` phone-capture page. The route-protection middleware sends a
 * verified user here once when their profile has no phone yet -- in practice
 * only Google OAuth users, since email/password signups collect the phone on
 * the registration form. Gated to authenticated users by the middleware
 * (`decideRouteAccess` only reaches the "no phone" branch after the
 * authenticated + verified checks), so this page needs no auth check of its own.
 */
export default async function TelefonPage() {
  const { t } = await getT();
  return (
    <>
      <div className="auth-card">
        <div className="auth-head">
          <h1>{t("auth.phonePage.title")}</h1>
          <p>{t("auth.phonePage.subtitle")}</p>
        </div>
        <PhoneForm />
      </div>
    </>
  );
}
