import { NajtacnijeFlow } from "./flow";

// "Najtačniji unos" (M7): the highest-accuracy logging path -- the user
// photographs the plate AND describes (voice or text) what they ate and roughly
// how much, and Gemini fuses both in one multimodal call. Client-driven flow
// (camera + mic + edit state) with the Gemini call + log write behind server
// actions (`./actions.ts` + the shared `logMealAction`).
export default function NajtacnijePage() {
  return <NajtacnijeFlow />;
}
