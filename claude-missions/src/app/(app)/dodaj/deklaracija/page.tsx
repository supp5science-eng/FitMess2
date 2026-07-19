import { DeklaracijaFlow } from "./deklaracija-flow";

// F063 (MVP): "Slikaj deklaraciju" -- photograph a product's nutrition table,
// Gemini reads the per-100g values, and the user is handed to the existing
// "novi proizvod" form (prefilled) to confirm/edit -> create the food ->
// portion -> log. The camera + estimate is client-driven; the Gemini call is
// behind a server action (`./actions.ts`).
export default function DeklaracijaPage() {
  return <DeklaracijaFlow />;
}
