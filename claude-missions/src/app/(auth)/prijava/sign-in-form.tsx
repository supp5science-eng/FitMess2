"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signInAction, type AuthFormState } from "../actions";

const initialState: AuthFormState = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="auth-btn auth-btn-primary" disabled={pending}>
      {pending ? "Prijava u toku…" : "Prijavi se"}
    </button>
  );
}

/** AS-009 / AS-017: email + password login form. */
export function SignInForm() {
  const [state, formAction] = useActionState(signInAction, initialState);
  const invalid = state?.ok === false || undefined;

  return (
    <form action={formAction} className="auth-form" noValidate>
      <div className="auth-field">
        <label htmlFor="signin-email">Email</label>
        <input
          id="signin-email"
          name="email"
          type="email"
          className="auth-input"
          placeholder="ti@email.com"
          autoComplete="email"
          required
          aria-invalid={invalid}
        />
      </div>
      <div className="auth-field">
        <label htmlFor="signin-password">Lozinka</label>
        <input
          id="signin-password"
          name="password"
          type="password"
          className="auth-input"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          aria-invalid={invalid}
        />
      </div>
      {state?.ok === false ? (
        <p role="alert" className="auth-error">
          {state.error_sr}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
