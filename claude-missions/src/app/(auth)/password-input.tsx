"use client";

import { useId, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";

/** Eye / eye-off icons for the reveal toggle (hand-rolled to keep the auth
 * forms free of icon-library imports, matching the Google mark). */
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" />
      <path d="M6.06 6.06C3.53 7.6 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.94-1.94" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

/**
 * Password field with a show/hide reveal toggle, shared by the sign-in and
 * sign-up forms.
 *
 * iOS-minded details:
 *  - `onPointerDown` preventDefault on the toggle keeps the input focused, so
 *    tapping the eye never dismisses the iOS keyboard or moves the caret.
 *  - 44×44px hit area on the toggle (Apple HIG minimum touch target).
 *  - `autoCapitalize`/`autoCorrect`/`spellCheck` off so iOS never mangles the
 *    typed password; the input font is 16px (via `.auth-input`) to stop iOS
 *    Safari zooming in on focus.
 */
export function PasswordInput({
  name,
  label,
  autoComplete,
  placeholder,
  minLength,
  invalid,
}: {
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  minLength?: number;
  invalid?: true | undefined;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const { t } = useT();

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-input-wrap">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          className="auth-input auth-input--password"
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          minLength={minLength}
          required
          aria-invalid={invalid}
        />
        <button
          type="button"
          className="auth-reveal"
          // Keep the input focused (and the iOS keyboard open) when tapping.
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? t("auth.password.hide") : t("auth.password.show")}
          aria-pressed={visible}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}
