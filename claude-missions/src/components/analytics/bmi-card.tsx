// Analitika: the "Tvoj BMI" card. Body-mass-index value + WHO category, a
// four-zone colour bar with a marker at the user's position, and a legend with
// the standard thresholds. Presentational: the raw BMI number is computed by
// the page from the questionnaire's height/weight; everything else (category,
// marker position, formatting) is derived here. Calm, non-punitive tone.

// Standard WHO BMI zones. Colours are fixed semantic zone colours (blue →
// green → amber → red), NOT the app's theme accent, so the scale reads the same
// in light and dark. `adjective` agrees with feminine "težina" for the headline
// sentence; `legend` is the zone name shown under the bar.
const ZONES = [
  { key: "under", color: "#5B8DEF", legend: "Pothranjenost", range: "<18,5", adjective: "premala" },
  { key: "healthy", color: "#22B573", legend: "Zdravo", range: "18,5–24,9", adjective: "zdrava" },
  { key: "over", color: "#E0B252", legend: "Prekomerna", range: "25,0–29,9", adjective: "prekomerna" },
  { key: "obese", color: "#E0685E", legend: "Gojaznost", range: ">30,0", adjective: "previsoka" },
] as const;

// Visual scale for the bar/marker: BMI 15..40. Segment widths and the marker
// position are proportional to this range, so the marker lands exactly on the
// category boundaries (18.5 / 25 / 30) and a real BMI maps to a real spot.
const SCALE_MIN = 15;
const SCALE_MAX = 40;
const BOUNDS = [18.5, 25, 30] as const;

function zoneIndexFor(bmi: number): number {
  if (bmi < BOUNDS[0]) return 0;
  if (bmi < BOUNDS[1]) return 1;
  if (bmi < BOUNDS[2]) return 2;
  return 3;
}

/** Segment widths (% of the bar), proportional to the 15..40 scale: ~14/26/20/40. */
function segmentWidths(): number[] {
  const edges = [SCALE_MIN, ...BOUNDS, SCALE_MAX];
  const span = SCALE_MAX - SCALE_MIN;
  return edges.slice(0, -1).map((edge, i) => ((edges[i + 1]! - edge) / span) * 100);
}

export function BmiCard({ bmi }: { bmi: number | null }) {
  const help =
    "Indeks telesne mase (ITM) je odnos težine i visine. Orijentaciona mera — ne razlikuje mišićnu od masne mase.";

  if (bmi == null) {
    return (
      <section className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-6">
        <Header help={help} />
        <p data-testid="bmi-empty" className="max-w-[40ch] text-sm text-muted-foreground">
          Dopuni visinu i težinu u upitniku pa ćemo ti ovde izračunati indeks
          telesne mase.
        </p>
      </section>
    );
  }

  const zone = ZONES[zoneIndexFor(bmi)]!;
  const widths = segmentWidths();
  const markerPct = Math.min(
    100,
    Math.max(0, ((bmi - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100)
  );
  const bmiLabel = bmi.toLocaleString("sr-RS", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6">
      <Header help={help} />

      {/* Value + category pill */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          data-testid="bmi-value"
          className="text-5xl font-bold leading-none tabular-nums text-foreground"
        >
          {bmiLabel}
        </span>
        <span className="flex items-center gap-2 text-base text-muted-foreground">
          Tvoja težina je
          <span
            data-testid="bmi-category"
            className="rounded-full px-3 py-1 text-sm font-semibold capitalize"
            style={{ color: zone.color, backgroundColor: `${zone.color}22` }}
          >
            {zone.adjective}
          </span>
        </span>
      </div>

      {/* Four-zone bar with the position marker */}
      <div className="relative py-1">
        <div className="flex h-3 gap-1">
          {ZONES.map((z, i) => (
            <div
              key={z.key}
              className="h-full rounded-full"
              style={{ width: `${widths[i]}%`, backgroundColor: z.color }}
            />
          ))}
        </div>
        <span
          data-testid="bmi-marker"
          aria-hidden="true"
          className="absolute top-1/2 h-6 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          style={{ left: `${markerPct}%` }}
        />
      </div>

      {/* Legend: zone name + threshold range */}
      <ul className="grid grid-cols-4 gap-x-2 gap-y-1">
        {ZONES.map((z) => (
          <li key={z.key} className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-xs font-medium leading-tight text-foreground">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: z.color }}
              />
              {z.legend}
            </span>
            <span className="pl-3.5 text-[11px] text-muted-foreground">
              {z.range}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Card header: title + a circled "?" carrying the plain-language explanation
 * (native tooltip + accessible label; no client JS, no icon dependency). */
function Header({ help }: { help: string }) {
  return (
    <div className="flex items-start justify-between">
      <h2 className="text-lg font-semibold text-foreground">Tvoj BMI</h2>
      <span
        role="img"
        aria-label={help}
        title={help}
        className="flex size-5 shrink-0 cursor-help items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground"
      >
        ?
      </span>
    </div>
  );
}
