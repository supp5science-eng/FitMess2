"use server";

import { updateProfilePhone } from "@/lib/auth/core";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { normalizePhone, phoneSchema } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export interface ChangePhoneResult {
  ok: boolean;
  /** The saved E.164 number, so the form can re-render what was actually
   * stored (trunk zero dropped, spaces removed) rather than what was typed. */
  phone?: string;
  error_sr?: string;
}

/**
 * "Broj telefona" save from Podešavanja (`/profil/telefon`).
 *
 * Same core + same schema as the `/telefon` ask OAuth users pass through
 * (`savePhoneAction`), so the two never validate differently -- the only
 * difference is that this one is an EDIT: it stays inside the app and returns
 * a result instead of redirecting to `/danas`. Submitting an empty field here
 * removes the stored number.
 */
export async function changePhoneAction(input: {
  dialCode: string;
  local: string;
}): Promise<ChangePhoneResult> {
  const typed = normalizePhone(input.dialCode, input.local);

  // An emptied field DELETES the number rather than failing validation. The
  // phone is optional (guideline 5.1.1(v)); a field the user may leave blank at
  // signup is one they must be able to take back afterwards, and "you can never
  // remove it once given" is the same collection problem one step later.
  if (typed !== null) {
    const parsed = phoneSchema.safeParse(typed);
    if (!parsed.success) {
      return {
        ok: false,
        error_sr:
          parsed.error.issues[0]?.message ?? "Unesi ispravan broj telefona.",
      };
    }
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }

  const result = await updateProfilePhone(supabase, userId, typed);
  if (!result.ok) {
    return { ok: false, error_sr: result.error_sr };
  }

  return { ok: true, phone: typed ?? undefined };
}
