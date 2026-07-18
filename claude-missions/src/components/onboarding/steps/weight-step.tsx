"use client";

import { useEffect } from "react";

import { FieldError } from "@/components/onboarding/field-error";
import { WheelPicker } from "@/components/onboarding/wheel-picker";
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG } from "@/lib/onboarding/validation";

const DEFAULT_WEIGHT_KG = 75;

/** F015 step 4 (težina) -- AS-019: collects current weight in kilograms via
 * the same iOS-style scroll wheel the height step uses (35-300 kg, rests on
 * 75). The drum sits on a sensible default so the user just scrolls up/down to
 * their weight -- matching the native iOS picker feel. */
export function WeightStep({
  value,
  onChange,
  error,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
}) {
  // Rest the drum on a sensible default so the user can scroll from there (or
  // accept 75 outright) -- mirrors the height step.
  useEffect(() => {
    if (value === null) onChange(DEFAULT_WEIGHT_KG);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = value ?? DEFAULT_WEIGHT_KG;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Kolika je tvoja trenutna težina?
        </h2>
        <p className="text-sm text-muted-foreground">
          Skroluj i namesti težinu u kilogramima -- ovo je tvoja polazna tačka.
        </p>
      </div>

      <WheelPicker
        min={MIN_WEIGHT_KG}
        max={MAX_WEIGHT_KG}
        value={current}
        onChange={(next) => onChange(next)}
        suffix="kg"
        ariaLabel="Težina u kilogramima"
      />

      <FieldError message={error} id="tezina-error" />
    </div>
  );
}
