import { formatWaterSr, type WaterWeek } from "@/lib/water/water-week";

// Analitika "Voda" card: today's hydration vs a bodyweight-based goal (a sky
// progress ring) plus a 7-day mini bar chart with a dashed goal line.
// Presentational + server-renderable (no client JS); every number arrives
// pre-computed from `computeWaterWeek`. Water is logged on `/danas`; this card
// is the read-only overview. `null` => a calm "dopuni profil" state.

const SKY = "#38BDF8"; // sky-400, matching the /danas water button accent

// Ring geometry.
const RING = 108;
const R = 46;
const STROKE = 9;
const CIRC = 2 * Math.PI * R;

// Bar chart geometry.
const CHART_H = 88;

export function WaterCard({ week }: { week: WaterWeek | null }) {
  if (!week) {
    return (
      <section className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-6">
        <Header />
        <p className="text-sm text-muted-foreground">
          Dodaj težinu u upitniku pa ćemo ti postaviti dnevni cilj za vodu.
        </p>
      </section>
    );
  }

  const dashOffset = CIRC * (1 - week.pct);
  const hint = week.reachedToday
    ? "Cilj ispunjen 🎉"
    : `Još ${formatWaterSr(week.remainingMl)} do cilja`;

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6">
      <Header />

      {/* Hero: progress ring + today's total */}
      <div className="flex items-center gap-5">
        <div
          className="relative shrink-0"
          style={{ width: RING, height: RING }}
        >
          <svg
            width={RING}
            height={RING}
            viewBox={`0 0 ${RING} ${RING}`}
            className="-rotate-90"
            aria-hidden="true"
          >
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={STROKE}
            />
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              fill="none"
              stroke={SKY}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className="text-lg leading-none" aria-hidden="true">
              💧
            </span>
            <span
              data-testid="water-pct"
              className="text-lg font-bold tabular-nums text-foreground"
            >
              {Math.round(week.pct * 100)}%
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            data-testid="water-today"
            className="text-3xl font-bold tabular-nums text-foreground"
          >
            {formatWaterSr(week.todayMl)}
          </span>
          <span className="text-sm text-muted-foreground">
            od {formatWaterSr(week.goalMl)} cilj
          </span>
          <span
            className="mt-0.5 text-[11px] font-medium"
            style={{ color: week.reachedToday ? "var(--primary)" : SKY }}
          >
            {hint}
          </span>
        </div>
      </div>

      {/* 7-day mini bars with a dashed goal line */}
      <div>
        <div className="relative" style={{ height: CHART_H }}>
          <div
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-dashed border-border"
            style={{ bottom: `${(week.goalMl / week.maxMl) * 100}%` }}
          />
          <div className="absolute inset-0 flex items-end justify-between gap-1.5">
            {week.days.map((d) => (
              <div
                key={d.dayKey}
                className="flex h-full flex-1 flex-col items-center justify-end"
              >
                <div
                  className="w-full max-w-[22px] rounded-md rounded-b-none"
                  style={{
                    height: `${(d.ml / week.maxMl) * 100}%`,
                    backgroundColor: SKY,
                    opacity: d.ml === 0 ? 0 : d.isToday ? 1 : 0.5,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex justify-between gap-1.5">
          {week.days.map((d) => (
            <span
              key={d.dayKey}
              className={
                "flex-1 text-center text-[11px] " +
                (d.isToday
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground")
              }
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Nedeljni prosek: {formatWaterSr(week.weekAvgMl)} / dan
      </p>
    </section>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-full text-base"
        style={{ backgroundColor: "rgba(56,189,248,0.15)" }}
      >
        💧
      </span>
      <h2 className="text-lg font-semibold text-foreground">Voda</h2>
      <span className="ml-auto text-xs text-muted-foreground">Danas · 7 dana</span>
    </div>
  );
}
