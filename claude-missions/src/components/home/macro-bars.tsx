import { Beef, Droplet, Wheat, type LucideIcon } from "lucide-react";

import { AnimatedNumber } from "@/components/home/animated-number";
import { useT } from "@/components/i18n/locale-provider";
import type { RingView } from "@/components/home/ring";

// F027 / AS-048: the three macros (Proteini / UH / Masti) shown below the
// calorie card. Pure, presentational; the numbers come in as props
// (`src/lib/home/totals.ts` computes the consumed side, the newest `targets`
// row provides the target side).
//
// Redesign (2026-07-30, "Cal AI"): each macro is its own floating card
// (`bg-card` + `.fm-lift`) with the grams the toggle selected big at the top,
// its label under it, and a progress ring with the macro's icon centred --
// protein a cut of beef, carbs wheat, fat an oil droplet. The ring fill is same
// consumed/target ratio the old bar showed (capped at 100%); the number always
// shows the real value. Icons are lucide `<svg>` (never `<img>`, per AS-128).

interface MacroConfig {
  key: "protein" | "fat" | "carbs";
  labelKey: "macro.protein" | "macro.fat" | "macro.carbs";
  color: string;
  Icon: LucideIcon;
  testId: string;
}

// Driven by the themed `--macro-*` tokens in `globals.css`, so each colour is
// right for dark AND light.
const MACROS: MacroConfig[] = [
  {
    key: "protein",
    labelKey: "macro.protein",
    color: "var(--macro-protein)",
    Icon: Beef,
    testId: "macro-bar-protein",
  },
  {
    key: "carbs",
    labelKey: "macro.carbs",
    color: "var(--macro-carbs)",
    Icon: Wheat,
    testId: "macro-bar-carbs",
  },
  {
    key: "fat",
    labelKey: "macro.fat",
    color: "var(--macro-fat)",
    Icon: Droplet,
    testId: "macro-bar-fat",
  },
];

function MacroCard({
  label,
  consumedG,
  targetG,
  color,
  Icon,
  view,
  testId,
}: {
  label: string;
  consumedG: number;
  targetG: number;
  color: string;
  Icon: MacroConfig["Icon"];
  view: RingView;
  testId: string;
}) {
  // The big number follows the toggle: what's LEFT (target - consumed, never
  // negative) in "remaining" view, what's been eaten in "consumed" view.
  const shown =
    view === "remaining"
      ? Math.max(0, targetG - consumedG)
      : Math.max(0, consumedG);
  const safeTarget = targetG > 0 ? targetG : 1;
  // The ring, though, always fills with what's been CONSUMED (Cal-AI style):
  // empty on a fresh day, filling as you eat. Caps at 100% so an over-target
  // macro never overflows its track; the number still shows the real value.
  const percent = Math.min(100, Math.max(0, (consumedG / safeTarget) * 100));
  const dashOffset = 100 - percent;

  return (
    <div
      data-testid={testId}
      className="fm-lift flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-card px-3 py-4"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-xl font-extrabold leading-none tabular-nums text-foreground">
          <AnimatedNumber value={shown} animateKey={view} />g
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>

      {/* The macro ring: a neutral track, a coloured fill, the icon in the
          centre. */}
      <div className="relative mx-auto mt-0.5 size-16">
        <svg viewBox="0 0 100 100" className="block size-full" aria-hidden="true">
          <circle
            cx={50}
            cy={50}
            r={44}
            fill="none"
            strokeWidth={7}
            style={{
              stroke: "color-mix(in oklab, var(--foreground) 10%, transparent)",
            }}
          />
          <circle
            data-testid={`${testId}-fill`}
            cx={50}
            cy={50}
            r={44}
            fill="none"
            strokeWidth={7}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 50 50)"
            style={{ stroke: color, transition: "stroke-dashoffset 0.5s cubic-bezier(0.2,0,0,1)" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <Icon className="size-6" strokeWidth={2} aria-hidden={true} style={{ color }} />
        </div>
      </div>

      {/* Real value / target for screen readers + tests, without crowding the
          card face (the big number already shows the selected grams). */}
      <span
        data-testid={`${testId}-values`}
        className="sr-only"
      >
        {shown} / {Math.round(targetG)} g
      </span>
    </div>
  );
}

export function MacroBars({
  consumed,
  target,
  view = "consumed",
}: {
  consumed: { protein: number; carbs: number; fat: number };
  target: { proteinG: number; carbsG: number; fatG: number };
  view?: RingView;
}) {
  const { t } = useT();
  const consumedByKey = consumed;
  const targetByKey = {
    protein: target.proteinG,
    carbs: target.carbsG,
    fat: target.fatG,
  };

  return (
    <div data-testid="home-macro-bars" className="flex items-stretch gap-2.5">
      {MACROS.map(({ key, labelKey, color, Icon, testId }) => (
        <MacroCard
          key={key}
          label={t(labelKey)}
          consumedG={consumedByKey[key]}
          targetG={targetByKey[key]}
          color={color}
          Icon={Icon}
          view={view}
          testId={testId}
        />
      ))}
    </div>
  );
}
