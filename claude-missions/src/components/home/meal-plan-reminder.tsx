import { ChevronRight } from "lucide-react";
import Link from "next/link";

import "./meal-plan-reminder.css";

// "Šta da jedeš danas" (2026-07-28): the compact advice card on /danas. It sits
// right under the header (a touch bigger than the streak pill, still one row),
// and tapping it opens the full plan at /predlog -- the same "compact entry on
// /danas -> detail screen" pattern the streak pill (-> /dostignuca) established.
//
// Presentational: the page derives `suggestedCount`/`mealsDone` with pure
// `planProgress` and hands them down; this component only renders and links.
// The teal badge's entrance animation lives in meal-plan-reminder.css.

export function MealPlanReminder({
  suggestedCount,
  mealsDone,
  href = "/predlog",
}: {
  /** How many meals the plan suggests today (1 or 2). */
  suggestedCount: number;
  /** How many of them are already covered by today's logging (0..suggestedCount). */
  mealsDone: number;
  href?: string;
}) {
  const sub =
    suggestedCount === 1
      ? "1 obrok predlažemo — ostalo biraš sam"
      : `${suggestedCount} obroka predlažemo — treći biraš sam`;

  return (
    <Link
      href={href}
      className="mpr"
      data-testid="meal-plan-reminder"
      aria-label={`Savet: šta da jedeš danas. ${mealsDone} od ${suggestedCount} obroka pokriveno. Otvori predlog.`}
    >
      <span className="mpr-badge-wrap" aria-hidden="true">
        <span className="mpr-ripple" />
        <span className="mpr-badge">
          <svg className="mpr-spark" viewBox="0 0 24 24" fill="none">
            <path
              className="mpr-p1"
              d="M12 2.6 C12.7 8, 16 11.3, 21.4 12 C16 12.7, 12.7 16, 12 21.4 C11.3 16, 8 12.7, 2.6 12 C8 11.3, 11.3 8, 12 2.6 Z"
            />
            <path
              className="mpr-p2"
              d="M18.6 3.4 C18.8 5, 19 5.2, 20.6 5.4 C19 5.6, 18.8 5.8, 18.6 7.4 C18.4 5.8, 18.2 5.6, 16.6 5.4 C18.2 5.2, 18.4 5, 18.6 3.4 Z"
            />
          </svg>
        </span>
      </span>

      <span>
        <span className="mpr-eyebrow">Savet</span>
        <span className="mpr-title block">Šta da jedeš danas</span>
        <span className="mpr-sub block">{sub}</span>
      </span>

      <span className="mpr-meta">
        <span className="mpr-count">
          {mealsDone}/{suggestedCount}
        </span>
        <ChevronRight className="mpr-chev size-5" aria-hidden="true" />
      </span>
    </Link>
  );
}
