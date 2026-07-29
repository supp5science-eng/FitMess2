"use client";

import { useT } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";
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
  const { t } = useT();
  // The five tiers get an icon each; harder tiers get more dots. Labels resolve
  // through `t()` so they follow the chosen language.
  const options: IconOptionItem<ActivityLevel>[] = ACTIVITY_LEVEL_OPTIONS.map(
    (option, index) => ({
      value: option.value,
      label: t(option.labelKey as MessageKey),
      description: t(option.descriptionKey as MessageKey),
      icon: <IntensityDots level={index + 1} />,
    })
  );
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {t("onboarding.activity.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("onboarding.activity.subtitle")}
        </p>
      </div>
      <IconOptionGroup
        legend={t("onboarding.activity.legend")}
        options={options}
        value={value}
        onChange={onChange}
        size="compact"
      />
      <FieldError message={error} />
    </div>
  );
}
