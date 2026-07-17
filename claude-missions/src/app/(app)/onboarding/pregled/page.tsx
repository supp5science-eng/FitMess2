import Link from "next/link";

import { SummaryScreen } from "@/components/onboarding/summary-screen";
import {
  isOnboardingDataComplete,
  parseOnboardingSearchParams,
} from "@/lib/onboarding/summary";
import type { RawSearchParams } from "@/lib/onboarding/summary";

/**
 * F016: `/onboarding/pregled` -- the summary + persist step F015's wizard
 * hands off to (`buildOnboardingSummaryUrl`), completing onboarding
 * (AS-020, AS-030, AS-031). Until this feature shipped, the route 404'd
 * (documented as expected in the F015 handoff's "Out-of-scope work
 * needed").
 *
 * A Server Component reads the query string (per the clarified spec's
 * "Server-fetched props" data-shape answer) and does the one thing a plain
 * client component reading `useSearchParams()` couldn't do as cleanly:
 * decide, before rendering anything client-side, whether the hand-off is
 * actually complete. A direct/bookmarked visit here with no (or a partial)
 * query string -- the wizard was never finished -- renders the empty state
 * below instead of crashing the budget engine on missing inputs, per the
 * clarified "Friendly Serbian empty state with a clear next action" answer.
 */
export default async function OnboardingPregledPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const rawParams = await searchParams;
  const data = parseOnboardingSearchParams(rawParams);

  if (!isOnboardingDataComplete(data)) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <h1 className="text-xl font-semibold text-foreground">
          Nedostaju neki podaci
        </h1>
        <p className="text-sm text-muted-foreground">
          Izgleda da nismo dobili sve podatke iz upitnika. Vrati se na
          početak i popuni ga ponovo -- traje samo par minuta.
        </p>
        <Link
          href="/onboarding"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Nazad na upitnik
        </Link>
      </main>
    );
  }

  return <SummaryScreen initialData={data} />;
}
