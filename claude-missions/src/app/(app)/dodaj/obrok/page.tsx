import { ObrokFlow } from "./obrok-flow";

// F064 (MVP): "Slikaj obrok" -- photograph a plate, Gemini estimates its
// calories + macros, the user confirms/edits, and it's logged into the day
// (method 'meal'). The whole flow is client-driven (camera + edit state) with
// the Gemini call + log write behind server actions (`./actions.ts`).
export default function ObrokPage() {
  return <ObrokFlow />;
}
