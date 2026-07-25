import { getCurrentUserId } from "@/lib/auth/current-user";
import { getFrequentSnacks } from "@/lib/gric/frequent";
import { createClient } from "@/lib/supabase/server";

import { GricFlow } from "./gric-flow";

// "Gric": the fast lane for the small stuff — a cucumber, a handful of seeds,
// two apricots. One recording can name several of them and each becomes its
// own log row (`method 'meal'`, no migration). The server side only prepares
// the "Opet isto" chips (the user's own most-logged snacks); the microphone,
// the confirm chips and the auto-save countdown live in the client flow, and
// the Gemini call + write are server actions in `./actions.ts`.
export default async function GricPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  // Route protection already guarantees a session here; the guard is only so a
  // missing one degrades to "no shortcuts" instead of throwing.
  const frequent = userId ? await getFrequentSnacks(supabase, userId) : [];

  return <GricFlow frequent={frequent} />;
}
