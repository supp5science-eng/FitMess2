import { suggestedDayStructure } from "@/lib/budget/rules";
import { useT } from "@/components/i18n/locale-provider";

/**
 * F017: optional, non-binding day-structure guidance shown on
 * `/profil/pravila` -- a suggested breakfast/lunch/snack/dinner kcal split
 * derived from the user's current daily budget (F014's `dailyKcal`).
 *
 * Deliberately read-only and visually distinct from the (editable, binding)
 * rules list above it: no toggle, no edit control, and the heading/body copy
 * explicitly says this is a suggestion, never an obligation, per the
 * clarified spec's "Optionally show suggested day-structure guidance ...
 * keep it clearly optional, never obligation."
 */
export function DayStructureGuidance({ dailyKcal }: { dailyKcal: number }) {
  const { t } = useT();
  const structure = suggestedDayStructure(dailyKcal);

  const parts: { label: string; kcal: number; testId: string }[] = [
    { label: t("app.day.breakfast"), kcal: structure.breakfastKcal, testId: "guidance-breakfast" },
    { label: t("app.day.lunch"), kcal: structure.lunchKcal, testId: "guidance-lunch" },
    { label: t("app.day.snack"), kcal: structure.snackKcal, testId: "guidance-snack" },
    { label: t("app.day.dinner"), kcal: structure.dinnerKcal, testId: "guidance-dinner" },
  ];

  return (
    <section
      data-testid="day-structure-guidance"
      aria-label={t("app.day.aria")}
      className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-4"
    >
      <p className="text-sm font-medium text-foreground">
        {t("app.day.heading")}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("app.day.body")}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {parts.map((part) => (
          <div
            key={part.label}
            data-testid={part.testId}
            className="flex flex-col items-center rounded-lg bg-background px-1 py-2"
          >
            <span className="text-sm font-semibold text-foreground">
              {part.kcal}
            </span>
            <span className="text-[0.65rem] text-muted-foreground">
              {part.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
