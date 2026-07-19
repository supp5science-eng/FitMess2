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

// Server-only Gemini client. We call the REST `generateContent` endpoint
// directly (no SDK dependency -> no version churn, predictable on first
// deploy). The model id comes from `GEMINI_MODEL` (env), so switching between
// e.g. gemini-3-flash and gemini-3.5-flash to compare accuracy is a config
// change, never a code change. NEVER import this from a client component --
// it reads the secret `GEMINI_API_KEY`.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3-flash";
const REQUEST_TIMEOUT_MS = 45_000;

export class GeminiError extends Error {}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * Sends one image + prompt to Gemini and returns the raw JSON text the model
 * produced (constrained to `responseSchema`). Throws `GeminiError` on any
 * transport/HTTP/empty-body failure. Shared by every vision estimator below.
 */
async function generateJsonFromImage(
  prompt: string,
  responseSchema: unknown,
  base64Image: string,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError("GEMINI_API_KEY is not set");

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `${API_BASE}/${model}:generateContent?key=${apiKey}`;

  const body = {
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
  };

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
    mimeType
  );
  const parsed = mealEstimateSchema.safeParse(parseJson(text));
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
