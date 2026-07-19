"use server";

import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  updateProfileData,
  type UpdateProfileInput,
  type UpdateProfileResult,
} from "@/lib/profile/update-profile";
import { createClient } from "@/lib/supabase/server";

/**
 * "Izmeni podatke" save (`/profil/podaci`). Thin `"use server"` wrapper: it
 * resolves the caller from the session and delegates to the pure, testable
 * `updateProfileData`, which re-validates everything and recomputes the daily
 * budget from the same F014 engine before writing (see that file's header).
 */
export async function saveProfileDataAction(
  input: UpdateProfileInput
): Promise<UpdateProfileResult> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }
  return updateProfileData(supabase, userId, input);
}
