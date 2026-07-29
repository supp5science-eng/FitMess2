import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/locale-provider";
import type { Food } from "@/lib/types/db";

/**
 * F024 / AS-039, AS-040: a single food row shown in the `/dodaj/pretraga`
 * search results and "Nedavno korišćeno" quick-add list -- name/brand + a
 * small macro preview (kcal/100g), plus (AS-039) a "neprovereno" badge for
 * any `foods.verified === false` row (verified foods show no badge at all).
 *
 * F025: the whole row is now a `next/link` to `/dodaj/porcija/[foodId]`
 * (the portion picker, AS-041/AS-042) -- tapping a result opens the
 * grams/common-unit picker and actually creates a log row there. The outer
 * `<li>` (and every existing `data-testid`) is unchanged so F024's own
 * search/recents tests keep passing unmodified; only the inner content is
 * now wrapped in a real, keyboard-reachable `<a>` instead of being inert.
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
  const { t } = useT();
  const kcal = Math.round(food.kcal_100g);

  return (
    <li data-testid={`food-item-${food.id}`}>
      <Link
        href={`/dodaj/porcija/${food.id}`}
        data-testid={`food-link-${food.id}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              data-testid={`food-name-${food.id}`}
              className="truncate text-sm font-medium text-foreground"
            >
              {food.name_sr}
            </span>
            {food.is_default ? (
              <Badge
                variant="outline"
                data-testid={`food-badge-default-${food.id}`}
                className="border-primary/40 bg-primary/10 text-primary"
              >
                {t("food.badgeDefault")}
              </Badge>
            ) : null}
            {!food.verified ? (
              <Badge
                variant="outline"
                data-testid={`food-badge-neprovereno-${food.id}`}
                className="border-amber-300 bg-amber-50 text-amber-700"
              >
                {t("food.badgeUnverified")}
              </Badge>
            ) : null}
            {isRecent ? (
              <Badge
                variant="secondary"
                data-testid={`food-badge-recent-${food.id}`}
              >
                {t("food.badgeRecent")}
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
      </Link>
    </li>
  );
}
