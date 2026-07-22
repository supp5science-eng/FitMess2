"use client";

import { useState } from "react";

import { WheelPicker } from "@/components/onboarding/wheel-picker";
import { UnitToggle } from "@/components/onboarding/unit-toggle";
import { rangeInclusive } from "@/components/onboarding/select-field";
import { formatFeetInches } from "@/lib/onboarding/units";
import { MAX_HEIGHT_CM, MIN_HEIGHT_CM } from "@/lib/onboarding/validation";

const HEIGHT_OPTIONS = rangeInclusive(MIN_HEIGHT_CM, MAX_HEIGHT_CM);

type HeightUnit = "cm" | "ft";

/** F015 step 3 (visina) -- AS-019: collects height in centimeters via an inline
 * scroll wheel. A display-only unit toggle can show ft·in; the stored value
 * stays cm. */
export function HeightStep({
  value,
  onChange,
  error,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
}) {
  const [unit, setUnit] = useState<HeightUnit>("cm");

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
      <UnitToggle
        ariaLabel="Jedinica za visinu"
        options={[
          { value: "ft", label: "ft, in" },
          { value: "cm", label: "cm" },
        ]}
        value={unit}
        onChange={setUnit}
      />
      <WheelPicker
        id="visina"
        label="Visina"
        value={value}
        onChange={onChange}
        options={HEIGHT_OPTIONS}
        placeholder="Izaberi visinu"
        renderOption={(v) => (unit === "cm" ? `${v} cm` : formatFeetInches(v))}
        error={error}
        autoFocus
      />
    </div>
  );
}
