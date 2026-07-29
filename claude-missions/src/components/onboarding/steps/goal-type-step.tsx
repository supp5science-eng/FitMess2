"use client";

import type { GoalType } from "@/lib/types/db";
import { useT } from "@/components/i18n/locale-provider";
import { FieldError } from "@/components/onboarding/field-error";
import {
  IconOptionGroup,
  type IconOptionItem,
} from "@/components/onboarding/icon-option-group";

/** Hand-rolled goal glyphs (no icon-lib dependency): trend-down for a deficit,
 *  a spark for toning, trend-up for a surplus, an "equals" for maintenance.
 *  `aria-hidden` -- the accessible name is the option's label + description. */
function GoalIcon({ goal }: { goal: GoalType }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "size-5",
    "aria-hidden": true,
  };
  switch (goal) {
    case "lose":
      return (
        <svg {...common}>
          <path d="M16 17h6v-6" />
          <path d="m22 17-8.5-8.5-5 5L2 7" />
        </svg>
      );
    case "gain":
      return (
        <svg {...common}>
          <path d="M16 7h6v6" />
          <path d="m22 7-8.5 8.5-5-5L2 17" />
        </svg>
      );
    case "maintain":
      return (
        <svg {...common}>
          <path d="M5 9h14" />
          <path d="M5 15h14" />
        </svg>
      );
    case "tone":
    default:
      return (
        <svg {...common}>
          <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
        </svg>
      );
  }
}

/** Onboarding step: the user's overall objective. Drives the calorie math
 * (`planForGoal`) and whether the target-weight step is shown next. */
export function GoalTypeStep({
  value,
  onChange,
  error,
}: {
  value: GoalType | null;
  onChange: (value: GoalType) => void;
  error?: string;
}) {
  const { t } = useT();
  const GOAL_OPTIONS: IconOptionItem<GoalType>[] = [
    {
      value: "lose",
      label: t("onboarding.goalType.loseLabel"),
      description: t("onboarding.goalType.loseDesc"),
      icon: <GoalIcon goal="lose" />,
    },
    {
      value: "tone",
      label: t("onboarding.goalType.toneLabel"),
      description: t("onboarding.goalType.toneDesc"),
      icon: <GoalIcon goal="tone" />,
    },
    {
      value: "gain",
      label: t("onboarding.goalType.gainLabel"),
      description: t("onboarding.goalType.gainDesc"),
      icon: <GoalIcon goal="gain" />,
    },
    {
      value: "maintain",
      label: t("onboarding.goalType.maintainLabel"),
      description: t("onboarding.goalType.maintainDesc"),
      icon: <GoalIcon goal="maintain" />,
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {t("onboarding.goalType.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("onboarding.goalType.subtitle")}
        </p>
      </div>
      <IconOptionGroup
        legend={t("onboarding.goalType.legend")}
        options={GOAL_OPTIONS}
        value={value}
        onChange={onChange}
        size="compact"
      />
      <FieldError message={error} />
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-sm font-medium text-foreground">
          {t("onboarding.goalType.whyTitle")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t("onboarding.goalType.whyBody")}
        </p>
      </div>
    </div>
  );
}
