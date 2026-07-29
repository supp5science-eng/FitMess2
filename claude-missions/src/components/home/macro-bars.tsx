import { AnimatedNumber } from "@/components/home/animated-number";
import { useT } from "@/components/i18n/locale-provider";
import type { RingView } from "@/components/home/ring";

// F027 / AS-048: the three macros (Proteini / Masti / UH) shown below the
// gauge. Pure, presentational; the numbers come in as props
// (`src/lib/home/totals.ts` computes the consumed side, the newest `targets`
// row provides the target side).
//
// Redesign (2026-07-19): three side-by-side columns, each a label above a
// slim colour-coded bar above its "value / target g" -- protein coral, fat
// amber, carbs green. The `view` toggle (shared with the gauge) switches the
// shown value between consumed and remaining; the bar fill and the number
// follow it. The bar caps visually at 100% (a macro can exceed its target
// without overflowing its track) but the number always shows the real value.
//
// Redesign (2026-07-29): each column now floats on its OWN raised card
// (`bg-card` + `.fm-lift`), so the three macros read as three separate tiles
// hovering over the aurora ground -- the Cal-AI "sve lebdi" direction. Only
// the surface changed; the bar/number logic (and every test id) is untouched.

/** Per-macro accent colours (distinct from the teal calorie gauge). Driven by
 * the themed `--macro-*` tokens in `globals.css`, so each is right for dark
 * AND light (the `color-mix` track below works with `var()` values too). */
const MACRO_COLORS = {
  protein: "var(--macro-protein)",
  fat: "var(--macro-fat)",
  carbs: "var(--macro-carbs)",
} as const;

function MacroBar({
  label,
  consumedG,
  targetG,
  color,
  view,
  testId,
}: {
  label: string;
  consumedG: number;
  targetG: number;
  color: string;
  view: RingView;
  testId: string;
}) {
  // In "remaining" view the shown value is what's LEFT (target - consumed,
  // never negative); in "consumed" view it's what's been eaten.
  const shown =
    view === "remaining"
      ? Math.max(0, targetG - consumedG)
      : Math.max(0, consumedG);
  const safeTarget = targetG > 0 ? targetG : 1;
  const percent = Math.min(100, Math.max(0, (shown / safeTarget) * 100));

  return (
    <div
      data-testid={testId}
      className="fm-lift flex flex-1 flex-col items-center gap-2 rounded-2xl border border-border bg-card px-2 py-3.5 text-center"
    >
      {/* text-xs, matching the stat row above (2026-07-29): these tiles and the
          Cilj/Potrošeno/Preostalo row sit on the same three-column grid, so
          they have to share a type scale or the two blocks read as two
          unrelated widgets stacked by accident. */}
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: `color-mix(in oklab, ${color} 22%, transparent)` }}
      >
        <div
          data-testid={`${testId}-fill`}
          className="h-full rounded-full"
          style={{
            width: `${percent}%`,
            backgroundColor: color,
            transition: "width 0.5s cubic-bezier(0.2,0,0,1)",
          }}
        />
      </div>
      <span
        data-testid={`${testId}-values`}
        className="text-xs font-medium tabular-nums text-foreground"
      >
        <AnimatedNumber value={shown} animateKey={view} /> / {Math.round(targetG)} g
      </span>
    </div>
  );
}

export function MacroBars({
  consumed,
  target,
  view = "consumed",
}: {
  consumed: { protein: number; carbs: number; fat: number };
  target: { proteinG: number; carbsG: number; fatG: number };
  view?: RingView;
}) {
  const { t } = useT();
  return (
    <div data-testid="home-macro-bars" className="flex items-stretch gap-2.5">
      <MacroBar
        label={t("macro.protein")}
        consumedG={consumed.protein}
        targetG={target.proteinG}
        color={MACRO_COLORS.protein}
        view={view}
        testId="macro-bar-protein"
      />
      <MacroBar
        label={t("macro.fat")}
        consumedG={consumed.fat}
        targetG={target.fatG}
        color={MACRO_COLORS.fat}
        view={view}
        testId="macro-bar-fat"
      />
      <MacroBar
        label={t("macro.carbs")}
        consumedG={consumed.carbs}
        targetG={target.carbsG}
        color={MACRO_COLORS.carbs}
        view={view}
        testId="macro-bar-carbs"
      />
    </div>
  );
}
