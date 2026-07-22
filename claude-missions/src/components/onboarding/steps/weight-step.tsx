"use client";

import { useState } from "react";

import { RulerPicker } from "@/components/onboarding/ruler-picker";
import { UnitToggle } from "@/components/onboarding/unit-toggle";
import { rangeInclusive } from "@/components/onboarding/select-field";
import { kgToLbs } from "@/lib/onboarding/units";
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG } from "@/lib/onboarding/validation";

const WEIGHT_OPTIONS = rangeInclusive(MIN_WEIGHT_KG, MAX_WEIGHT_KG);

type WeightUnit = "kg" | "lbs";

/** F015 step 4 (težina) -- AS-019: collects current weight in kilograms via an
 * inline ruler picker. A display-only unit toggle can show lbs; the stored
 * value stays kg. */
export function WeightStep({
  value,
  onChange,
  error,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
}) {
  const [unit, setUnit] = useState<WeightUnit>("kg");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Kolika je tvoja trenutna težina?
        </h2>
        <p className="text-sm text-muted-foreground">
          Ovo je tvoja polazna tačka.
        </p>
      </div>
      <UnitToggle
        ariaLabel="Jedinica za težinu"
        options={[
          { value: "lbs", label: "lbs" },
          { value: "kg", label: "kg" },
        ]}
        value={unit}
        onChange={setUnit}
      />
      <RulerPicker
        id="tezina"
        label="Težina"
        caption="Trenutna težina"
        value={value}
        onChange={onChange}
        options={WEIGHT_OPTIONS}
        renderReadout={(v) => (unit === "kg" ? `${v} kg` : `${kgToLbs(v)} lbs`)}
        error={error}
        autoFocus
      />
    </div>
  );
}
