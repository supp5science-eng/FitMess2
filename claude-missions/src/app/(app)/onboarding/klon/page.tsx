import type { Metadata } from "next";

import { KlonScreen } from "@/components/avatar/klon-screen";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

/**
 * `/onboarding/klon` -- the first screen after the plan: build the avatar.
 *
 * It lives under `/onboarding` rather than in the app shell for two reasons:
 * the subtree is already full-bleed (no bottom nav -- see
 * `components/shell/app-shell.tsx`), and onboarding routes are exempt from the
 * "not onboarded yet" redirect, so a finished user can still open it to redo
 * their klon without the middleware bouncing them.
 *
 * Deliberately skippable. A wall made of twenty selfies between someone and the
 * app they just installed would cost more users than the avatar can be worth;
 * "Preskoči za sad" goes straight to `/danas`.
 */
export const metadata: Metadata = {
  title: "Tvoj klon",
};

export default async function KlonPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  // An existing klon is shown instead of the picker -- reopening this route is
  // "let me see mine / redo it", not "start over".
  let initialDataUrl: string | undefined;
  if (userId) {
    const { data } = await supabase
      .from("avatar_clones")
      .select("image_base64, mime_type")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      initialDataUrl = `data:${data.mime_type};base64,${data.image_base64}`;
    }
  }

  return (
    <main data-testid="klon" className="flex flex-1 flex-col">
      <KlonScreen initialDataUrl={initialDataUrl} />
    </main>
  );
}
