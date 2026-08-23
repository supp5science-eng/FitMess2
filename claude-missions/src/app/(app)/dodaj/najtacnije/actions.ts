"use server";

import type { CombinedMealEstimate } from "@/lib/ai/combined-estimate";
import {
  aiErrorSr,
  analyzePrizmaMeal,
  estimateMealFromImageAndVoice,
  finalizePrizmaMeal,
  NO_FOOD_ERROR_SR,
  type CombinedVariant,
  type ImagePart,
  type UserPortion,
} from "@/lib/ai/gemini";
import {
  COUNT_MAX,
  COUNT_MIN,
  COVERAGE_MAX,
  COVERAGE_MIN,
  HEIGHT_LEVELS,
  isPrepMethod,
  isVessel,
  LEVEL_MAX,
  LEVEL_MIN,
  normaliseUnit,
  type HeightLevel,
  type PortionGeometry,
} from "@/lib/ai/portion";
import {
  REFERENCE_OBJECTS,
  type PrizmaAnalysis,
  type PrizmaVariant,
  type ReferenceObject,
} from "@/lib/ai/prizma";
import { chargeAiEstimate } from "@/lib/ai/quota";
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
const MAX_IMAGES = 5; // Prizma v2: up to 5 angles of the same meal
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

  // One user action = one charge against the free daily allowance, taken here
  // rather than inside `gemini.ts` because a single action can make two model
  // calls and "five a day" has to mean five meals. Enforcement is OFF today --
  // this call is what measures demand (see `@/lib/ai/quota`).
  const quota = await chargeAiEstimate(supabase, userId);
  if (!quota.ok) return { ok: false, error_sr: quota.error_sr };

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
      error_sr: aiErrorSr(err, "Nismo uspeli da procenimo obrok. Pokušaj ponovo."),
    };
  }
}

// --- Prizma v2: photos -> AI questions -> answers -> estimate -----------

export type PrizmaAnalyzeResult =
  | { ok: true; data: PrizmaAnalysis }
  | { ok: false; error_sr: string };

/** Read the 1–5 uploaded photos off the form, auth-gated + size-checked. */
async function readImages(
  formData: FormData
): Promise<
  | {
      ok: true;
      images: ImagePart[];
      variant: PrizmaVariant;
      reference: ReferenceObject;
      portion: UserPortion;
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
  const variant: PrizmaVariant =
    tipRaw === "deklaracija" ? "deklaracija" : "obrok";

  // Which object the user laid beside the plate -- the model's metric anchor.
  const refRaw = formData.get("referenca");
  const reference: ReferenceObject = REFERENCE_OBJECTS.includes(
    refRaw as ReferenceObject
  )
    ? (refRaw as ReferenceObject)
    : "nista";

  return { ok: true, images, variant, reference, portion: readPortion(formData) };
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

/**
 * The user's own portion call, made while standing over the plate. Everything
 * here is re-clamped rather than trusted: it arrives from a form, and a
 * nonsense coverage or unit mass would be handed straight to the model as the
 * scale anchor for the whole estimate.
 */
function readPortion(formData: FormData): UserPortion {
  const vesselRaw = formData.get("posuda");
  if (!isVessel(vesselRaw)) return null;

  const num = (key: string) => Number(formData.get(key));
  let geometry: PortionGeometry;

  if (vesselRaw === "dubok") {
    const level = num("nivo");
    if (!Number.isFinite(level)) return null;
    geometry = { vessel: "dubok", level: clamp(level, LEVEL_MIN, LEVEL_MAX) };
  } else if (vesselRaw === "komadi") {
    const count = num("komada");
    if (!Number.isFinite(count)) return null;
    geometry = {
      vessel: "komadi",
      count: Math.round(clamp(count, COUNT_MIN, COUNT_MAX)),
    };
  } else {
    const coverage = num("pokrivenost");
    if (!Number.isFinite(coverage)) return null;
    const heightRaw = formData.get("visina");
    const height = HEIGHT_LEVELS.includes(heightRaw as HeightLevel)
      ? (heightRaw as HeightLevel)
      : "prst";
    geometry = {
      vessel: "ravan",
      coverage: clamp(coverage, COVERAGE_MIN, COVERAGE_MAX),
      height,
    };
  }

  const prepRaw = formData.get("priprema");
  return {
    geometry,
    // `normaliseUnit` bounds the mass the model gave us for one unit of this
    // food -- the client sends it back, so it must be re-checked here.
    unit: normaliseUnit(
      vesselRaw,
      formData.get("jedinica_naziv"),
      formData.get("jedinica_grami")
    ),
    prep: isPrepMethod(prepRaw) ? prepRaw : null,
  };
}

/**
 * Prizma step 1: send the photos to Gemini and get back EITHER clarifying
 * questions or (already confident) a final estimate.
 */
export async function analyzeMealAction(
  formData: FormData
): Promise<PrizmaAnalyzeResult> {
  const read = await readImages(formData);
  if (!read.ok) return read;

  // Charged on step 1 ONLY. `readImages` is shared with `finalizeMealAction`,
  // so putting this there would bill one Prizma meal twice -- the user takes
  // one photo and answers questions about it, and that is one estimate. The
  // second auth round trip is free: `getCurrentUserId` verifies the JWT
  // locally (see its own comment), it does not call the Auth server.
  const quotaClient = await createClient();
  const quotaUser = await getCurrentUserId(quotaClient);
  if (quotaUser) {
    const quota = await chargeAiEstimate(quotaClient, quotaUser);
    if (!quota.ok) return { ok: false, error_sr: quota.error_sr };
  }

  try {
    const data = await analyzePrizmaMeal(read.images, read.variant, read.reference);
    // No food on the photo -> stop before the dial/questions and say so, rather
    // than walking the user through describing a portion of nothing.
    if (data.nemaHrane) {
      return { ok: false, error_sr: NO_FOOD_ERROR_SR };
    }
    return { ok: true, data };
  } catch (err) {
    console.error("[najtacnije] analyze failed:", err);
    return {
      ok: false,
      error_sr: aiErrorSr(err, "Nismo uspeli da analiziramo slike. Pokušaj ponovo."),
    };
  }
}

/**
 * Prizma step 2: the same photos + the user's answers (compiled text and/or a
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
    const data = await finalizePrizmaMeal(
      read.images,
      answers || null,
      audioPart,
      read.variant,
      read.reference,
      read.portion
    );
    return { ok: true, data };
  } catch (err) {
    console.error("[najtacnije] finalize failed:", err);
    return {
      ok: false,
      error_sr: aiErrorSr(err, "Nismo uspeli da procenimo obrok. Pokušaj ponovo."),
    };
  }
}
