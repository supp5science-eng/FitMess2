// F027 / AS-048: three macro bars (Proteini / UH / Masti) -- consumed vs.
// target grams for each, below the ring. Pure, presentational; the numbers
// come in as props (`src/lib/home/totals.ts` computes the consumed side,
// the newest `targets` row -- newest `effective_from` wins -- provides the
// target side).
//
// The fill bar is capped visually at 100% (a macro can be over its target
// without the bar overflowing its own track) but the numeric label always
// shows the real consumed value, never clamped -- same "the number is real,
// never hidden" posture as the ring's overshoot state (AS-050). Single
// green accent throughout; no second color for "over."

function MacroBar({
  label,
  consumedG,
  targetG,
  testId,
}: {
  label: string;
  consumedG: number;
  targetG: number;
  testId: string;
}) {
  const safeTarget = targetG > 0 ? targetG : 1;
  const percent = Math.min(100, Math.max(0, (consumedG / safeTarget) * 100));

  return (
    <div data-testid={testId} className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span
          data-testid={`${testId}-values`}
          className="text-muted-foreground tabular-nums"
        >
          {Math.round(consumedG)} / {Math.round(targetG)} g
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          data-testid={`${testId}-fill`}
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function MacroBars({
  consumed,
  target,
}: {
  consumed: { protein: number; carbs: number; fat: number };
  target: { proteinG: number; carbsG: number; fatG: number };
}) {
  return (
    <div data-testid="home-macro-bars" className="flex flex-col gap-4">
      <MacroBar
        label="Proteini"
        consumedG={consumed.protein}
        targetG={target.proteinG}
        testId="macro-bar-protein"
      />
      <MacroBar
        label="UH"
        consumedG={consumed.carbs}
        targetG={target.carbsG}
        testId="macro-bar-carbs"
      />
      <MacroBar
        label="Masti"
        consumedG={consumed.fat}
        targetG={target.fatG}
        testId="macro-bar-fat"
      />
    </div>
  );
}
