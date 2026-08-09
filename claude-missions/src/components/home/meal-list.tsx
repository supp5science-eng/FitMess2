import { openAddSheet } from "@/components/home/add-sheet-open";
import { MealCard } from "@/components/home/meal-card";
import { useT } from "@/components/i18n/locale-provider";
import type { LogWithFood } from "@/lib/home/attach-food";
import type { Log } from "@/lib/types/db";

// F027 / AS-049: today's logged-meals list, or (clarified empty-state
// answer) a friendly Serbian empty state with a clear next action when
// nothing has been logged yet today.

export function MealList({
  logs,
  onSaved,
  onDeleted,
}: {
  logs: LogWithFood[];
  onSaved: (updatedLog: Log) => void;
  onDeleted: (logId: string) => void;
}) {
  const { t } = useT();

  if (logs.length === 0) {
    return (
      <div
        data-testid="home-meals-empty"
        className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-background px-6 py-10 text-center"
      >
        <p className="text-sm text-muted-foreground">{t("home.meals.empty")}</p>
        {/* Opens the "+" menu rather than jumping straight into the meal-photo
            flow. It used to be a link to `/dodaj/obrok`, which quietly made one
            method the default for anyone who had logged nothing yet -- so the
            person most in need of the choice (Prizma when it matters, Gric for
            a snack, a label, a workout) was the one who never saw it. The
            label says "Dodaj unos" for the same reason: a button that opens a
            menu must not name one of the things inside it. */}
        <button
          type="button"
          onClick={openAddSheet}
          data-testid="home-meals-empty-cta"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          {t("home.meals.empty.cta")}
        </button>
      </div>
    );
  }

  return (
    <ul data-testid="home-meals-list" className="flex flex-col gap-3">
      {logs.map((log) => (
        <MealCard
          key={log.id}
          log={log}
          food={log.food}
          hasPhoto={log.hasPhoto}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      ))}
    </ul>
  );
}
