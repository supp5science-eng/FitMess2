"use client";

import type { ActivityLevel } from "@/lib/types/db";
import { ACTIVITY_LEVEL_OPTIONS } from "@/lib/onboarding/types";
import { FieldError } from "@/components/onboarding/field-error";
import {
  IconOptionGroup,
  type IconOptionItem,
} from "@/components/onboarding/icon-option-group";

/** Hand-rolled "intensity" glyph: `level` filled dots (1..5) in a small cluster
 *  that grows with the activity tier. `aria-hidden` -- the accessible name comes
 *  from the option's label + description. */
function IntensityDots({ level }: { level: number }) {
  const layouts: Record<number, [number, number][]> = {
    1: [[12, 12]],
    2: [[9, 12], [15, 12]],
    3: [[9, 9], [15, 9], [12, 15]],
    4: [[9, 9], [15, 9], [9, 15], [15, 15]],
    5: [[9, 9], [15, 9], [12, 12], [9, 15], [15, 15]],
  };
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      {(layouts[level] ?? layouts[1]).map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2" />
      ))}
    </svg>
  );
}

/** The five tiers get an icon each; harder tiers get more dots (see IntensityDots). */
const ACTIVITY_OPTIONS: IconOptionItem<ActivityLevel>[] =
  ACTIVITY_LEVEL_OPTIONS.map((option, index) => ({
    ...option,
    icon: <IntensityDots level={index + 1} />,
  }));

/** F015 step 5 (nivo aktivnosti) -- AS-019: collects one of 5 activity tiers. */
export function ActivityStep({
  value,
  onChange,
  error,
}: {
  value: ActivityLevel | null;
  onChange: (value: ActivityLevel) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Koliko si aktivan/aktivna?
        </h2>
        <p className="text-sm text-muted-foreground">
          Izaberi opciju koja najbolje opisuje tvoju nedelju.
        </p>
      </div>
      <IconOptionGroup
        legend="Nivo aktivnosti"
        options={ACTIVITY_OPTIONS}
        value={value}
        onChange={onChange}
      />
      <FieldError message={error} />
    </div>
  );
}
