"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signInAction, type AuthFormState } from "../actions";
import { PasswordInput } from "../password-input";

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
export function SignInForm({ initialEmail }: { initialEmail?: string }) {
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
          inputMode="email"
          className="auth-input"
          defaultValue={initialEmail}
          placeholder="ti@email.com"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          aria-invalid={invalid}
        />
      </div>
      <PasswordInput
        name="password"
        label="Lozinka"
        placeholder="••••••••"
        autoComplete="current-password"
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
