import { NextResponse } from "next/server";

import {
  cloneErrorSr,
  generateKlon,
  type InlineImage,
} from "@/lib/ai/gemini";
import {
  checkPhotoCount,
  MAX_CLONE_PHOTOS,
} from "@/lib/avatar/clone-prompt";
import { chargeKlonIp } from "@/lib/avatar/klon-ip-cap";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * `POST /api/klon` -- draw a klon for someone who has no account yet.
 *
 * This is the endpoint behind the FIRST screen of the funnel (landing ->
 * "Kreni" -> `/klon` -> `/upitnik`), so it is public by design. Two things
 * follow from that, and both are the whole reason this file is a route handler
 * rather than the server action its authenticated twin uses:
 *
 * 1. IT STORES NOTHING. No row, no bucket, no log line with an image in it.
 *    The photos go to the model and fall out of scope; the drawing goes back in
 *    the response and lives only in the visitor's own browser
 *    (`@/lib/avatar/klon-stash`) until they register, at which point
 *    `/api/klon/sacuvaj` writes it under their user id. Before that moment
 *    there is no user id to write it under, and inventing an anonymous one
 *    would mean keeping a stranger's face on a row nobody can ever claim or
 *    delete.
 *
 * 2. IT IS CAPPED PER ADDRESS. Every other paid call in the app is charged to
 *    `auth.uid()`; this one has nobody to charge, and billing is enabled on the
 *    Gemini key. See `@/lib/avatar/klon-ip-cap` for what that cap is and is not.
 */

/** Per photo, after the client's downscale. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** All of them together -- a route handler has no 10MB Server Action ceiling,
 * but an unbounded body on a public endpoint is its own denial-of-service. */
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error_sr: "Slanje nije uspelo. Probaj ponovo." },
      { status: 400 }
    );
  }

  const files = formData
    .getAll("slike")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const count = checkPhotoCount(files.length);
  if (!count.ok) {
    return NextResponse.json(
      { ok: false, error_sr: count.error_sr },
      { status: 400 }
    );
  }

  let total = 0;
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { ok: false, error_sr: "Jedna slika je prevelika. Izbaci je pa probaj ponovo." },
        { status: 400 }
      );
    }
    total += file.size;
  }
  if (total > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error_sr: `Slike su zajedno prevelike. Probaj sa manje slika (do ${MAX_CLONE_PHOTOS}).`,
      },
      { status: 400 }
    );
  }

  // Charged BEFORE the model runs. A cap that only counts successes bills the
  // owner for every failure.
  const cap = await chargeKlonIp(createAdminClient(), request.headers);
  if (!cap.ok) {
    return NextResponse.json(
      { ok: false, error_sr: cap.error_sr },
      { status: 429 }
    );
  }

  const photos: InlineImage[] = await Promise.all(
    files.map(async (file) => ({
      base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
      mimeType: file.type || "image/jpeg",
    }))
  );

  try {
    const image = await generateKlon(photos);
    return NextResponse.json({
      ok: true,
      dataUrl: `data:${image.mimeType};base64,${image.base64}`,
      // The visitor's browser is the only place this exists until they sign up,
      // so it is told plainly rather than left to infer.
      saved: false,
    });
  } catch (err) {
    console.error("[klon] public generation failed:", err);
    return NextResponse.json(
      { ok: false, error_sr: cloneErrorSr(err) },
      { status: 502 }
    );
  }
}
