"use client";

import { FieldError } from "@/components/onboarding/field-error";
import { WheelPicker } from "@/components/onboarding/wheel-picker";
import { MAX_AGE_YEARS, MIN_AGE_YEARS } from "@/lib/onboarding/validation";

/**
 * F015 step 2 (godine) -- AS-019: collects age via an iOS-style birth-year
 * wheel (the same `WheelPicker` the height step uses), matching the native
 * date-picker feel on iOS.
 *
 * The wheel is expressed in *birth years* (it rests on the current year and
 * the user scrolls back to theirs), but the wizard still stores plain
 * `ageYears` -- so validation, the budget engine and the summary all stay
 * untouched. We map year <-> age right here: `age = CURRENT_YEAR - year`.
 *
 * We deliberately do NOT auto-commit a default (unlike the height step): the
 * wheel merely *rests* on the current year, and `ageYears` stays null until
 * the user actually spins/taps to a year, so an untouched step degrades to the
 * "Unesi svoje godine." validation rather than silently claiming age 0.
 */
const CURRENT_YEAR = new Date().getFullYear();
const MAX_BIRTH_YEAR = CURRENT_YEAR; // where the wheel opens
const MIN_BIRTH_YEAR = CURRENT_YEAR - MAX_AGE_YEARS; // 100 years back

export function AgeStep({
  value,
  onChange,
  error,
}: {
  value: number | null; // age in years
  onChange: (value: number | null) => void;
  error?: string;
}) {
  const birthYear = value != null ? CURRENT_YEAR - value : null;
  const isValidAge =
    value != null && value >= MIN_AGE_YEARS && value <= MAX_AGE_YEARS;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Koliko imaš godina?
        </h2>
        <p className="text-sm text-muted-foreground">
          Skroluj i izaberi godinu rođenja.
        </p>
      </div>

      <WheelPicker
        min={MIN_BIRTH_YEAR}
        max={MAX_BIRTH_YEAR}
        value={birthYear ?? MAX_BIRTH_YEAR}
        onChange={(year) => onChange(CURRENT_YEAR - year)}
        ariaLabel="Godina rođenja"
      />

      <p
        className="min-h-5 text-center text-sm text-muted-foreground"
        aria-live="polite"
      >
        {isValidAge ? `${value} godina` : " "}
      </p>

      <FieldError message={error} id="godine-error" />
    </div>
  );
}
