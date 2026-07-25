import Link from "next/link";
import {
  Camera,
  ChevronLeft,
  CircleCheck,
  Download,
  Footprints,
  GlassWater,
  Mail,
  Scale,
  SlidersHorizontal,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth/current-user";
import { collectExportSummary, formatMemberSince } from "@/lib/export/summary";
import { createClient } from "@/lib/supabase/server";

/**
 * `/profil/moji-podaci` -- "Moji podaci".
 *
 * The old flow linked "Preuzmi moje podatke" straight at `/api/export`, so a
 * tap dropped a raw `.json` on the user with no idea what was in it, and a
 * failed export rendered the API's error envelope as bare JSON on screen.
 *
 * This page is the missing step: it shows WHAT is stored (counts only, never
 * contents) before offering the file. The download itself is still the same
 * route -- a plain link, so the browser's own download handling does the work
 * with no client JS.
 */

const ICONS: Record<string, LucideIcon> = {
  logs: UtensilsCrossed,
  weighIns: Scale,
  waterIntake: GlassWater,
  stepCounts: Footprints,
  habitChecks: CircleCheck,
  mealPhotos: Camera,
  targets: SlidersHorizontal,
};

/** Serbian text for the `?greska=` reason `/api/export` redirects back with
 * when a download fails (it is reached by a link, so it can only answer with a
 * navigation, not with an inline message). */
const ERROR_TEXT_SR: Record<string, string> = {
  sesija: "Sesija je istekla. Prijavi se ponovo pa pokušaj opet.",
  "1": "Nismo uspeli da pripremimo tvoj fajl. Proveri konekciju i pokušaj ponovo.",
};

export default async function MojiPodaciPage({
  searchParams,
}: {
  searchParams: Promise<{ greska?: string }>;
}) {
  const { greska } = await searchParams;
  const errorText = greska ? ERROR_TEXT_SR[greska] ?? ERROR_TEXT_SR["1"] : null;

  const supabase = await createClient();
  const currentUser = await getCurrentUser(supabase);

  const backLink = (
    <Link
      href="/profil"
      className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" aria-hidden={true} />
      Podešavanja
    </Link>
  );

  if (!currentUser) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
        {backLink}
        <p role="alert" className="text-sm text-muted-foreground">
          Sesija je istekla. Prijavi se ponovo.
        </p>
      </main>
    );
  }

  const summary = await collectExportSummary(
    supabase,
    currentUser.id,
    currentUser.email ?? null
  );
  const memberSince = formatMemberSince(summary.memberSince);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      {backLink}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Moji podaci
        </h1>
        <p className="text-sm text-muted-foreground">
          Ovo je sve što čuvamo o tebi.
        </p>
      </div>

      {errorText ? (
        <p
          role="alert"
          data-testid="export-error"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorText}
        </p>
      ) : null}

      <section className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        <Row icon={Mail} label="Nalog" value={summary.email ?? "—"} />
        {memberSince ? (
          <Row icon={CircleCheck} label="Sa nama od" value={memberSince} />
        ) : null}
      </section>

      <section
        data-testid="export-summary"
        className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card"
      >
        {summary.rows.map((row) => (
          <Row
            key={row.key}
            icon={ICONS[row.key] ?? UtensilsCrossed}
            label={row.labelSr}
            // "—" rather than 0: a section we could not read is not the same
            // claim as a section that is empty.
            value={row.count === null ? "—" : String(row.count)}
            testId={`export-count-${row.key}`}
          />
        ))}
      </section>

      <div className="flex flex-col gap-2">
        {/* A plain link, not a fetch + Blob dance: the route already sends
            `Content-Disposition: attachment`, so the browser downloads it. */}
        <a
          href="/api/export"
          download
          data-testid="export-download-link"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground"
        >
          <Download className="size-4" aria-hidden={true} />
          Preuzmi sve (.json)
        </a>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Dobićeš jedan fajl koji možeš otvoriti u bilo kom editoru teksta.
          Same slike obroka nisu u njemu — brišu se automatski otprilike dan po
          unosu, a kalorije i makroi tog obroka ostaju u unosima.
        </p>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Ako želiš da sve ovo nestane, u Podešavanjima postoji „Obriši nalog“ —
        briše nalog i sve podatke iz tabele iznad.
      </p>
    </main>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3" data-testid={testId}>
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden={true} />
      <span className="flex-1 text-sm text-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
