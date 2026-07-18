import { suggestedDayStructure } from "@/lib/budget/rules";

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
  const structure = suggestedDayStructure(dailyKcal);

  const parts: { label: string; kcal: number; testId: string }[] = [
    { label: "Doručak", kcal: structure.breakfastKcal, testId: "guidance-breakfast" },
    { label: "Ručak", kcal: structure.lunchKcal, testId: "guidance-lunch" },
    { label: "Užina", kcal: structure.snackKcal, testId: "guidance-snack" },
    { label: "Večera", kcal: structure.dinnerKcal, testId: "guidance-dinner" },
  ];

  return (
    <section
      data-testid="day-structure-guidance"
      aria-label="Predlog rasporeda obroka -- nije obavezujuće"
      className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-4"
    >
      <p className="text-sm font-medium text-foreground">
        Predlog rasporeda obroka
      </p>
      <p className="text-xs text-muted-foreground">
        Ovo je samo orijentacija, ne obaveza -- rasporedi kalorije kako tebi
        odgovara.
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
