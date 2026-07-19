"use server";

import { updateUserPassword } from "@/lib/auth/core";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { resetPasswordSchema } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export interface ChangePasswordResult {
  ok: boolean;
  error_sr?: string;
}

/**
 * "Promeni lozinku" save (`/profil/lozinka`). The user is already
 * authenticated (middleware guarantees it), so Supabase's `updateUser`
 * ({password}) sets the new password on the ACTIVE session without needing
 * the old one -- same core (`updateUserPassword`) and same schema
 * (`resetPasswordSchema`: new password + confirmation must match) the
 * recovery/reset flow uses, so the two paths never drift. Validates
 * server-side (defense in depth) before touching auth.
 */
export async function changePasswordAction(input: {
  password: string;
  confirmPassword: string;
}): Promise<ChangePasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error_sr: parsed.error.issues[0]?.message ?? "Proveri unete podatke.",
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

  return updateUserPassword(supabase, parsed.data.password);
}
