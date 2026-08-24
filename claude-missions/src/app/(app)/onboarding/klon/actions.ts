"use server";

import {
  cloneErrorSr,
  generateKlon,
  type InlineImage,
} from "@/lib/ai/gemini";
import { chargeAiEstimate } from "@/lib/ai/quota";
import {
  checkPhotoCount,
  CLONE_PROMPT_VERSION,
  MAX_CLONE_PHOTOS,
} from "@/lib/avatar/clone-prompt";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

/**
 * Server actions for `/onboarding/klon` -- the screen that turns 5-20 photos
 * into the user's avatar.
 *
 * The photos never leave this function. They arrive as `FormData`, get
 * base64'd, go to the image model inline, and fall out of scope when it
 * answers. Nothing writes them to the database, to Storage, or to a log line;
 * the only thing that is persisted is the DRAWING that comes back. That is the
 * promise `supabase/migrations/0033_avatar_clones.sql` was written around and
 * the reason the screen can ask for someone's face at all.
 */

/** Per photo, after the client's downscale. Generous -- the client already
 * re-encodes to ~1280px JPEG, so anything near this is a client that failed. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * All twenty together, held just under the 10 MB Server Action body cap in
 * `next.config.ts`. The per-photo ceiling alone does not bound the request, and
 * the platform rejects an oversized body BEFORE this function runs -- so this
 * check never fires for a well-behaved client (the screen downscales to 768px,
 * landing around 2-3 MB for twenty) and exists for the one that isn't.
 */
const MAX_TOTAL_BYTES = 9 * 1024 * 1024;

export type CloneResult =
  | {
      ok: true;
      dataUrl: string;
      /**
       * False when the drawing came back but the row did not land. The picture
       * is still handed over and shown -- it was waited for and paid for -- but
       * the screen has to say out loud that it will not be there next time,
       * rather than let the user walk away believing it was kept.
       */
      saved: boolean;
    }
  | { ok: false; error_sr: string };

export async function createCloneAction(
  formData: FormData
): Promise<CloneResult> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }

  // Re-checked server-side even though the button is disabled below the floor:
  // `FormData` arrives from a client we do not control, and this call is the
  // most expensive one in the app.
  const files = formData
    .getAll("slike")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const count = checkPhotoCount(files.length);
  if (!count.ok) return { ok: false, error_sr: count.error_sr };

  let total = 0;
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, error_sr: "Jedna slika je prevelika. Izbaci je pa probaj ponovo." };
    }
    total += file.size;
  }
  if (total > MAX_TOTAL_BYTES) {
    return {
      ok: false,
      error_sr: `Slike su zajedno prevelike. Probaj sa manje slika (do ${MAX_CLONE_PHOTOS}).`,
    };
  }

  // One user action = one charge, taken before the model is reached, the same
  // rule every other AI entry point follows (see `@/lib/ai/quota`). Drawing a
  // klon is by far the priciest single call the app makes, so it must not be
  // the one door that opens for free.
  const quota = await chargeAiEstimate(supabase, userId);
  if (!quota.ok) return { ok: false, error_sr: quota.error_sr };

  const photos: InlineImage[] = await Promise.all(
    files.map(async (file) => ({
      base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
      mimeType: file.type || "image/jpeg",
    }))
  );

  let image: InlineImage;
  try {
    image = await generateKlon(photos);
  } catch (err) {
    console.error("[klon] generation failed:", err);
    return {
      ok: false,
      error_sr: cloneErrorSr(err),
    };
  }

  // Overwrite rather than append: one klon per user is the whole model, and
  // "napravi ponovo" means replace, not collect.
  const { error } = await supabase.from("avatar_clones").upsert(
    {
      user_id: userId,
      image_base64: image.base64,
      mime_type: image.mimeType,
      prompt_version: CLONE_PROMPT_VERSION,
      source_count: photos.length,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) console.error("[klon] save failed:", error);

  // The gate marker, and ONLY after the image actually landed. `profiles.klon_at`
  // is what the middleware reads on every navigation (0034), so setting it for a
  // klon that failed to store would open the app to a user who has no avatar --
  // the one state the whole mandatory gate exists to prevent.
  if (!error) {
    const { error: markError } = await supabase
      .from("profiles")
      .update({ klon_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (markError) {
      console.error("[klon] gate marker failed:", markError);
      // Image saved, gate still shut. Say so rather than sending the user into
      // a redirect that will bounce them straight back here.
      return {
        ok: true,
        dataUrl: `data:${image.mimeType};base64,${image.base64}`,
        saved: false,
      };
    }
  }

  return {
    ok: true,
    dataUrl: `data:${image.mimeType};base64,${image.base64}`,
    saved: !error,
  };
}
