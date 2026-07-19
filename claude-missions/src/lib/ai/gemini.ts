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
 * Sends a food photo (base64 + mime type) to Gemini and returns a validated
 * meal estimate for the depicted portion. Throws `GeminiError` on any
 * transport/parse failure -- the caller (a server action) maps that to a
 * friendly Serbian message.
 */
export async function estimateMealFromImage(
  base64Image: string,
  mimeType: string
): Promise<MealEstimate> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError("GEMINI_API_KEY is not set");

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `${API_BASE}/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: MEAL_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Image } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: MEAL_RESPONSE_SCHEMA,
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

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new GeminiError("Gemini returned non-JSON output");
  }

  const parsed = mealEstimateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new GeminiError("Gemini output did not match the expected shape");
  }
  return parsed.data;
}
