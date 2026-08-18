import Link from "next/link";

import { isNativeShellRequest } from "@/lib/device/native-server";
import { getT } from "@/lib/i18n/server";

import { SocialSignIn } from "../social-sign-in";
import { SignInForm } from "./sign-in-form";

export default async function PrijavaPage({
  searchParams,
}: {
  searchParams: Promise<{ greska?: string; email?: string }>;
}) {
  const { greska, email } = await searchParams;
  const { t } = await getT();
  // Google is dropped inside the shell — Google refuses OAuth from an embedded
  // web view. See `social-sign-in.tsx`.
  const isNativeShell = await isNativeShellRequest();

  return (
    <>
      <div className="auth-card">
        <div className="auth-head">
          <h1>{t("auth.signIn.title")}</h1>
          <p>{t("auth.signIn.subtitle")}</p>
        </div>
        {greska === "potvrda" ? (
          <p role="alert" className="auth-error">
            {t("auth.signIn.confirmExpired")}
          </p>
        ) : null}
        <SignInForm initialEmail={email} />
        <p className="auth-alt" style={{ marginTop: 0 }}>
          <Link href="/zaboravljena-lozinka">{t("auth.signIn.forgotLink")}</Link>
        </p>
        <SocialSignIn t={t} isNativeShell={isNativeShell} />
      </div>
      <p className="auth-alt">
        {t("auth.signIn.noAccount")}{" "}
        <Link href="/registracija">{t("auth.link.signUp")}</Link>
      </p>
    </>
  );
}
