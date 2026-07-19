"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { verifyEmailCodeAction, type AuthFormState } from "../../actions";

const initialState: AuthFormState = null;

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="auth-btn auth-btn-primary"
      disabled={pending || disabled}
    >
      {pending ? "Potvrđivanje…" : "Potvrdi nalog"}
    </button>
  );
}

/**
 * In-app signup confirmation: the user types the 6-digit code from the email
 * instead of clicking the link (which on iOS opens Safari/Chrome and drops
 * them out of the installed PWA). On success the action signs them in and
 * redirects into the app.
 *
 * iOS-minded: `inputMode="numeric"` shows the number pad, `autoComplete=
 * "one-time-code"` lets iOS autofill the code straight from the email, 16px
 * font (`.auth-input`) stops Safari zooming on focus, and the input is
 * digits-only + capped at 6 so nothing invalid is even typeable.
 */
export function VerifyCodeForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(verifyEmailCodeAction, initialState);
  const [code, setCode] = useState("");
  const invalid = state?.ok === false || undefined;

  return (
    <form action={formAction} className="auth-form" noValidate>
      <input type="hidden" name="email" value={email} />
      <div className="auth-field">
        <label htmlFor="verify-code">Kod iz mejla</label>
        <input
          id="verify-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          className="auth-input"
          style={{
            textAlign: "center",
            letterSpacing: "0.5em",
            fontSize: "1.5rem",
            fontWeight: 700,
          }}
          placeholder="______"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          aria-invalid={invalid}
        />
      </div>
      {state?.ok === false ? (
        <p role="alert" className="auth-error">
          {state.error_sr}
        </p>
      ) : null}
      <SubmitButton disabled={code.length !== 6} />
    </form>
  );
}
