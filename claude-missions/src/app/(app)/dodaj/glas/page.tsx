import { GlasFlow } from "./glas-flow";

// "Reci obrok" (M7): speak what you ate/drank -- either dictating the values
// straight off a label or just describing it -- Gemini turns the clip into a
// calorie + macro estimate, the user confirms/edits, and it's logged into the
// day (method 'meal'). Client-driven capture (mic + edit state) with the Gemini
// call + log write behind server actions (`./actions.ts`).
export default function GlasPage() {
  return <GlasFlow />;
}
