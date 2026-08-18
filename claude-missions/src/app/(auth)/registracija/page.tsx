import Link from "next/link";

import { isNativeShellRequest } from "@/lib/device/native-server";
import { getT } from "@/lib/i18n/server";

import { SocialSignIn } from "../social-sign-in";
import { SignUpForm } from "./sign-up-form";

export default async function RegistracijaPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  // Carried back from the "proveri email" screen when the user realizes they
  // mistyped their address ("Pogrešan email? Izmeni") — so they don't retype
  // it from scratch.
  const { email } = await searchParams;
  const { t } = await getT();
  // Google is dropped inside the shell — Google refuses OAuth from an embedded
  // web view. See `social-sign-in.tsx`.
  const isNativeShell = await isNativeShellRequest();

  return (
    <>
      <div className="auth-card">
        <div className="auth-head">
          <h1>{t("auth.signUp.title")}</h1>
          <p>{t("auth.signUp.subtitle")}</p>
        </div>
        <SignUpForm initialEmail={email} />
        <SocialSignIn t={t} isNativeShell={isNativeShell} />
      </div>
      <p className="auth-alt">
        {t("auth.signUp.haveAccount")}{" "}
        <Link href="/prijava">{t("auth.link.signIn")}</Link>
      </p>
    </>
  );
}
