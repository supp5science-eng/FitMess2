"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { useT } from "@/components/i18n/locale-provider";
import type { TFunction } from "@/lib/i18n/translate";
import { savePhoneAction, skipPhoneAction, type AuthFormState } from "../actions";
import { PhoneField } from "../registracija/phone-field";

const initialState: AuthFormState = null;

function SubmitButton({ t }: { t: TFunction }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="auth-btn auth-btn-primary" disabled={pending}>
      {pending ? t("auth.saving") : t("auth.phoneForm.save")}
    </button>
  );
}

/**
 * The `/telefon` ask. Reuses the exact same `PhoneField` as signup (dial-code
 * picker + local number); on success `savePhoneAction` writes the number to
 * the profile and redirects onward.
 *
 * The "Preskoči" below it is not decoration and must not be removed: it is
 * what makes this screen an ask instead of a wall, which App Store guideline
 * 5.1.1(v) requires and Sign in with Apple's Hide My Email assumes. It is a
 * separate `<form>` rather than a second submit button on the same one so a
 * half-typed, invalid number in the field can never block the way out.
 */
export function PhoneForm() {
  const [state, formAction] = useActionState(savePhoneAction, initialState);
  const invalid = state?.ok === false || undefined;
  const { t } = useT();

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="auth-form" noValidate>
        <PhoneField invalid={invalid} />
        {state?.ok === false ? (
          <p role="alert" className="auth-error">
            {state.error_sr}
          </p>
        ) : null}
        <SubmitButton t={t} />
      </form>
      <form action={skipPhoneAction}>
        <button type="submit" className="auth-btn auth-btn-ghost">
          {t("auth.phoneForm.skip")}
        </button>
      </form>
    </div>
  );
}
