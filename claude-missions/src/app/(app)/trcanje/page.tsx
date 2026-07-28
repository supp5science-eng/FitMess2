import { RunLanding } from "@/components/run/run-landing";

/**
 * `/trcanje` — the fourth tab now opens straight onto the immersive map with
 * your live position and a teal "Kreni". The recent-runs history moved to
 * Analitika (this screen is the map, not a list). The bottom nav stays visible
 * (not full-bleed), so you can still switch tabs from here.
 */
export default function TrcanjePage() {
  return <RunLanding />;
}
