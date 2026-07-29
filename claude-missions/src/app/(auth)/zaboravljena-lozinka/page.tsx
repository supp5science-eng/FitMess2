import Link from "next/link";

import { getT } from "@/lib/i18n/server";

import { ForgotPasswordForm } from "./forgot-password-form";

/**
 * The "zaboravljena lozinka" (forgot password) request page. Public: a
 * signed-out user who forgot their password must be able to reach it (see
 * `isPasswordResetPath` in `src/lib/auth/route-protection.ts`).
 *
 * If arrived at from the login form with an already-typed email, we prefill it
 * via `?email=` so the user doesn't retype it.
 */
export default async function ZaboravljenaLozinkaPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const { t } = await getT();

  return (
    <>
      <div className="auth-card">
        <div className="auth-head">
          <h1>{t("auth.forgot.title")}</h1>
          <p>{t("auth.forgot.subtitle")}</p>
        </div>
        <ForgotPasswordForm email={email} />
      </div>
      <p className="auth-alt">
        {t("auth.forgot.remembered")}{" "}
        <Link href="/prijava">{t("auth.link.signIn")}</Link>
      </p>
    </>
  );
}
