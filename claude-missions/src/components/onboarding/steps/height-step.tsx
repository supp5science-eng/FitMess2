"use client";

import { NumberField } from "@/components/onboarding/number-field";

/** F015 step 3 (visina) -- AS-019: collects height in centimeters via a simple
 * numeric field. */
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
          Unesi visinu u centimetrima.
        </p>
      </div>
      <NumberField
        id="visina"
        label="Visina"
        suffix="cm"
        value={value}
        onChange={onChange}
        error={error}
        autoFocus
      />
    </div>
  );
}
