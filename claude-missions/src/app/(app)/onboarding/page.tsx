import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

/**
 * F015: `/onboarding` -- the page `src/middleware.ts` (F013) already
 * redirects a verified, not-yet-onboarded user to (AS-018). Until this
 * feature, that redirect landed on a 404 (documented in the F013 handoff's
 * "Out-of-scope work needed"); this is the page that fills it in.
 *
 * A plain Server Component shell around the client wizard -- no server
 * data to fetch here (this feature never reads or writes `profiles`; it
 * only collects input and hands it to F016's summary step), so there's
 * nothing to await before rendering.
 */
export default function OnboardingPage() {
  return <OnboardingWizard />;
}
