import type { IntakeNoteKind, IntakeTrend } from "@/lib/weight/intake-trend";

// Analitika "Procena težine" card: an estimated weight trend drawn from calorie
// intake (see `computeIntakeTrend`). Visual language borrowed from the app's
// weight-trend chart but restyled to the clean reference: a smooth violet line
// with hollow dots over a soft gradient, a divider, and a big estimated change
// with a nutrition note. Presentational + server-renderable (no client JS);
// every number arrives pre-computed. `null` trend => a calm "dopuni profil"
// state (we can't estimate without TDEE + a current weight).

const LINE = "#8B7CF6"; // violet accent, matching the reference design

const VB_W = 320;
const VB_H = 92;
const PAD_X = 12;
const PAD_Y = 12;

/** Serbian copy + tone for each nutrition insight. */
const NOTE: Record<IntakeNoteKind, { text: string; tone: "good" | "warn" | "info" }> = {
  no_data: { text: "Beleži obroke za precizniju procenu", tone: "info" },
  fat_high: { text: "Masti malo iznad plana", tone: "warn" },
  protein_low: { text: "Manje proteina od cilja", tone: "warn" },
  surplus: { text: "Unos iznad potrošnje", tone: "info" },
  on_track: { text: "U skladu s planom", tone: "good" },
};

const TONE_COLOR: Record<"good" | "warn" | "info", string> = {
  good: "var(--primary)",
  warn: "var(--chart-5)",
  info: "var(--muted-foreground)",
};

function fmtChange(kg: number): string {
  const abs = Math.abs(kg).toLocaleString("sr-RS", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const sign = kg < -0.05 ? "−" : kg > 0.05 ? "+" : "±";
  return `${sign}${abs} kg`;
}

export function IntakeTrendCard({ trend }: { trend: IntakeTrend | null }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Procena težine
        </h2>
        <p className="text-sm text-muted-foreground">Na osnovu unosa · 7 dana</p>
      </div>

      {trend ? (
        <>
          <Sparkline trend={trend} />

          <div className="h-px bg-border" />

          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span
                data-testid="intake-trend-change"
                className="text-3xl font-bold tabular-nums text-foreground"
              >
                {fmtChange(trend.estChangeKg)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                procenjena promena, 7 dana
              </span>
            </div>
            <NoteChip kind={trend.noteKind} />
          </div>
        </>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">
          Dopuni pol, godine, visinu, težinu i nivo aktivnosti u upitniku pa
          ćemo iz tvog unosa proceniti trend težine.
        </p>
      )}
    </section>
  );
}

function Sparkline({ trend }: { trend: IntakeTrend }) {
  const { points, minKg, maxKg } = trend;
  const span = Math.max(maxKg - minKg, 0.001);

  const xFor = (x: number) => PAD_X + x * (VB_W - 2 * PAD_X);
  // Higher weight sits higher up (smaller y).
  const yFor = (kg: number) =>
    PAD_Y + (1 - (kg - minKg) / span) * (VB_H - 2 * PAD_Y);

  const coords = points.map((p) => ({ x: xFor(p.x), y: yFor(p.estWeightKg) }));
  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  // Area path: the line, then down to the baseline and back, for the gradient.
  const areaPath =
    `${linePath} L${coords[coords.length - 1]!.x.toFixed(1)},${VB_H} ` +
    `L${coords[0]!.x.toFixed(1)},${VB_H} Z`;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full"
      role="img"
      aria-label={`Procenjeni trend težine: ${fmtChange(trend.estChangeKg)} za 7 dana`}
      data-testid="intake-trend-chart"
    >
      <defs>
        <linearGradient id="intakeTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={LINE} stopOpacity={0.22} />
          <stop offset="100%" stopColor={LINE} stopOpacity={0} />
        </linearGradient>
      </defs>

      <path d={areaPath} fill="url(#intakeTrendFill)" />
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
          key={points[i]!.dayKey}
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

function NoteChip({ kind }: { kind: IntakeNoteKind }) {
  const note = NOTE[kind];
  const color = TONE_COLOR[note.tone];
  return (
    <span
      data-testid="intake-trend-note"
      className="flex items-center gap-1.5 text-right text-xs font-medium text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {note.text}
    </span>
  );
}
