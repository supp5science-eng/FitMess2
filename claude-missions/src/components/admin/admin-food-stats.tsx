import type { FoodStats } from "@/lib/food/admin-foods";

// F035 (agreed addition): a compact food-database summary for the top of
// `/admin/hrana` -- how big the catalog is, how much is verified vs still in
// the review queue, and the provenance split. Presentational only; the server
// page computes the numbers via `getFoodStats`.

export function AdminFoodStats({ stats }: { stats: FoodStats }) {
  return (
    <section aria-label="Statistika baze hrane" className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Ukupno" value={stats.total} />
        <StatCard label="Provereno" value={stats.verified} tone="primary" />
        <StatCard label="U redu za proveru" value={stats.unverified} />
        <StatCard label="Uklonjeno" value={stats.removed} tone="muted" />
      </div>
      <p className="text-xs text-muted-foreground">
        Izvor: {stats.bySource.seed} ručno · {stats.bySource.off} OFF ·{" "}
        {stats.bySource.user} korisnici
      </p>
    </section>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "primary" | "muted";
}) {
  const valueClass =
    tone === "primary"
      ? "text-primary"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-3">
      <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
