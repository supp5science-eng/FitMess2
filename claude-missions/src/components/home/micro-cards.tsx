import { Beef, Candy, Soup, Wheat } from "lucide-react";
import { useId } from "react";

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

/** Per-nutrient colour + icon. Chosen to stay distinct from the other home
 * tiles (kcal amber, steps violet, water sky) so nothing reads as a duplicate. */
const MICRO_STYLE: Record<
  MicroKey,
  { icon: React.ReactNode; text: string; chip: string; track: string; from: string; to: string }
> = {
  fiber: {
    icon: <Wheat className="size-4" aria-hidden="true" />,
    text: "text-emerald-500",
    chip: "bg-emerald-500/15",
    track: "text-emerald-500/15",
    from: "#6ee7b7",
    to: "#10b981",
  },
  sugar: {
    icon: <Candy className="size-4" aria-hidden="true" />,
    text: "text-pink-500",
    chip: "bg-pink-500/15",
    track: "text-pink-500/15",
    from: "#f9a8d4",
    to: "#ec4899",
  },
  sodium: {
    icon: <Soup className="size-4" aria-hidden="true" />,
    text: "text-sky-500",
    chip: "bg-sky-500/15",
    track: "text-sky-500/15",
    from: "#7dd3fc",
    to: "#0ea5e9",
  },
  satFat: {
    icon: <Beef className="size-4" aria-hidden="true" />,
    text: "text-amber-500",
    chip: "bg-amber-500/15",
    track: "text-amber-500/15",
    from: "#fcd34d",
    to: "#f59e0b",
  },
};

/** A nutrient's little progress ring (same construction as the steps card's). */
function MicroRing({
  fraction,
  colorKey,
  children,
}: {
  fraction: number;
  colorKey: MicroKey;
  children: React.ReactNode;
}) {
  const gradientId = useId();
  const style = MICRO_STYLE[colorKey];
  const size = 56;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fraction));
  const offset = c * (1 - clamped);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={style.from} />
            <stop offset="100%" stopColor={style.to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          className={style.track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.45s cubic-bezier(0.2,0,0,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/**
 * The headline number: what's LEFT of the goal/limit. Once past it we show how
 * far over instead of a stuck "0", the same way the ring shows a negative
 * remaining -- honest, and it's the number that would make someone act.
 */
function headlineFor(card: MicroCardState): { value: string; sub: string } {
  const { unit, kind, labelSr } = card.spec;
  if (!card.hasData) {
    return { value: "—", sub: `${labelSr} · nema podataka` };
  }
  if (card.isOver) {
    const over = formatMicroAmount(Math.abs(card.remaining), unit);
    return {
      value: over,
      sub: kind === "goal" ? `${labelSr} iznad cilja` : `${labelSr} preko granice`,
    };
  }
  return {
    value: formatMicroAmount(card.remaining, unit),
    sub: `${labelSr} — preostalo`,
  };
}

function MicroCard({ card }: { card: MicroCardState }) {
  const style = MICRO_STYLE[card.key];
  const { value, sub } = headlineFor(card);
  // A passed LIMIT gets a soft warning tint; a passed GOAL (fiber) is a win and
  // gets the plain card.
  const warn = card.isOver && card.spec.kind === "limit";

  return (
    <div
      data-testid={`micro-card-${card.key}`}
      data-over={card.isOver ? "true" : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border bg-card px-3.5 py-3.5",
        warn ? "border-amber-500/35" : "border-border"
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span
          data-testid={`micro-value-${card.key}`}
          className="text-2xl font-bold tabular-nums tracking-tight text-foreground"
        >
          {value}
        </span>
        <span className="text-[0.7rem] font-medium leading-tight text-muted-foreground">
          {sub}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <MicroRing fraction={card.hasData ? card.fillFraction : 0} colorKey={card.key}>
          <span className={style.text}>{style.icon}</span>
        </MicroRing>
        <span className="pb-1 text-[0.7rem] tabular-nums text-muted-foreground">
          {card.hasData
            ? `${Math.round(card.consumed)} / ${card.target}`
            : `cilj ${card.target}`}
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
          <MicroCard key={card.key} card={card} />
        ))}
      </div>
      {partial ? (
        <p
          data-testid="micro-coverage-note"
          className="px-1 text-[0.7rem] leading-snug text-muted-foreground"
        >
          {coveragePercent > 0
            ? `Podaci pokrivaju ~${coveragePercent}% današnjih kalorija — za ostatak još nemamo vlakna, šećer i so.`
            : "Za današnje unose još nemamo podatke o vlaknima, šećeru i soli."}
        </p>
      ) : null}
    </div>
  );
}
