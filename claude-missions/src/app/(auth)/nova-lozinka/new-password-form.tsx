"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { useT } from "@/components/i18n/locale-provider";
import type { TFunction } from "@/lib/i18n/translate";
import { PasswordInput } from "../password-input";
import { resetPasswordAction, type AuthFormState } from "../actions";

const initialState: AuthFormState = null;

function SubmitButton({ t }: { t: TFunction }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="auth-btn auth-btn-primary" disabled={pending}>
      {pending ? t("auth.saving") : t("auth.newPassword.save")}
    </button>
  );
}

/**
 * Set-new-password form. Relies on the recovery session that `/auth/confirm`
 * established from the emailed link; on success the action redirects into the
 * app, so there is no "success" state to render here -- only inline errors
 * (mismatched passwords, too short, or an expired recovery session).
 */
export function NewPasswordForm() {
  const [state, formAction] = useActionState(resetPasswordAction, initialState);
  const invalid = state?.ok === false || undefined;
  const { t } = useT();

  return (
    <form action={formAction} className="auth-form" noValidate>
      <PasswordInput
        name="password"
        label={t("auth.field.newPassword")}
        placeholder="••••••••"
        autoComplete="new-password"
        minLength={8}
        invalid={invalid}
      />
      <PasswordInput
        name="confirmPassword"
        label={t("auth.field.confirmNewPassword")}
        placeholder="••••••••"
        autoComplete="new-password"
        minLength={8}
        invalid={invalid}
      />
      {state?.ok === false ? (
        <p role="alert" className="auth-error">
          {state.error_sr}
        </p>
      ) : null}
      <SubmitButton t={t} />
    </form>
  );
}
