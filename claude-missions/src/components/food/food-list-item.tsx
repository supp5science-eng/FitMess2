import { Badge } from "@/components/ui/badge";
import type { Food } from "@/lib/types/db";

/**
 * F024 / AS-039, AS-040: a single food row shown in the `/dodaj/pretraga`
 * search results and "Nedavno korišćeno" quick-add list -- name/brand + a
 * small macro preview (kcal/100g), plus (AS-039) a "neprovereno" badge for
 * any `foods.verified === false` row (verified foods show no badge at all).
 *
 * Deliberately a plain `<li>`, not a `<button>`: tapping a result to open
 * the grams/portion picker and actually create a log row is F025's job (see
 * that feature's spec -- "for F024 you may seed logs directly to test
 * recents; do not build the portion picker here"). Rendering these as inert
 * buttons here would be a worse affordance than a clearly informational row
 * (no "does this actually do anything?" ambiguity) until F025 wires real
 * tap-to-add behaviour on top of this same component.
 */
export function FoodListItem({
  food,
  isRecent = false,
}: {
  food: Food;
  /** True when this food also appears in the user's recent-foods list
   * (AS-040) -- shown as a small "nedavno" tag alongside the name. */
  isRecent?: boolean;
}) {
  const kcal = Math.round(food.kcal_100g);

  return (
    <li
      data-testid={`food-item-${food.id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            data-testid={`food-name-${food.id}`}
            className="truncate text-sm font-medium text-foreground"
          >
            {food.name_sr}
          </span>
          {!food.verified ? (
            <Badge
              variant="outline"
              data-testid={`food-badge-neprovereno-${food.id}`}
              className="border-amber-300 bg-amber-50 text-amber-700"
            >
              neprovereno
            </Badge>
          ) : null}
          {isRecent ? (
            <Badge
              variant="secondary"
              data-testid={`food-badge-recent-${food.id}`}
            >
              nedavno
            </Badge>
          ) : null}
        </div>
        {food.brand ? (
          <span className="truncate text-xs text-muted-foreground">
            {food.brand}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span
          data-testid={`food-kcal-${food.id}`}
          className="text-lg font-semibold text-foreground"
        >
          {kcal}
        </span>
        <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">
          kcal/100g
        </span>
      </div>
    </li>
  );
}
