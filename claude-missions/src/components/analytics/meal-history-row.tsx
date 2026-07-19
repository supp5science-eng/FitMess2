import { foodEmoji } from "@/lib/food/emoji";
import type { MealLogItem } from "@/lib/log/group";

// A single past-meal row for the "Svi obroci" list on `/analitika`. No photo
// (logged meals rarely have one) -- a food-type emoji stands in. Shows the
// portion in grams plus the per-meal macros (P / UH / M) the app already
// stores denormalized on every log row, with kcal as the headline number.

function round(n: number): number {
  return Math.round(n);
}

export function MealHistoryRow({ log }: { log: MealLogItem }) {
  return (
    <li
      data-testid={`meal-history-row-${log.id}`}
      className="flex items-center gap-3 py-3"
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xl"
      >
        {foodEmoji(log.name)}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium text-foreground">
          {log.name}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{round(log.grams)} g</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">P {round(log.protein)}</span>
          <span className="tabular-nums">UH {round(log.carbs)}</span>
          <span className="tabular-nums">M {round(log.fat)}</span>
        </span>
      </div>

      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {round(log.kcal)}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          kcal
        </span>
      </span>
    </li>
  );
}
