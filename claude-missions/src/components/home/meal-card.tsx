import { LogDeleteConfirm } from "@/components/food/log-delete-confirm";
import { LogEditSheet } from "@/components/food/log-edit-sheet";
import { findMatchingCommonUnit } from "@/lib/food/portions";
import type { Food, Log } from "@/lib/types/db";

// F027 / AS-049: a single today's-meal card -- name + portion + kcal, wired
// to F026's reusable edit/delete components exactly as that feature's
// handoff instructed ("F027 should wire `<LogEditSheet log={...}
// food={...} onSaved={...} />` ... `<LogDeleteConfirm logId={...}
// logName={...} onDeleted={...} />` onto each meal card").
//
// The edit control only renders when `food` is non-null -- `LogEditSheet`
// requires a full `Food` row (per-100g values + common_units) to recompute
// a live preview; a log whose referenced food was since deleted
// (`food_id` -> null, see `src/lib/home/attach-food.ts`) can still be
// deleted (delete never needs the food), just not portion-edited.

export function MealCard({
  log,
  food,
  onSaved,
  onDeleted,
}: {
  log: Log;
  food: Food | null;
  onSaved: (updatedLog: Log) => void;
  onDeleted: (logId: string) => void;
}) {
  const unitMatch = food
    ? findMatchingCommonUnit(food.common_units, log.grams)
    : null;
  const matchedUnit =
    unitMatch && food ? food.common_units[unitMatch.unitIndex] : undefined;

  const portionLabel =
    unitMatch && matchedUnit
      ? `${unitMatch.quantity} × ${matchedUnit.label} (${log.grams} g)`
      : `${log.grams} g`;

  return (
    <li
      data-testid={`meal-card-${log.id}`}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            data-testid={`meal-card-name-${log.id}`}
            className="truncate font-semibold text-foreground"
          >
            {log.name}
          </span>
          <span
            data-testid={`meal-card-portion-${log.id}`}
            className="text-sm text-muted-foreground"
          >
            {portionLabel}
          </span>
        </div>
        <span
          data-testid={`meal-card-kcal-${log.id}`}
          className="shrink-0 text-lg font-bold tabular-nums text-foreground"
        >
          {Math.round(log.kcal)} kcal
        </span>
      </div>
      <div className="flex items-center gap-2">
        {food ? (
          <LogEditSheet log={log} food={food} onSaved={onSaved} />
        ) : null}
        <LogDeleteConfirm
          logId={log.id}
          logName={log.name}
          onDeleted={onDeleted}
        />
      </div>
    </li>
  );
}
