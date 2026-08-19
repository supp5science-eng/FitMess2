import Link from "next/link";

import { canSignInWithGoogleNatively } from "@/lib/auth/google-clients";
import {
  isIosNativeShellRequest,
  isNativeShellRequest,
} from "@/lib/device/native-server";
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
  // Inside the shell the Google button is not the web redirect handshake —
  // Google degrades that inside an embedded web view — but the platform's own
  // account picker, and only where that is configured. See `social-sign-in.tsx`.
  const isNativeShell = await isNativeShellRequest();
  const nativeGoogle =
    (await isIosNativeShellRequest()) && canSignInWithGoogleNatively();

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
        <SocialSignIn
          t={t}
          isNativeShell={isNativeShell}
          nativeGoogle={nativeGoogle}
        />
      </div>
      <p className="auth-alt">
        {t("auth.signIn.noAccount")}{" "}
        <Link href="/registracija">{t("auth.link.signUp")}</Link>
      </p>
    </>
  );
}
