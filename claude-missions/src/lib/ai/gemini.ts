import {
  LABEL_PROMPT,
  LABEL_RESPONSE_SCHEMA,
  labelEstimateSchema,
  type LabelEstimate,
} from "@/lib/ai/label-estimate";
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

// Server-only Gemini client. We call the REST `generateContent` endpoint
// directly (no SDK dependency -> no version churn, predictable on first
// deploy). The model id comes from `GEMINI_MODEL` (env), so switching between
// e.g. gemini-3-flash and gemini-3.5-flash to compare accuracy is a config
// change, never a code change. NEVER import this from a client component --
// it reads the secret `GEMINI_API_KEY`.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.5-flash";
// Meal-photo recognition needs the stronger reasoning-first Pro model -- Flash
// misses fine ingredients that the Gemini app (which runs Pro) picks up.
// Overridable via env so switching Pro versions stays a config change.
const MEAL_MODEL = "gemini-3.1-pro-preview";
// Voice logging is mostly transcription + light estimation, so the fast/cheap
// Flash default is enough and keeps the record->result wait short. Overridable
// via `GEMINI_VOICE_MODEL` if we want to trade latency for estimation quality.
const VOICE_MODEL = "gemini-3.5-flash";
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
