"use client";

import { useMemo, useState } from "react";

import { FieldError } from "@/components/onboarding/field-error";
import { Label } from "@/components/ui/label";
import {
  WheelColumn,
  WHEEL_ITEM_H,
  WHEEL_VISIBLE_ROWS,
} from "@/components/onboarding/wheel-column";
import { MAX_AGE_YEARS, MIN_AGE_YEARS } from "@/lib/onboarding/validation";

const MONTHS_SR = [
  "Januar",
  "Februar",
  "Mart",
  "April",
  "Maj",
  "Jun",
  "Jul",
  "Avgust",
  "Septembar",
  "Oktobar",
  "Novembar",
  "Decembar",
];

function daysInMonth(year: number, month: number): number {
  // month is 1-based; day 0 of next month == last day of this month.
  return new Date(year, month, 0).getDate();
}

/** Whole years elapsed from a birth date to `now` (matches
 *  `ageYearsToBirthYear`'s year-based rounding once the birthday has passed). */
function computeAge(
  year: number,
  month: number,
  day: number,
  now: Date
): number {
  let age = now.getFullYear() - year;
  const nowMonth = now.getMonth() + 1;
  const hadBirthday =
    nowMonth > month || (nowMonth === month && now.getDate() >= day);
  if (!hadBirthday) age -= 1;
  return age;
}

/**
 * F015 step "godine": collects an exact date of birth via three inline scroll
 * wheels (month / day / year), then derives whole-year age for the model
 * (`ageYears`) — the store and calorie math are unchanged.
 *
 * The source of truth is a visually-hidden labeled `<input>` holding the
 * derived age (what AT + `getByLabelText` drive); the three wheels are
 * decorative (`aria-hidden`) and write the same value.
 */
export function DateOfBirthPicker({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
}) {
  const errorId = `${id}-error`;
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();

  const yearOptions = useMemo(() => {
    const oldest = currentYear - MAX_AGE_YEARS;
    const youngest = currentYear - MIN_AGE_YEARS;
    return Array.from({ length: youngest - oldest + 1 }, (_, i) => oldest + i);
  }, [currentYear]);

  // Local DOB state; seed a plausible full date from the incoming age. The
  // step unmounts when you leave it, so this initializer also re-seeds the
  // wheels from the stored age on Back navigation.
  const [birth, setBirth] = useState(() => ({
    year: currentYear - (value ?? MIN_AGE_YEARS),
    month: now.getMonth() + 1,
    day: now.getDate(),
  }));

  function commit(next: { year: number; month: number; day: number }) {
    const maxDay = daysInMonth(next.year, next.month);
    const day = Math.min(next.day, maxDay);
    const fixed = { ...next, day };
    setBirth(fixed);
    const age = Math.min(
      MAX_AGE_YEARS,
      Math.max(MIN_AGE_YEARS, computeAge(fixed.year, fixed.month, fixed.day, now))
    );
    if (age !== value) onChange(age);
  }

  const maxDay = daysInMonth(birth.year, birth.month);
  const dayOptions = Array.from({ length: maxDay }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>

      {/* Source of truth: accessible + test-driven, visually hidden. */}
      <input
        id={id}
        name={id}
        type="text"
        inputMode="none"
        value={value === null ? "" : String(value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isNaN(parsed) ? null : parsed);
        }}
        className="sr-only"
      />

      {/* Three decorative wheels sharing one center pill. */}
      <div
        aria-hidden
        className="relative select-none"
        style={{ height: WHEEL_VISIBLE_ROWS * WHEEL_ITEM_H }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-2xl bg-muted"
          style={{ height: WHEEL_ITEM_H }}
        />
        <div className="flex h-full">
          <WheelColumn
            className="flex-[1.4]"
            align="center"
            options={MONTHS_SR.map((name, i) => ({
              key: String(i + 1),
              label: name,
            }))}
            selectedKey={String(birth.month)}
            onSelect={(key) => commit({ ...birth, month: Number(key) })}
          />
          <WheelColumn
            className="flex-[0.8]"
            align="center"
            options={dayOptions.map((d) => ({ key: String(d), label: String(d) }))}
            selectedKey={String(Math.min(birth.day, maxDay))}
            onSelect={(key) => commit({ ...birth, day: Number(key) })}
          />
          <WheelColumn
            className="flex-1"
            align="center"
            options={yearOptions.map((y) => ({
              key: String(y),
              label: String(y),
            }))}
            selectedKey={String(birth.year)}
            onSelect={(key) => commit({ ...birth, year: Number(key) })}
          />
        </div>
      </div>

      <FieldError message={error} id={errorId} />
    </div>
  );
}
