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
 * MANDATORY: no klon, no app. But it rarely asks for photos, because the klon
 * is normally drawn on the PUBLIC `/klon` screen before registration -- the
 * component's first move is to look for that stashed drawing and attach it to
 * the account. This route is the backstop for an account that arrived without
 * one: a Google sign-in straight from `/prijava`, a cleared browser, a failed
 * upload.
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
      <KlonScreen mode="nalog" initialDataUrl={initialDataUrl} />
    </main>
  );
}
