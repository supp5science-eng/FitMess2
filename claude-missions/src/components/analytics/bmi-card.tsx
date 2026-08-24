import { SourcesLink } from "@/components/sources/sources-link";
import { getT } from "@/lib/i18n/server";

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
  { key: "under", color: "#3F5FA8", range: "<18,5" },
  { key: "healthy", color: "#2C7A58", range: "18,5–24,9" },
  { key: "over", color: "#B5761F", range: "25,0–29,9" },
  { key: "obese", color: "#C05028", range: ">30,0" },
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

export async function BmiCard({ bmi }: { bmi: number | null }) {
  const { t } = await getT();
  const help = t("analytics.bmi.help");
  const title = t("analytics.bmi.title");
  const zoneLabels: Record<
    (typeof ZONES)[number]["key"],
    { legend: string; adjective: string }
  > = {
    under: {
      legend: t("analytics.bmi.zone.under.legend"),
      adjective: t("analytics.bmi.zone.under.adjective"),
    },
    healthy: {
      legend: t("analytics.bmi.zone.healthy.legend"),
      adjective: t("analytics.bmi.zone.healthy.adjective"),
    },
    over: {
      legend: t("analytics.bmi.zone.over.legend"),
      adjective: t("analytics.bmi.zone.over.adjective"),
    },
    obese: {
      legend: t("analytics.bmi.zone.obese.legend"),
      adjective: t("analytics.bmi.zone.obese.adjective"),
    },
  };

  if (bmi == null) {
    return (
      <section className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-6">
        <Header help={help} title={title} />
        <p data-testid="bmi-empty" className="max-w-[40ch] text-sm text-muted-foreground">
          {t("analytics.bmi.empty")}
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
      <Header help={help} title={title} />

      {/* Value + category pill */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          data-testid="bmi-value"
          className="text-5xl font-bold leading-none tabular-nums text-foreground"
        >
          {bmiLabel}
        </span>
        <span className="flex items-center gap-2 text-base text-muted-foreground">
          {t("analytics.bmi.yourWeightIs")}
          <span
            data-testid="bmi-category"
            className="rounded-full px-3 py-1 text-sm font-semibold capitalize"
            style={{ color: zone.color, backgroundColor: `${zone.color}22` }}
          >
            {zoneLabels[zone.key].adjective}
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

      {/* Legend: zone name + threshold range. Two columns (2×2) so even the
          longest Serbian labels ("Pothranjenost") get room and never collide. */}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
        {ZONES.map((z) => (
          <li key={z.key} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="mt-1 size-2 shrink-0 rounded-full"
              style={{ backgroundColor: z.color }}
            />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-xs font-medium text-foreground">
                {zoneLabels[z.key].legend}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {z.range}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* The zone thresholds are WHO's, not ours -- guideline 1.4.1 wants that
          checkable from the screen that shows them. */}
      <SourcesLink t={t} />
    </section>
  );
}

/** Card header: title + a circled "?" carrying the plain-language explanation
 * (native tooltip + accessible label; no client JS, no icon dependency). */
function Header({ help, title }: { help: string; title: string }) {
  return (
    <div className="flex items-start justify-between">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
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
