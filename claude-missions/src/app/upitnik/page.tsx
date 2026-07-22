import { PublicOnboardingFlow } from "@/components/onboarding/public-onboarding-flow";

/**
 * `/upitnik` — the public, pre-auth onboarding questionnaire the landing
 * page's "Kreni" CTA sends every new visitor to (Cal-AI-style: questionnaire
 * first, account later). A public route (`isPublicPath` in
 * `src/lib/auth/route-protection.ts`); no session required and no server data
 * to fetch — the client `PublicOnboardingFlow` collects answers, shows the
 * computed plan, then routes to registration.
 */
export default function UpitnikPage() {
  return <PublicOnboardingFlow />;
}
