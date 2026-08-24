import { NextResponse } from "next/server";

import { CLONE_PROMPT_VERSION } from "@/lib/avatar/clone-prompt";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

/**
 * `POST /api/klon/sacuvaj` -- attach the klon drawn before sign-up to the
 * account that now exists.
 *
 * This is the second half of the pre-auth flow. `/api/klon` draws and stores
 * nothing; the browser holds the picture (`@/lib/avatar/klon-stash`) through
 * the questionnaire and registration; this route is where it finally gets a
 * `user_id`. NOT authenticated-optional -- a session is required, because a
 * user id is the entire point of the call.
 *
 * It never draws anything, so it costs nothing and is not capped: the model is
 * not involved and the only thing being spent is a row.
 */

/** A klon is around a megabyte. Twice that is a client that is not ours. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error_sr: "Sesija je istekla. Prijavi se ponovo." },
      { status: 401 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error_sr: "Čuvanje nije uspelo. Probaj ponovo." },
      { status: 400 }
    );
  }

  const file = formData.get("klon");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { ok: false, error_sr: "Nema klona za čuvanje." },
      { status: 400 }
    );
  }
  if (file.size > MAX_IMAGE_BYTES || !file.type.startsWith("image/")) {
    return NextResponse.json(
      { ok: false, error_sr: "Klon nije ispravan. Napravi ga ponovo." },
      { status: 400 }
    );
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const { error } = await supabase.from("avatar_clones").upsert(
    {
      user_id: userId,
      image_base64: base64,
      mime_type: file.type,
      prompt_version: CLONE_PROMPT_VERSION,
      // The count is not known here -- the drawing happened on a different
      // request, before this account existed. 0 means "not recorded", which is
      // honest; guessing a number would poison the only quality signal the
      // column carries.
      source_count: 0,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("[klon] attach failed:", error);
    return NextResponse.json(
      { ok: false, error_sr: "Čuvanje nije uspelo. Probaj ponovo." },
      { status: 500 }
    );
  }

  // The gate marker, and only after the image landed -- same rule as the
  // authenticated action: a marker without an image lets someone into an app
  // that has no avatar for them.
  const { error: markError } = await supabase
    .from("profiles")
    .update({ klon_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (markError) {
    console.error("[klon] gate marker failed:", markError);
    return NextResponse.json(
      { ok: false, error_sr: "Čuvanje nije uspelo. Probaj ponovo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
