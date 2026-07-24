"use server";

import type { CombinedMealEstimate } from "@/lib/ai/combined-estimate";
import {
  analyzeIPeachMeal,
  estimateMealFromImageAndVoice,
  finalizeIPeachMeal,
  type CombinedVariant,
  type ImagePart,
} from "@/lib/ai/gemini";
import {
  REFERENCE_OBJECTS,
  type IPeachAnalysis,
  type IPeachVariant,
  type ReferenceObject,
} from "@/lib/ai/ipeach";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// "Najtačniji unos": server action for the combined photo + voice/text flow.
// Both the image and the spoken/typed description are sent to Gemini here
// (server-side, so the API key never reaches the client) in one multimodal
// request. Saving reuses `logMealAction` from the meal-photo flow (same one-off
// `logs` row, method 'meal', optional stored thumbnail) -- not duplicated here.

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB (client already downscales)
const MAX_AUDIO_BYTES = 12 * 1024 * 1024; // ~60s mono 16kHz WAV is well under this
const MAX_NOTE_LEN = 1000;
const MAX_IMAGES = 5; // iPeach v2: up to 5 angles of the same meal
const MAX_ANSWERS_LEN = 4000; // compiled Q&A text

export type CombinedEstimateResult =
  | { ok: true; data: CombinedMealEstimate }
  | { ok: false; error_sr: string };

export async function estimateCombinedAction(
  formData: FormData
): Promise<CombinedEstimateResult> {
  // Auth-gate before touching the paid vision/audio API.
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }

  const image = formData.get("slika");
  if (!(image instanceof File) || image.size === 0) {
    return { ok: false, error_sr: "Nema slike. Slikaj obrok pa pokušaj ponovo." };
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return { ok: false, error_sr: "Slika je prevelika. Pokušaj ponovo." };
  }

  const audio = formData.get("audio");
  const audioFile = audio instanceof File && audio.size > 0 ? audio : null;
  if (audioFile && audioFile.size > MAX_AUDIO_BYTES) {
    return { ok: false, error_sr: "Snimak je prevelik. Snimi kraće pa pokušaj ponovo." };
  }

  const noteRaw = formData.get("opis");
  const note =
    typeof noteRaw === "string" ? noteRaw.trim().slice(0, MAX_NOTE_LEN) : "";

  const tipRaw = formData.get("tip");
  const variant: CombinedVariant =
    tipRaw === "deklaracija" ? "deklaracija" : "obrok";

  // The description (voice or text) is required -- it's the whole point of this
  // higher-accuracy path.
  if (!audioFile && !note) {
    return {
      ok: false,
      error_sr: "Dodaj opis — reci ili napiši šta si pojeo i koliko.",
    };
  }

  const imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");
  const imageMime = image.type || "image/jpeg";

  let audioPart: { base64: string; mimeType: string } | null = null;
  if (audioFile) {
    audioPart = {
      base64: Buffer.from(await audioFile.arrayBuffer()).toString("base64"),
      mimeType: audioFile.type || "audio/wav",
    };
  }

  try {
    const data = await estimateMealFromImageAndVoice(
      { base64: imageBase64, mimeType: imageMime },
      audioPart,
      note || null,
      variant
    );
    return { ok: true, data };
  } catch (err) {
    console.error("[najtacnije] combined estimate failed:", err);
    return {
      ok: false,
      error_sr: "Nismo uspeli da procenimo obrok. Pokušaj ponovo.",
    };
  }
}

// --- iPeach mtd v2: photos -> AI questions -> answers -> estimate -----------

export type IPeachAnalyzeResult =
  | { ok: true; data: IPeachAnalysis }
  | { ok: false; error_sr: string };

/** Read the 1–5 uploaded photos off the form, auth-gated + size-checked. */
async function readImages(
  formData: FormData
): Promise<
  | {
      ok: true;
      images: ImagePart[];
      variant: IPeachVariant;
      reference: ReferenceObject;
    }
  | { ok: false; error_sr: string }
> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }

  const files = formData
    .getAll("slike")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return { ok: false, error_sr: "Nema slike. Slikaj obrok pa pokušaj ponovo." };
  }
  if (files.length > MAX_IMAGES) {
    return {
      ok: false,
      error_sr: `Previše slika. Najviše ${MAX_IMAGES} po obroku.`,
    };
  }
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, error_sr: "Neka slika je prevelika. Pokušaj ponovo." };
    }
  }

  const images: ImagePart[] = [];
  for (const file of files) {
    images.push({
      base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
      mimeType: file.type || "image/jpeg",
    });
  }

  const tipRaw = formData.get("tip");
  const variant: IPeachVariant =
    tipRaw === "deklaracija" ? "deklaracija" : "obrok";

  // Which object the user laid beside the plate -- the model's metric anchor.
  const refRaw = formData.get("referenca");
  const reference: ReferenceObject = REFERENCE_OBJECTS.includes(
    refRaw as ReferenceObject
  )
    ? (refRaw as ReferenceObject)
    : "nista";

  return { ok: true, images, variant, reference };
}

/**
 * iPeach step 1: send the photos to Gemini and get back EITHER clarifying
 * questions or (already confident) a final estimate.
 */
export async function analyzeMealAction(
  formData: FormData
): Promise<IPeachAnalyzeResult> {
  const read = await readImages(formData);
  if (!read.ok) return read;

  try {
    const data = await analyzeIPeachMeal(
      read.images,
      read.variant,
      read.reference
    );
    return { ok: true, data };
  } catch (err) {
    console.error("[najtacnije] analyze failed:", err);
    return {
      ok: false,
      error_sr: "Nismo uspeli da analiziramo slike. Pokušaj ponovo.",
    };
  }
}

/**
 * iPeach step 2: the same photos + the user's answers (compiled text and/or a
 * spoken clip) -> the final estimate in the shared meal shape.
 */
export async function finalizeMealAction(
  formData: FormData
): Promise<CombinedEstimateResult> {
  const read = await readImages(formData);
  if (!read.ok) return read;

  const answersRaw = formData.get("odgovori");
  const answers =
    typeof answersRaw === "string"
      ? answersRaw.trim().slice(0, MAX_ANSWERS_LEN)
      : "";

  const audio = formData.get("audio");
  const audioFile = audio instanceof File && audio.size > 0 ? audio : null;
  if (audioFile && audioFile.size > MAX_AUDIO_BYTES) {
    return {
      ok: false,
      error_sr: "Snimak je prevelik. Snimi kraće pa pokušaj ponovo.",
    };
  }

  let audioPart: { base64: string; mimeType: string } | null = null;
  if (audioFile) {
    audioPart = {
      base64: Buffer.from(await audioFile.arrayBuffer()).toString("base64"),
      mimeType: audioFile.type || "audio/wav",
    };
  }

  try {
    const data = await finalizeIPeachMeal(
      read.images,
      answers || null,
      audioPart,
      read.variant,
      read.reference
    );
    return { ok: true, data };
  } catch (err) {
    console.error("[najtacnije] finalize failed:", err);
    return {
      ok: false,
      error_sr: "Nismo uspeli da procenimo obrok. Pokušaj ponovo.",
    };
  }
}
