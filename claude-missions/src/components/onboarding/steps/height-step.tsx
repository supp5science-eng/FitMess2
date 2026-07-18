"use client";

import { useEffect } from "react";

import { FieldError } from "@/components/onboarding/field-error";
import { WheelPicker } from "@/components/onboarding/wheel-picker";
import { MAX_HEIGHT_CM, MIN_HEIGHT_CM } from "@/lib/onboarding/validation";

const DEFAULT_HEIGHT_CM = 175;

/** F015 step 3 (visina) -- AS-019: collects height in centimeters via an
 * iOS-style scroll wheel (100-250 cm, defaults to 175). */
export function HeightStep({
  value,
  onChange,
  error,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
}) {
  // Start the drum on a sensible default so the user can just scroll from
  // there (or accept 175 outright).
  useEffect(() => {
    if (value === null) onChange(DEFAULT_HEIGHT_CM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = value ?? DEFAULT_HEIGHT_CM;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Kolika je tvoja visina?
        </h2>
        <p className="text-sm text-muted-foreground">
          Skroluj i namesti visinu u centimetrima.
        </p>
      </div>

      <WheelPicker
        min={MIN_HEIGHT_CM}
        max={MAX_HEIGHT_CM}
        value={current}
        onChange={(next) => onChange(next)}
        suffix="cm"
        ariaLabel="Visina u centimetrima"
      />

      <FieldError message={error} id="visina-error" />
    </div>
  );
}
