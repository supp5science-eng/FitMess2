"use client";

import { useState } from "react";

import { DEFAULT_DIAL_CODE, DIAL_CODES } from "@/lib/auth/dial-codes";

/**
 * Mandatory signup phone field: a country dial-code picker (native `<select>`,
 * so on iOS it opens the system wheel) defaulting to +381 🇷🇸, plus the local
 * number. The two post as `phone_cc` + `phone_local`; `signUpAction` recombines
 * them with `normalizePhone` into an E.164 string stored on the profile.
 *
 * iOS-minded: `type="tel"` + `inputMode="numeric"` shows the number pad,
 * `autoComplete="tel-national"` offers the saved number, 16px font
 * (`.auth-input`) stops Safari zooming on focus.
 */
export function PhoneField({ invalid }: { invalid?: true | undefined }) {
  const [local, setLocal] = useState("");

  return (
    <div className="auth-field">
      <label htmlFor="signup-phone">Broj telefona</label>
      <div className="auth-phone">
        <select
          name="phone_cc"
          defaultValue={DEFAULT_DIAL_CODE}
          className="auth-input auth-phone-cc"
          aria-label="Pozivni broj države"
        >
          {DIAL_CODES.map((country) => (
            <option key={`${country.code} ${country.name}`} value={country.code}>
              {country.flag} {country.code}
            </option>
          ))}
        </select>
        <input
          id="signup-phone"
          name="phone_local"
          type="tel"
          inputMode="numeric"
          className="auth-input auth-phone-local"
          placeholder="60 1234 567"
          autoComplete="tel-national"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={local}
          // Keep only digits and spaces as the user types; the action strips
          // everything but digits anyway when it builds the E.164 value.
          onChange={(event) =>
            setLocal(event.target.value.replace(/[^\d\s]/g, ""))
          }
          aria-invalid={invalid}
        />
      </div>
    </div>
  );
}
