import { LogAddMoreSheet } from "@/components/food/log-add-more-sheet";
import { LogDeleteConfirm } from "@/components/food/log-delete-confirm";
import { LogEditSheet } from "@/components/food/log-edit-sheet";
import { useT } from "@/components/i18n/locale-provider";
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
  hasPhoto = false,
  onSaved,
  onDeleted,
}: {
  log: Log;
  food: Food | null;
  // True for a "Slikaj obrok" log that has a stored photo (served from
  // `/api/obrok-slika/[logId]`, pruned after ~1 day). When set, the card leads
  // with the photo and shows the macro breakdown under the name.
  hasPhoto?: boolean;
  onSaved: (updatedLog: Log) => void;
  onDeleted: (logId: string) => void;
}) {
  const { t } = useT();
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
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/obrok-slika/${log.id}`}
          alt={log.name}
          data-testid={`meal-card-photo-${log.id}`}
          loading="lazy"
          className="h-44 w-full rounded-xl object-cover"
        />
      ) : null}
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
      {hasPhoto ? (
        <div
          data-testid={`meal-card-macros-${log.id}`}
          className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
        >
          <MacroStat label={t("macro.protein")} grams={log.protein} tone="text-macro-protein" />
          <MacroStat label={t("macro.carbs")} grams={log.carbs} tone="text-macro-carbs" />
          <MacroStat label={t("macro.fat")} grams={log.fat} tone="text-macro-fat" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {/* "Dodaj još" leads: seconds are the common follow-up action on an
            entry, while editing/deleting are corrections. Unlike "Izmeni" it
            needs no `food` row -- it grows the entry from its own snapshot, so
            it is available on AI meal entries too (which is the point). */}
        <LogAddMoreSheet log={log} onSaved={onSaved} />
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

/** One macro figure (grams + label) in the photo-meal card's breakdown row. */
function MacroStat({
  label,
  grams,
  tone,
}: {
  label: string;
  grams: number;
  tone: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={`font-semibold tabular-nums ${tone}`}>
        {Math.round(grams)} g
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
