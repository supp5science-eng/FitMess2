"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { SR_AUTH_MESSAGES } from "@/lib/auth/errors";
import { forgotPasswordAction, type AuthFormState } from "../actions";

const initialState: AuthFormState = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="auth-btn auth-btn-primary" disabled={pending}>
      {pending ? "Slanje…" : "Pošalji link"}
    </button>
  );
}

/**
 * Password-recovery request form. Deliberately shows the same neutral
 * "check your email" notice on success no matter whether the email has an
 * account (non-enumeration -- the action never tells us which it was).
 */
export function ForgotPasswordForm({ email }: { email?: string }) {
  const [state, formAction] = useActionState(forgotPasswordAction, initialState);
  const invalid = state?.ok === false || undefined;

  return (
    <form action={formAction} className="auth-form" noValidate>
      <div className="auth-field">
        <label htmlFor="forgot-email">Email</label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          inputMode="email"
          className="auth-input"
          placeholder="ti@email.com"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={email}
          required
          aria-invalid={invalid}
        />
      </div>
      {state?.ok === true ? (
        <p role="status" className="auth-notice">
          {SR_AUTH_MESSAGES.passwordResetSent}
        </p>
      ) : null}
      {state?.ok === false ? (
        <p role="alert" className="auth-error">
          {state.error_sr}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
