"use client";

import type { GoalType } from "@/lib/types/db";
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

const GOAL_OPTIONS: IconOptionItem<GoalType>[] = [
  {
    value: "lose",
    label: "Smršaj",
    description: "Skini kilograme uz kontrolisan kalorijski deficit.",
    icon: <GoalIcon goal="lose" />,
  },
  {
    value: "tone",
    label: "Zategni se",
    description:
      "Blagi deficit da izgubiš salo i dobiješ čvrstu, zategnutu liniju.",
    icon: <GoalIcon goal="tone" />,
  },
  {
    value: "gain",
    label: "Nabaci mišiće",
    description:
      "Kalorijski višak da izgradiš čistu mišićnu masu i postaneš jači.",
    icon: <GoalIcon goal="gain" />,
  },
  {
    value: "maintain",
    label: "Održavanje",
    description: "Zadrži trenutnu težinu i navike.",
    icon: <GoalIcon goal="maintain" />,
  },
];

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
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Koji ti je cilj?
        </h2>
        <p className="text-sm text-muted-foreground">
          Po ovome računamo tvoj dnevni unos i prilagođavamo plan.
        </p>
      </div>
      <IconOptionGroup
        legend="Cilj"
        options={GOAL_OPTIONS}
        value={value}
        onChange={onChange}
        size="compact"
      />
      <FieldError message={error} />
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-sm font-medium text-foreground">
          Zašto tražimo ove podatke?
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Koristimo ih isključivo da tvoj plan izračunamo što tačnije, prema
          tvom cilju — po proverenim naučnim formulama (Mifflin-St Jeor), a ne
          po nasumičnim brojkama sa interneta.
        </p>
      </div>
    </div>
  );
}
