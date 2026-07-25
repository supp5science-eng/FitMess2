import {
  LABEL_PROMPT,
  LABEL_RESPONSE_SCHEMA,
  labelEstimateSchema,
  type LabelEstimate,
} from "@/lib/ai/label-estimate";
import {
  COMBINED_LABEL_PROMPT,
  COMBINED_PROMPT,
  COMBINED_RESPONSE_SCHEMA,
  combinedMealSchema,
  type CombinedMealEstimate,
} from "@/lib/ai/combined-estimate";
import {
  MEAL_PROMPT,
  MEAL_RESPONSE_SCHEMA,
  mealEstimateSchema,
  type MealEstimate,
} from "@/lib/ai/meal-estimate";
import {
  VOICE_PROMPT,
  VOICE_RESPONSE_SCHEMA,
  voiceMealSchema,
  type VoiceMealEstimate,
} from "@/lib/ai/voice-estimate";
import {
  describeShots,
  PRIZMA_ANALYZE_LABEL_PROMPT,
  PRIZMA_ANALYZE_PROMPT,
  PRIZMA_ANALYZE_RESPONSE_SCHEMA,
  PRIZMA_FINALIZE_LABEL_PROMPT,
  PRIZMA_FINALIZE_PROMPT,
  PRIZMA_FINALIZE_RESPONSE_SCHEMA,
  parsePrizmaAnalysis,
  type PrizmaAnalysis,
  type PrizmaVariant,
  type ReferenceObject,
} from "@/lib/ai/prizma";
import { reconcileEstimate } from "@/lib/ai/reconcile";

// Server-only Gemini client. We call the REST `generateContent` endpoint
// directly (no SDK dependency -> no version churn, predictable on first
// deploy). The model id comes from `GEMINI_MODEL` (env), so switching between
// e.g. gemini-3-flash and gemini-3.5-flash to compare accuracy is a config
// change, never a code change. NEVER import this from a client component --
// it reads the secret `GEMINI_API_KEY`.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// gemini-3.6-flash is the current, reliable Flash: newest generation (better
// vision than the older 3.5-flash), fast (~3s), and -- crucially -- it has real
// quota on our plan. We measured 3.5-flash timing out and the Pro-preview model
// (see MEAL_MODEL note) returning hard 429s, so both are avoided as defaults.
const DEFAULT_MODEL = "gemini-3.6-flash";
// Meal-photo recognition ("Slikaj obrok"). On Flash, not Gemini 3 Pro: Pro
// (incl. `gemini-3.1-pro-preview`) has a FREE-TIER quota of 0, so every call on
// our current (unbilled) key returns HTTP 429 -- which is exactly what made the
// feature "work poorly." Flash 3.6 has real free-tier quota and good vision.
// Overridable via `GEMINI_MEAL_MODEL` (e.g. to a Pro model once billing is on).
const MEAL_MODEL = "gemini-3.6-flash";
// Voice logging ("Reci obrok"). Same reasoning as MEAL_MODEL -- Flash, since Pro
// is 429-blocked on the free tier. Overridable via `GEMINI_VOICE_MODEL`.
const VOICE_MODEL = "gemini-3.6-flash";
const REQUEST_TIMEOUT_MS = 45_000;

export class GeminiError extends Error {}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * Low-level transport: POSTs a fully-formed request body to the model's
 * `generateContent` endpoint and returns the concatenated text of the first
 * candidate. Owns the API key, model selection (`GEMINI_MODEL` env), timeout,
 * and the HTTP/empty-body error handling shared by every caller below (the
 * vision estimators AND the Lofi chat). Throws `GeminiError` on any failure.
 */
async function postGenerateContent(
  body: unknown,
  modelOverride?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError("GEMINI_API_KEY is not set");

  const model = modelOverride || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `${API_BASE}/${model}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new GeminiError(
      err instanceof Error && err.name === "AbortError"
        ? "Gemini request timed out"
        : `Gemini request failed: ${String(err)}`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GeminiError(`Gemini ${response.status}: ${detail.slice(0, 300)}`);
  }

  const json = (await response.json()) as GeminiResponse;
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) throw new GeminiError("Gemini returned an empty response");
  return text;
}

/**
 * Sends one image + prompt to Gemini and returns the raw JSON text the model
 * produced (constrained to `responseSchema`). Shared by every vision estimator
 * below.
 */
async function generateJsonFromImage(
  prompt: string,
  responseSchema: unknown,
  base64Image: string,
  mimeType: string,
  modelOverride?: string
): Promise<string> {
  return postGenerateContent(
    {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Image } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.2,
      },
    },
    modelOverride
  );
}

/**
 * Sends one audio clip + prompt to Gemini and returns the raw JSON text
 * (constrained to `responseSchema`). Mirror of `generateJsonFromImage` for the
 * voice flow -- the only difference is the inline part carries audio bytes.
 */
async function generateJsonFromAudio(
  prompt: string,
  responseSchema: unknown,
  base64Audio: string,
  mimeType: string,
  modelOverride?: string
): Promise<string> {
  return postGenerateContent(
    {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Audio } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.2,
      },
    },
    modelOverride
  );
}

/** A single turn in a Lofi conversation, in the shape the chat endpoint wants. */
export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

/**
 * Multi-turn text chat (M6 / Lofi agent). Unlike the vision estimators this is
 * free-form prose, not JSON: a `systemPrompt` (Lofi's persona + the caller's
 * live daily-budget context) plus the running conversation. Warmer temperature
 * than extraction, and a capped output so replies stay short and snappy.
 * NEVER import this from a client component -- it reads `GEMINI_API_KEY`.
 */
export async function generateChatText(
  systemPrompt: string,
  turns: ChatTurn[]
): Promise<string> {
  return postGenerateContent({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: turns.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    generationConfig: {
      temperature: 0.65,
      maxOutputTokens: 900,
      topP: 0.95,
    },
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError("Gemini returned non-JSON output");
  }
}

/** Food photo -> validated meal estimate for the depicted portion. */
export async function estimateMealFromImage(
  base64Image: string,
  mimeType: string
): Promise<MealEstimate> {
  const text = await generateJsonFromImage(
    MEAL_PROMPT,
    MEAL_RESPONSE_SCHEMA,
    base64Image,
    mimeType,
    process.env.GEMINI_MEAL_MODEL || MEAL_MODEL
  );
  const parsed = mealEstimateSchema.safeParse(parseJson(text));
  if (!parsed.success) {
    throw new GeminiError("Gemini output did not match the expected shape");
  }
  return parsed.data;
}

/** Prizma input variant: a plate of food ("obrok") or a nutrition label
 * ("deklaracija") -- selects which fusion prompt Gemini gets. */
export type CombinedVariant = "obrok" | "deklaracija";

/**
 * "Prizma": photo + the user's spoken and/or typed description (with a rough
 * portion) -> validated estimate, fused in ONE multimodal request. `variant`
 * picks the prompt: "obrok" reads a plate + the eaten amount; "deklaracija"
 * reads a nutrition label per-100g + the total/eaten amount the user states.
 * `audio` and `note` are each optional but the caller guarantees at least one is
 * present (the description is required for this flow). Uses the meal model.
 */
export async function estimateMealFromImageAndVoice(
  image: { base64: string; mimeType: string },
  audio: { base64: string; mimeType: string } | null,
  note: string | null,
  variant: CombinedVariant = "obrok"
): Promise<CombinedMealEstimate> {
  const prompt =
    variant === "deklaracija" ? COMBINED_LABEL_PROMPT : COMBINED_PROMPT;
  const parts: Array<Record<string, unknown>> = [
    { text: prompt },
    { inline_data: { mime_type: image.mimeType, data: image.base64 } },
  ];
  if (audio) {
    parts.push({ inline_data: { mime_type: audio.mimeType, data: audio.base64 } });
  }
  if (note && note.trim()) {
    parts.push({ text: `Korisnikov opis (tekst): ${note.trim()}` });
  }

  const text = await postGenerateContent(
    {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: COMBINED_RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    },
    process.env.GEMINI_MEAL_MODEL || MEAL_MODEL
  );
  const parsed = combinedMealSchema.safeParse(parseJson(text));
  if (!parsed.success) {
    throw new GeminiError("Gemini output did not match the expected shape");
  }
  return parsed.data;
}

/** An inline image part for the multi-image Prizma calls. */
export interface ImagePart {
  base64: string;
  mimeType: string;
}

function imageInlineParts(images: ImagePart[]): Array<Record<string, unknown>> {
  return images.map((img) => ({
    inline_data: { mime_type: img.mimeType, data: img.base64 },
  }));
}

/**
 * Prizma step 1 (ANALYZE): 1–5 photos of the same meal (or nutrition label) ->
 * EITHER clarifying questions (each with tappable options) OR, when already
 * confident, a final estimate. Defensive parse (`parsePrizmaAnalysis`) never
 * throws — a malformed response degrades to the "how much did you eat?"
 * question so the flow can't dead-end. Uses the meal model.
 */
export async function analyzePrizmaMeal(
  images: ImagePart[],
  variant: PrizmaVariant = "obrok",
  reference: ReferenceObject = "nista"
): Promise<PrizmaAnalysis> {
  const isLabel = variant === "deklaracija";
  const parts: Array<Record<string, unknown>> = [
    { text: isLabel ? PRIZMA_ANALYZE_LABEL_PROMPT : PRIZMA_ANALYZE_PROMPT },
  ];
  // Angles and a scale anchor only mean something for a plate of food; the
  // label flow is just reading a table, so it gets neither.
  if (!isLabel) {
    parts.push({ text: describeShots(images.length, reference) });
  }
  parts.push(...imageInlineParts(images));

  const text = await postGenerateContent(
    {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: PRIZMA_ANALYZE_RESPONSE_SCHEMA,
        // Measurement, not writing -- no reason to sample.
        temperature: 0,
      },
    },
    process.env.GEMINI_MEAL_MODEL || MEAL_MODEL
  );
  return parsePrizmaAnalysis(parseJson(text), variant);
}

/**
 * Prizma step 2 (FINALIZE): the same photos + the user's answers (as text
 * and/or a spoken clip) -> a validated estimate in the SHARED meal schema, so
 * the confirm/edit/save screen stays common. `answersText` is the compiled
 * Q&A; `audio` is an optional single recording that answers everything by
 * voice. Uses the meal model.
 */
export async function finalizePrizmaMeal(
  images: ImagePart[],
  answersText: string | null,
  audio: { base64: string; mimeType: string } | null,
  variant: PrizmaVariant = "obrok",
  reference: ReferenceObject = "nista"
): Promise<CombinedMealEstimate> {
  const isLabel = variant === "deklaracija";
  const parts: Array<Record<string, unknown>> = [
    { text: isLabel ? PRIZMA_FINALIZE_LABEL_PROMPT : PRIZMA_FINALIZE_PROMPT },
  ];
  if (!isLabel) {
    parts.push({ text: describeShots(images.length, reference) });
  }
  parts.push(...imageInlineParts(images));

  if (answersText && answersText.trim()) {
    parts.push({ text: `Korisnikovi odgovori:\n${answersText.trim()}` });
  }
  if (audio) {
    parts.push({ inline_data: { mime_type: audio.mimeType, data: audio.base64 } });
  }

  const text = await postGenerateContent(
    {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        // Prizma-only schema: forces `komponente` BEFORE the totals, so the
        // model itemises and sums instead of leaping to a round number.
        responseSchema: PRIZMA_FINALIZE_RESPONSE_SCHEMA,
        temperature: 0,
      },
    },
    process.env.GEMINI_MEAL_MODEL || MEAL_MODEL
  );
  const parsed = combinedMealSchema.safeParse(parseJson(text));
  if (!parsed.success) {
    throw new GeminiError("Gemini output did not match the expected shape");
  }

  // Verify the model's arithmetic rather than trusting it: the breakdown must
  // add up to the total, and the macros must add up to the calories.
  const { estimate, corrections } = reconcileEstimate(parsed.data);
  if (corrections.length > 0) {
    console.warn("[prizma] reconciled estimate:", corrections.join("; "));
  }
  return estimate;
}

/** Spoken meal description/dictation -> validated meal estimate. */
export async function estimateMealFromAudio(
  base64Audio: string,
  mimeType: string
): Promise<VoiceMealEstimate> {
  const text = await generateJsonFromAudio(
    VOICE_PROMPT,
    VOICE_RESPONSE_SCHEMA,
    base64Audio,
    mimeType,
    process.env.GEMINI_VOICE_MODEL || VOICE_MODEL
  );
  const parsed = voiceMealSchema.safeParse(parseJson(text));
  if (!parsed.success) {
    throw new GeminiError("Gemini output did not match the expected shape");
  }
  return parsed.data;
}

/** Nutrition-label photo -> validated per-100g product values. */
export async function estimateLabelFromImage(
  base64Image: string,
  mimeType: string
): Promise<LabelEstimate> {
  const text = await generateJsonFromImage(
    LABEL_PROMPT,
    LABEL_RESPONSE_SCHEMA,
    base64Image,
    mimeType
  );
  const parsed = labelEstimateSchema.safeParse(parseJson(text));
  if (!parsed.success) {
    throw new GeminiError("Gemini output did not match the expected shape");
  }
  return parsed.data;
}
