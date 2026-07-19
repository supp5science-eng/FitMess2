"use client";

import { useState } from "react";

/**
 * Country dial codes offered on the signup phone field. Serbia (+381) is first
 * and the default; the rest are the neighbouring countries plus the common
 * Serbian-diaspora destinations, so most users find theirs without a huge list.
 * Flags are plain emoji (render natively on iOS, our only real target).
 */
const COUNTRIES = [
  { code: "+381", flag: "🇷🇸", name: "Srbija" },
  { code: "+387", flag: "🇧🇦", name: "Bosna i Hercegovina" },
  { code: "+382", flag: "🇲🇪", name: "Crna Gora" },
  { code: "+385", flag: "🇭🇷", name: "Hrvatska" },
  { code: "+389", flag: "🇲🇰", name: "Severna Makedonija" },
  { code: "+386", flag: "🇸🇮", name: "Slovenija" },
  { code: "+49", flag: "🇩🇪", name: "Nemačka" },
  { code: "+43", flag: "🇦🇹", name: "Austrija" },
  { code: "+41", flag: "🇨🇭", name: "Švajcarska" },
  { code: "+33", flag: "🇫🇷", name: "Francuska" },
  { code: "+39", flag: "🇮🇹", name: "Italija" },
  { code: "+46", flag: "🇸🇪", name: "Švedska" },
  { code: "+44", flag: "🇬🇧", name: "Velika Britanija" },
  { code: "+1", flag: "🇺🇸", name: "SAD / Kanada" },
  { code: "+61", flag: "🇦🇺", name: "Australija" },
];

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
          defaultValue="+381"
          className="auth-input auth-phone-cc"
          aria-label="Pozivni broj države"
        >
          {COUNTRIES.map((country) => (
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
