import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

/**
 * `/onboarding` -- where `src/middleware.ts` (F013) redirects a verified,
 * not-yet-onboarded user right after sign-in (AS-018).
 *
 * A plain Server Component shell around the client `OnboardingFlow`, which
 * shows the animated post-login welcome first and then the questionnaire
 * wizard. No server data to fetch here (input is only collected and handed to
 * the summary step), so there's nothing to await before rendering.
 */
export default function OnboardingPage() {
  return <OnboardingFlow />;
}
