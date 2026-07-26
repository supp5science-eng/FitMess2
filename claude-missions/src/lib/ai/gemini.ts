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
  GRIC_PROMPT,
  GRIC_RESPONSE_SCHEMA,
  gricEstimateSchema,
  type GricEstimate,
} from "@/lib/ai/gric-estimate";
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
  describePortion,
  type PortionGeometry,
  type PortionUnit,
  type PrepMethod,
} from "@/lib/ai/portion";
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

/**
 * Any failure talking to Gemini. Carries the HTTP `status` when there was one,
 * so callers can tell "we are rate-limited / out of quota" (429) apart from a
 * genuinely bad request -- the difference between "probaj za minut" and
 * "nismo te razumeli", which the user experiences as two different apps.
 */
export class GeminiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/** True when the failure was a rate limit / exhausted quota (HTTP 429). */
export function isQuotaError(err: unknown): boolean {
  return err instanceof GeminiError && err.status === 429;
}

/**
 * The one Serbian sentence to show when the AI could not be reached because of
 * quota. Deliberately does NOT invite an immediate retry: on 429 a retry is
 * both useless and the thing that burns what little quota is left.
 */
export const AI_BUSY_ERROR_SR =
  "AI trenutno ne stiže da obradi zahteve. Sačekaj minut pa probaj ponovo.";

/**
 * The Serbian message to show for a failed AI call: the quota sentence when the
 * cause was a rate limit, otherwise the flow's own copy.
 *
 * Without this every quota failure surfaced as "Nismo uspeli da razumemo
 * snimak" -- blaming the user's microphone for our billing, and inviting a
 * retry that could only fail again and spend more of the quota that ran out.
 */
export function aiErrorSr(err: unknown, fallback: string): string {
  return isQuotaError(err) ? AI_BUSY_ERROR_SR : fallback;
}

/**
 * How hard the model is allowed to think before answering.
 *
 * Gemini 3.x thinks by default and bills those thoughts as OUTPUT tokens -- the
 * expensive side -- so on a task that is really just READING (a spoken sentence,
 * a nutrition table) the thinking can cost several times the answer itself and
 * add seconds of latency for no gain. Measured on this project: `low` produced
 * the same result with zero thought tokens, 4x faster.
 *
 * So: `low` for extraction, default (omitted) wherever the model genuinely has
 * to reason -- estimating a portion from a photo, or adding up components.
 *
 * NOTE: the older `thinkingBudget: 0` is NOT a substitute; 3.6-flash rejects it
 * with HTTP 400.
 */
type ThinkingLevel = "low";

function thinkingConfig(level?: ThinkingLevel) {
  return level ? { thinkingConfig: { thinkingLevel: level } } : {};
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  /** Token accounting Google returns on every call. Logged, never shown. */
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
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
    throw new GeminiError(
      `Gemini ${response.status}: ${detail.slice(0, 300)}`,
      response.status
    );
  }

  const json = (await response.json()) as GeminiResponse;

  // What the call actually cost, straight from Google's own accounting. This
  // is the only way to know the real price per meal -- token counts estimated
  // by hand are guesses, and `thoughts` in particular (billed as OUTPUT, the
  // expensive side) can quietly dwarf the answer itself. Grep `[gemini] usage`
  // in the logs to price a feature.
  const usage = json.usageMetadata;
  if (usage) {
    console.info(
      "[gemini] usage:",
      JSON.stringify({
        model,
        in: usage.promptTokenCount ?? 0,
        out: usage.candidatesTokenCount ?? 0,
        thoughts: usage.thoughtsTokenCount ?? 0,
        total: usage.totalTokenCount ?? 0,
      })
    );
  }

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
  modelOverride?: string,
  thinking?: ThinkingLevel
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
        ...thinkingConfig(thinking),
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
  modelOverride?: string,
  thinking?: ThinkingLevel
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
        ...thinkingConfig(thinking),
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
 * What the user told us about the portion: the shape they described, the mass
 * anchor the model gave us for that food, and how it was cooked. Null on the
 * ANALYZE call (which runs before they have answered) and on the label flow.
 */
export type UserPortion = {
  geometry: PortionGeometry;
  unit: PortionUnit;
  prep: PrepMethod | null;
} | null;

/**
 * Prizma step 1 (ANALYZE): the top-down photo -> what the food IS, which shape
 * of dial fits it, what one unit of it weighs, and the few things the model
 * still cannot tell. It deliberately does NOT estimate: the portion arrives
 * from the user afterwards, and a model that has already committed to a mass
 * argues with them instead of using them. Defensive parse never throws.
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
  // Viewpoint and a scale anchor only mean something for a plate of food; the
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
        // Deciding WHAT to ask is a judgement call, so this step samples a
        // little (2026-07-25). At 0 it was fully deterministic: two similar
        // plates produced word-for-word the same three questions, which is a
        // large part of why the questions read as canned. The FINALIZE call
        // below stays at 0 -- that one is arithmetic, and must not wander.
        temperature: 0.4,
      },
    },
    process.env.GEMINI_MEAL_MODEL || MEAL_MODEL
  );
  const analysis = parsePrizmaAnalysis(parseJson(text), variant);

  // Server-side trace, never shown to the user. "The questions feel generic"
  // has several very different causes (a template answer, a malformed one, or
  // an honestly clear plate) and they are indistinguishable from the UI -- this
  // line is how we tell them apart in the logs. The vessel call is logged too:
  // a soup classed as "ravan" hands the user the wrong dial entirely.
  console.info(
    "[prizma] analyze:",
    JSON.stringify({
      naziv: analysis.naziv,
      posuda: analysis.posuda,
      jedinica: `${analysis.jedinica.naziv}=${analysis.jedinica.grami}g`,
      ugao: analysis.ugao.treba,
      source: analysis.source,
      vidim: analysis.vidim.map((i) => `${i.stavka}:${i.sigurnost}`),
      pitanja: analysis.pitanja.map((q) => ({
        stavka: q.stavka,
        pitanje: q.pitanje,
        kcal: q.uticaj_kcal,
      })),
    })
  );

  return analysis;
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
  reference: ReferenceObject = "nista",
  portion: UserPortion = null
): Promise<CombinedMealEstimate> {
  const isLabel = variant === "deklaracija";
  const parts: Array<Record<string, unknown>> = [
    { text: isLabel ? PRIZMA_FINALIZE_LABEL_PROMPT : PRIZMA_FINALIZE_PROMPT },
  ];
  if (!isLabel) {
    parts.push({ text: describeShots(images.length, reference) });
    const said = describePortion(
      portion?.geometry ?? null,
      portion?.unit ?? null,
      portion?.prep ?? null
    );
    if (said) parts.push({ text: said });
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
    process.env.GEMINI_VOICE_MODEL || VOICE_MODEL,
    // Listening to a sentence and writing down what it says is extraction, not
    // reasoning -- thinking here only costs money and seconds.
    "low"
  );
  const parsed = voiceMealSchema.safeParse(parseJson(text));
  if (!parsed.success) {
    throw new GeminiError("Gemini output did not match the expected shape");
  }
  return parsed.data;
}

/**
 * "Gric" — one spoken clip -> a LIST of small items (see `gric-estimate.ts`).
 * Separate from `estimateMealFromAudio` because the shapes differ: that one
 * collapses a recording into a single meal, this one deliberately keeps the
 * items apart so three snacks become three log rows.
 */
export async function estimateGricFromAudio(
  base64Audio: string,
  mimeType: string
): Promise<GricEstimate> {
  const text = await generateJsonFromAudio(
    GRIC_PROMPT,
    GRIC_RESPONSE_SCHEMA,
    base64Audio,
    mimeType,
    process.env.GEMINI_VOICE_MODEL || VOICE_MODEL,
    // Same as the voice flow: splitting a sentence into items is reading.
    // Gric is also the one path where speed IS the feature.
    "low"
  );
  const parsed = gricEstimateSchema.safeParse(parseJson(text));
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
    mimeType,
    undefined,
    // Reading a printed table. The numbers are on the picture; there is nothing
    // to reason about. (`estimateMealFromImage` above deliberately keeps its
    // thinking -- judging a portion from a photo is the opposite case.)
    "low"
  );
  const parsed = labelEstimateSchema.safeParse(parseJson(text));
  if (!parsed.success) {
    throw new GeminiError("Gemini output did not match the expected shape");
  }
  return parsed.data;
}
