"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signUpAction, type AuthFormState } from "../actions";
import { PasswordInput } from "../password-input";
import { PhoneField } from "./phone-field";

const initialState: AuthFormState = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="auth-btn auth-btn-primary" disabled={pending}>
      {pending ? "Registracija u toku…" : "Napravi nalog"}
    </button>
  );
}

/** AS-008: email + password signup form. */
export function SignUpForm({ initialEmail }: { initialEmail?: string }) {
  const [state, formAction] = useActionState(signUpAction, initialState);
  const invalid = state?.ok === false || undefined;

  return (
    <form action={formAction} className="auth-form" noValidate>
      <div className="auth-field">
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
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
      <PhoneField invalid={invalid} />
      <PasswordInput
        name="password"
        label="Lozinka"
        placeholder="Bar 8 karaktera"
        autoComplete="new-password"
        minLength={8}
        invalid={invalid}
      />
      {/* Explicit consent, unticked by default. What the app stores is health
          data (weight, intake, a weight-loss goal), and GDPR art. 9 allows it
          on explicit consent only — which means a deliberate act, not a notice
          under the button. See `consentSchema`; the server re-checks it, so
          removing the box in the browser does not create an account. */}
      <label className="auth-consent">
        <input type="checkbox" name="consent" required aria-invalid={invalid} />
        <span>
          Pročitao/la sam{" "}
          <Link href="/uslovi">uslove korišćenja</Link> i{" "}
          <Link href="/privatnost">politiku privatnosti</Link> i pristajem da
          FitMess obrađuje moje podatke o ishrani i telesnoj težini da bi mi
          računao plan.
        </span>
      </label>
      {state?.ok === false ? (
        <p role="alert" className="auth-error">
          {state.error_sr}
          {state.reason === "already_registered" ? (
            <>
              {" "}
              <Link href="/prijava">Prijavi se</Link>
            </>
          ) : null}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
