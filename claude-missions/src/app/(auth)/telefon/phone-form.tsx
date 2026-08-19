"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { useT } from "@/components/i18n/locale-provider";
import type { TFunction } from "@/lib/i18n/translate";
import { savePhoneAction, type AuthFormState } from "../actions";
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
 * 5.1.1(v) requires and Sign in with Apple's Hide My Email assumes.
 *
 * It is a LINK, not a second submit button, and that is the whole fix for the
 * bug where it did nothing on a real device. Two reasons, in order of weight:
 *
 *  1. **It cannot be broken by anything the save form depends on.** A link
 *     needs no hydration, no Server Action id that has to survive a deploy, no
 *     POST for a service worker to ignore, and no redirect for a web view to
 *     follow. The way out of this screen now has strictly fewer moving parts
 *     than the screen itself. See `./preskoci/route.ts`.
 *  2. A half-typed, invalid number in the field still cannot block the way out
 *     — the original reason this was a separate `<form>` rather than a second
 *     button on the save form. A link keeps that property for free.
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
      {/* Plain <a>, never `next/link`: no prefetch means no way for the app to
          answer the ask on the user's behalf before they tap. */}
      <a href="/telefon/preskoci" className="auth-btn auth-btn-ghost">
        {t("auth.phoneForm.skip")}
      </a>
    </div>
  );
}
