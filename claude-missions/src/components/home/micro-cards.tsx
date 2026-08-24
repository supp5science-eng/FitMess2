"use client";

import { Beef, Candy, Soup, Wheat } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import type { TFunction } from "@/lib/i18n/translate";
import {
  computeMicroCardState,
  formatMicroAmount,
  MICRO_KEYS,
  type MicroCardState,
  type MicroKey,
  type MicroTargets,
  type MicroTotals,
} from "@/lib/nutrition/micro";
import { cn } from "@/lib/utils";

// The four micronutrient cards on the home tab's SECOND page (2026-07-25), the
// one the user reaches by swiping right off the calorie ring: fiber, total
// sugar, sodium and saturated fat, each as "koliko je još ostalo danas".
//
// Presentational only -- every number comes from `src/lib/nutrition/micro.ts`
// (`computeMicroCardState`), nothing is computed here, same "money-math rule"
// the ring and macro bars follow.
//
// Two honesty rules are visible in the markup:
//   * A nutrient no logged entry describes shows "—", never "0 g" (see
//     `0017_micronutrients.sql` -- unknown is not zero).
//   * When only PART of the day's kcal has known values, a single quiet line
//     under the grid says so, instead of presenting a partial sum as complete.
//
// Fiber is a GOAL (reaching it is good, passing it is fine); the other three are
// LIMITS. Past a limit the card stays calm -- a soft warning tint and a "više
// nego..." line, never red-alarm shaming, matching the never-red posture the
// overshoot copy on the ring established.

/** Per-nutrient colour + icon, off the `--mark-*` tokens so the four tiles
 * stay distinct from each other AND from the other home tiles (steps plum,
 * water steel) without any of them leaving the plate's palette. */
const MICRO_STYLE: Record<
  MicroKey,
  { icon: React.ReactNode; text: string; chip: string; track: string; from: string; to: string }
> = {
  fiber: {
    icon: <Wheat className="size-4" aria-hidden="true" />,
    text: "text-mark-fiber",
    chip: "bg-mark-fiber/15",
    track: "text-mark-fiber/15",
    from: "#4fa87d",
    to: "#2c7a58",
  },
  sugar: {
    icon: <Candy className="size-4" aria-hidden="true" />,
    text: "text-mark-sugar",
    chip: "bg-mark-sugar/15",
    track: "text-mark-sugar/15",
    from: "#c95f96",
    to: "#a83a72",
  },
  sodium: {
    icon: <Soup className="size-4" aria-hidden="true" />,
    text: "text-mark-sodium",
    chip: "bg-mark-sodium/15",
    track: "text-mark-sodium/15",
    from: "#4e97b8",
    to: "#2c6e8f",
  },
  satFat: {
    icon: <Beef className="size-4" aria-hidden="true" />,
    text: "text-mark-satfat",
    chip: "bg-mark-satfat/15",
    track: "text-mark-satfat/15",
    from: "#c99a3c",
    to: "#9a7112",
  },
};

/**
 * A nutrient's fill, as a slim bar (2026-07-25).
 *
 * Was a 56px progress ring per card, which is what made this page read as the
 * heaviest of the three: four rings meant four 142px cards for four small
 * numbers. A bar carries the same "how far along am I" in 6px of height, so the
 * card can be a third shorter without dropping anything the user reads. The
 * rings stay where they earn their size -- the calorie gauge and the
 * Koraci/Voda cards.
 */
function MicroBar({
  fraction,
  colorKey,
}: {
  fraction: number;
  colorKey: MicroKey;
}) {
  const style = MICRO_STYLE[colorKey];
  const clamped = Math.max(0, Math.min(1, fraction));

  return (
    <span
      className={cn("block h-1.5 w-full overflow-hidden rounded-full", style.chip)}
      aria-hidden="true"
    >
      <span
        data-testid={`micro-bar-${colorKey}`}
        className="block h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${clamped * 100}%`,
          backgroundImage: `linear-gradient(90deg, ${style.from}, ${style.to})`,
        }}
      />
    </span>
  );
}

/**
 * The headline number: what's LEFT of the goal/limit. Once past it we show how
 * far over instead of a stuck "0", the same way the ring shows a negative
 * remaining -- honest, and it's the number that would make someone act.
 */
function headlineFor(
  card: MicroCardState,
  t: TFunction
): { value: string; sub: string } {
  const { unit, kind } = card.spec;
  // The nutrient's NAME now sits in the card's own header row, so this line
  // only has to say what the number means -- which is what let the card lose a
  // wrapped second line ("Zasićene masti · nema podataka" used to run onto two
  // rows and stretch the whole grid row with it).
  if (!card.hasData) {
    return { value: "—", sub: t("home.micro.noData") };
  }
  if (card.isOver) {
    const over = formatMicroAmount(Math.abs(card.remaining), unit);
    return {
      value: over,
      sub:
        kind === "goal"
          ? t("home.micro.aboveGoal")
          : t("home.micro.overLimit"),
    };
  }
  return {
    value: formatMicroAmount(card.remaining, unit),
    sub: t("home.micro.remaining"),
  };
}

function MicroCard({ card, t }: { card: MicroCardState; t: TFunction }) {
  const style = MICRO_STYLE[card.key];
  const { value, sub } = headlineFor(card, t);
  // A passed LIMIT gets a soft warning tint; a passed GOAL (fiber) is a win and
  // gets the plain card.
  const warn = card.isOver && card.spec.kind === "limit";

  return (
    <div
      data-testid={`micro-card-${card.key}`}
      data-over={card.isOver ? "true" : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border bg-card px-3 py-2.5",
        warn ? "border-amber-500/35" : "border-border"
      )}
    >
      {/* Header: the nutrient's badge + name, on one line. */}
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full",
            style.chip,
            style.text
          )}
        >
          {style.icon}
        </span>
        <span className="truncate text-xs font-semibold text-foreground">
          {t(card.spec.labelKey as MessageKey)}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-1.5">
        <span
          data-testid={`micro-value-${card.key}`}
          className="text-xl font-bold leading-none tabular-nums tracking-tight text-foreground"
        >
          {value}
        </span>
        <span className="shrink-0 text-[0.65rem] font-medium text-muted-foreground">
          {sub}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <MicroBar
          fraction={card.hasData ? card.fillFraction : 0}
          colorKey={card.key}
        />
        <span className="text-[0.65rem] tabular-nums text-muted-foreground">
          {card.hasData
            ? `${Math.round(card.consumed)} / ${card.target}`
            : t("home.micro.goal", { target: card.target })}
        </span>
      </div>
    </div>
  );
}

/**
 * The 2x2 grid of micronutrient cards plus, when relevant, one line admitting
 * how much of the day it actually knows about.
 */
export function MicroCards({
  micros,
  targets,
}: {
  micros: MicroTotals;
  targets: MicroTargets;
}) {
  const { t } = useT();
  const cards = MICRO_KEYS.map((key) =>
    computeMicroCardState(key, micros.totals[key], targets[key])
  );

  // Only worth saying once there IS a day to be partial about.
  const partial = micros.totalKcal > 0 && micros.coverage < 0.999;
  const coveragePercent = Math.round(micros.coverage * 100);

  return (
    <div data-testid="micro-cards" className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        {cards.map((card) => (
          <MicroCard key={card.key} card={card} t={t} />
        ))}
      </div>
      {partial ? (
        <p
          data-testid="micro-coverage-note"
          className="px-1 text-[0.7rem] leading-snug text-muted-foreground"
        >
          {coveragePercent > 0
            ? t("home.micro.coveragePartial", { percent: coveragePercent })
            : t("home.micro.coverageNone")}
        </p>
      ) : null}
    </div>
  );
}
