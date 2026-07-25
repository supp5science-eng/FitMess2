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
 * Same core + same schema as the `/telefon` capture gate Google users pass
 * through (`savePhoneAction`), so the two never validate differently -- the
 * only difference is that this one is an EDIT: it stays inside the app and
 * returns a result instead of redirecting to `/danas`.
 */
export async function changePhoneAction(input: {
  dialCode: string;
  local: string;
}): Promise<ChangePhoneResult> {
  const parsed = phoneSchema.safeParse(
    normalizePhone(input.dialCode, input.local)
  );
  if (!parsed.success) {
    return {
      ok: false,
      error_sr: parsed.error.issues[0]?.message ?? "Unesi ispravan broj telefona.",
    };
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }

  const result = await updateProfilePhone(supabase, userId, parsed.data);
  if (!result.ok) {
    return { ok: false, error_sr: result.error_sr };
  }

  return { ok: true, phone: parsed.data };
}
