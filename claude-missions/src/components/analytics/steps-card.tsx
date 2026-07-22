import { formatSteps, type StepsWeek } from "@/lib/steps/steps-week";

// Analitika "Koraci" card: a 7-day steps line chart in the same clean language
// as the "Procena težine" card -- a smooth green line with hollow dots over a
// soft gradient, a divider, then today's total with a goal note. Presentational
// + server-renderable (no client JS); every number arrives pre-computed from
// `computeStepsWeek`. Steps are logged on `/danas`; this card is the overview.

const LINE = "#22C55E"; // green-500

const VB_W = 320;
const VB_H = 92;
const PAD_X = 12;
const PAD_Y = 12;

export function StepsCard({ week }: { week: StepsWeek | null }) {
  if (!week) {
    return (
      <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6">
        <Header />
        <p className="py-4 text-sm text-muted-foreground">
          Nismo uspeli da učitamo korake. Pokušaj ponovo.
        </p>
      </section>
    );
  }

  const today = week.days[week.days.length - 1]!;
  const todayHint = today.reached
    ? "cilj ispunjen 🎉"
    : `${Math.round(today.pct * 100)}% dnevnog cilja`;

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6">
      <Header />

      <Sparkline week={week} />

      <div className="h-px bg-border" />

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span
            data-testid="steps-today"
            className="text-3xl font-bold tabular-nums text-foreground"
          >
            {formatSteps(today.steps)}
          </span>
          <span
            className="text-[11px] font-medium"
            style={{ color: today.reached ? LINE : "var(--muted-foreground)" }}
          >
            {todayHint} · danas
          </span>
        </div>

        <span
          data-testid="steps-avg"
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
        >
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: LINE }}
          />
          prosek {formatSteps(week.weekAvgSteps)} /dan
        </span>
      </div>
    </section>
  );
}

function Sparkline({ week }: { week: StepsWeek }) {
  const max = Math.max(week.maxSteps, 1);
  const points = week.days.map((d, i) => ({
    x: i / (week.days.length - 1),
    steps: d.steps,
  }));

  const xFor = (x: number) => PAD_X + x * (VB_W - 2 * PAD_X);
  // Steps sit on a 0 baseline; higher counts sit higher up (smaller y).
  const yFor = (steps: number) =>
    PAD_Y + (1 - steps / max) * (VB_H - 2 * PAD_Y);

  const coords = points.map((p) => ({ x: xFor(p.x), y: yFor(p.steps) }));
  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  const areaPath =
    `${linePath} L${coords[coords.length - 1]!.x.toFixed(1)},${VB_H} ` +
    `L${coords[0]!.x.toFixed(1)},${VB_H} Z`;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full"
      role="img"
      aria-label={`Koraci u poslednjih 7 dana; prosek ${formatSteps(
        week.weekAvgSteps
      )} dnevno`}
      data-testid="steps-chart"
    >
      <defs>
        <linearGradient id="stepsTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={LINE} stopOpacity={0.24} />
          <stop offset="100%" stopColor={LINE} stopOpacity={0} />
        </linearGradient>
      </defs>

      <path d={areaPath} fill="url(#stepsTrendFill)" />
      <path
        d={linePath}
        fill="none"
        stroke={LINE}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Hollow dots (fill = card so the line doesn't show through the center). */}
      {coords.map((c, i) => (
        <circle
          key={week.days[i]!.dayKey}
          cx={c.x}
          cy={c.y}
          r={4}
          fill="var(--card)"
          stroke={LINE}
          strokeWidth={2.5}
        />
      ))}
    </svg>
  );
}

function Header() {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        Koraci
      </h2>
      <p className="text-sm text-muted-foreground">Poslednjih 7 dana</p>
    </div>
  );
}
