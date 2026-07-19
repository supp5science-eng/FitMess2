"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { PasswordInput } from "../password-input";
import { resetPasswordAction, type AuthFormState } from "../actions";

const initialState: AuthFormState = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="auth-btn auth-btn-primary" disabled={pending}>
      {pending ? "Čuvanje…" : "Sačuvaj novu lozinku"}
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

  return (
    <form action={formAction} className="auth-form" noValidate>
      <PasswordInput
        name="password"
        label="Nova lozinka"
        placeholder="••••••••"
        autoComplete="new-password"
        minLength={8}
        invalid={invalid}
      />
      <PasswordInput
        name="confirmPassword"
        label="Ponovi novu lozinku"
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
      <SubmitButton />
    </form>
  );
}
