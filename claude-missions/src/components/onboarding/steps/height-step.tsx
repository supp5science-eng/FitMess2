"use client";

import { WheelPicker } from "@/components/onboarding/wheel-picker";
import { rangeInclusive } from "@/components/onboarding/select-field";
import { MAX_HEIGHT_CM, MIN_HEIGHT_CM } from "@/lib/onboarding/validation";

const HEIGHT_OPTIONS = rangeInclusive(MIN_HEIGHT_CM, MAX_HEIGHT_CM);

/** F015 step 3 (visina) -- AS-019: collects height in centimeters via an inline
 * scroll wheel. */
export function HeightStep({
  value,
  onChange,
  error,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Kolika je tvoja visina?
        </h2>
        <p className="text-sm text-muted-foreground">
          Skroluj do svoje visine.
        </p>
      </div>
      <WheelPicker
        id="visina"
        label="Visina"
        value={value}
        onChange={onChange}
        options={HEIGHT_OPTIONS}
        renderOption={(v) => `${v} cm`}
        error={error}
      />
    </div>
  );
}
