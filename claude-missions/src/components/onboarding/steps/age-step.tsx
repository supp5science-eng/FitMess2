"use client";

import { SelectField, rangeInclusive } from "@/components/onboarding/select-field";
import { MAX_AGE_YEARS, MIN_AGE_YEARS } from "@/lib/onboarding/validation";

const AGE_OPTIONS = rangeInclusive(MIN_AGE_YEARS, MAX_AGE_YEARS);

/** F015 step 2 (godine) -- AS-019: collects age in whole years via a native
 * wheel/select (iOS renders its system picker). */
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
      <SelectField
        id="godine"
        label="Godine"
        value={value}
        onChange={onChange}
        options={AGE_OPTIONS}
        placeholder="Izaberi godine"
        error={error}
        autoFocus
      />
    </div>
  );
}
