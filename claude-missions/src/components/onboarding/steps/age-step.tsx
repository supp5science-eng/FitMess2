"use client";

import { WheelPicker } from "@/components/onboarding/wheel-picker";
import { rangeInclusive } from "@/components/onboarding/select-field";
import { MAX_AGE_YEARS, MIN_AGE_YEARS } from "@/lib/onboarding/validation";

const AGE_OPTIONS = rangeInclusive(MIN_AGE_YEARS, MAX_AGE_YEARS);

/** F015 step 2 (godine) -- AS-019: collects age in whole years via an inline
 * scroll wheel (Cal-AI look). */
export function AgeStep({
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
          Koliko imaš godina?
        </h2>
        <p className="text-sm text-muted-foreground">
          Godine su deo formule za tvoj dnevni cilj kalorija.
        </p>
      </div>
      <WheelPicker
        id="godine"
        label="Godine"
        value={value}
        onChange={onChange}
        options={AGE_OPTIONS}
        placeholder="Izaberi godine"
        renderOption={(v) => `${v} god.`}
        error={error}
        autoFocus
      />
    </div>
  );
}
