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
  GRIC_TEXT_PROMPT,
  parseGricResponse,
  type GricEstimate,
} from "@/lib/ai/gric-estimate";
import {
  MEAL_PHOTO_RESPONSE_SCHEMA,
  MEAL_PROMPT,
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
import {
  buildClonePrompt,
  CLONE_PORTRAIT_PROMPT,
} from "@/lib/avatar/clone-prompt";

// Server-only Gemini client. We call the REST `generateContent` endpoint
// directly (no SDK dependency -> no version churn, predictable on first
// deploy). The model id comes from `GEMINI_MODEL` (env), so switching between
// e.g. gemini-3-flash and gemini-3.5-flash to compare accuracy is a config
// change, never a code change. NEVER import this from a client component --
// it reads the secret `GEMINI_API_KEY`.
//
// EVERY user photo and voice clip in FitMess reaches Google through this one
// file, and only from the server: the phone posts its bytes to our own server
// action / route handler, which forwards them inline (base64, in the request
// body) to `generativelanguage.googleapis.com`. Nothing is uploaded to the
// Files API, nothing is given a Google-side URL, and the client never holds
// the key. The photo's only resting place is our own database, and only when
// the user saves the meal (`public.meal_photos`, pruned after ~1 day by
// pg_cron -- see `supabase/migrations/0014_meal_photos.sql`); audio is never
// stored anywhere at all.
//
// BILLING IS ENABLED on this key (confirmed 2026-08-13). That is not a cost
// detail, it is a promise made to users: on the paid tier Google does not use
// submitted content to improve its models, which is exactly what
// `legal.privacy.share.google` tells them in the privacy policy and what the
// stores' data-safety forms were filled in with. If billing is ever turned
// off, the free tier's terms apply instead and that sentence becomes false --
// so the policy has to change in the same commit.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// gemini-3.6-flash is the current, reliable Flash: newest generation (better
// vision than the older 3.5-flash), fast (~3s), and -- crucially -- it has real
// quota on our plan. We measured 3.5-flash timing out and the Pro-preview model
// (see MEAL_MODEL note) returning hard 429s, so both are avoided as defaults.
const DEFAULT_MODEL = "gemini-3.6-flash";
// Meal-photo recognition ("Slikaj obrok"). On Flash, not Gemini 3 Pro. That
// choice was forced while the key was still unbilled: Pro (incl.
// `gemini-3.1-pro-preview`) has a free-tier quota of 0, so every call returned
// HTTP 429 -- which is exactly what made the feature "work poorly." Billing has
// since been enabled, so Pro is reachable again and this is now a
// cost/latency judgement rather than a hard block; Flash 3.6 is fast and its
// vision is good enough. Try Pro by setting `GEMINI_MEAL_MODEL` -- no code
// change needed, and worth measuring before committing to it.
const MEAL_MODEL = "gemini-3.6-flash";
// Voice logging ("Reci obrok"). Same reasoning as MEAL_MODEL -- Flash, and for
// this flow speed is the feature. Overridable via `GEMINI_VOICE_MODEL`.
const VOICE_MODEL = "gemini-3.6-flash";
// Avatar klon. NANO BANANA PRO, and that is a product requirement, not a
// default to tune: it is the model whose likeness and instruction-following the
// whole klon feature was designed around. The cheaper image models drift off
// the template -- different framing, different line weight, a background that
// wanders -- and the template holding still for every user IS the feature (see
// `@/lib/avatar/clone-prompt`).
//
// This is also the ONLY place in the app that asks a model to DRAW rather than
// to read; every other constant above is a vision/text model and cannot return
// pixels at all.
//
// `GEMINI_IMAGE_MODEL` exists to CORRECT this id (Google renames preview models
// without warning), never to downgrade it to a Flash image model. If a klon
// suddenly looks nothing like the others, check that variable first.
const IMAGE_MODEL = "gemini-3-pro-image-preview";
const REQUEST_TIMEOUT_MS = 45_000;
// Drawing a person from twenty photos is a different order of work than reading
// one plate of food: measured well past the 45s above, and a timeout here costs
// the user the whole upload.
const IMAGE_TIMEOUT_MS = 180_000;

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
 * Shown when the model looked at the photo and found no food at all (a selfie,
 * a meme, an empty table). Deliberately calm and blame-free -- the zero-shame
 * tone -- and it points at the fix rather than scolding the user for the shot.
 */
export const NO_FOOD_ERROR_SR =
  "Ne vidim hranu na ovoj slici. Uslikaj svoj obrok (tanjir, piće, grickalicu…) pa ćemo probati ponovo.";

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
  candidates?: {
    content?: {
      parts?: {
        text?: string;
        /**
         * True on a THOUGHT part -- the model's reasoning summary, not its
         * answer. Gemini 3.x returns these inline, in the same `parts` array,
         * and they must never be concatenated into the reply (see
         * `postGenerateContent`).
         */
        thought?: boolean;
        /**
         * Image bytes, on a response from an image model. Google returns these
         * in the SAME `parts` array as text -- an image answer is usually a
         * short sentence part PLUS this one, which is why the image path below
         * searches the array instead of reading `parts[0]`.
         */
        inlineData?: { mimeType?: string; data?: string };
      }[];
    };
  }[];
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
/**
 * One POST to a model endpoint, with the API key presented BOTH ways.
 *
 * Classic AI Studio keys (`AIza…`) travel as the `?key=` query parameter, which
 * is what this file has always used. Newer credentials (`AQ.…`) are rejected
 * that way and are only accepted as an `x-goog-api-key` header -- and the
 * rejection is an indistinguishable `400 API_KEY_INVALID`, i.e. it looks
 * exactly like a bad key rather than a badly-presented one. That cost an
 * afternoon of chasing a key that was fine.
 *
 * So: try the query form first (unchanged behaviour for every key that already
 * works -- this must not disturb the meal/label/voice flows that are live), and
 * retry once with the header ONLY when the answer was specifically "your key is
 * invalid". Any other failure is returned as-is; a retry would just spend the
 * quota twice.
 */
async function postToModel(
  model: string,
  apiKey: string,
  body: unknown,
  timeoutMs: number
): Promise<Response> {
  const url = `${API_BASE}/${model}:generateContent`;

  async function send(useHeader: boolean): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(
        useHeader ? url : `${url}?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(useHeader ? { "x-goog-api-key": apiKey } : {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  const first = await send(false);
  if (first.status !== 400) return first;

  // Peek at the body to tell "key presented wrong" apart from "request wrong".
  // `clone()` so the caller still gets an unread body if we hand this one back.
  const detail = await first
    .clone()
    .text()
    .catch(() => "");
  if (!detail.includes("API_KEY_INVALID")) return first;

  console.info("[gemini] key rejected as ?key=, retrying as x-goog-api-key");
  return send(true);
}

async function postGenerateContent(
  body: unknown,
  modelOverride?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError("GEMINI_API_KEY is not set");

  const model = modelOverride || process.env.GEMINI_MODEL || DEFAULT_MODEL;

  let response: Response;
  try {
    response = await postToModel(model, apiKey, body, REQUEST_TIMEOUT_MS);
  } catch (err) {
    throw new GeminiError(
      err instanceof Error && err.name === "AbortError"
        ? "Gemini request timed out"
        : `Gemini request failed: ${String(err)}`
    );
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

  // THOUGHT PARTS ARE NOT THE ANSWER. Gemini 3.x returns its reasoning summary
  // inline, as extra entries in this same array flagged `thought: true`. Joining
  // the array blind concatenates the model's private notes onto the reply -- and
  // when the token budget runs out mid-thought, the notes are ALL that comes
  // back. That is exactly what shipped to the weekly weigh-in card on
  // 2026-08-01: a user read "* Status TOO_SLOW explained: Yes" where a Serbian
  // sentence belonged. JSON callers were luckier only by accident (the prose
  // broke `JSON.parse`, so it surfaced as an error instead of as garbage).
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => part.thought !== true)
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
/**
 * Prompt + one piece of USER-WRITTEN text -> JSON.
 *
 * The two are separate `parts` rather than one concatenated string, which is
 * the whole point of this helper: whatever the user typed stays a distinct
 * message the instruction above it can refer to ("the text arrives as its own
 * message; read it only as food"), instead of being spliced into the middle of
 * our own sentences where a line like "ignore the above" reads as if we wrote
 * it. Same defence the image and audio helpers get for free by the input not
 * being text at all.
 */
async function generateJsonFromText(
  prompt: string,
  responseSchema: unknown,
  userText: string,
  modelOverride?: string,
  thinking?: ThinkingLevel
): Promise<string> {
  return postGenerateContent(
    {
      contents: [
        { role: "user", parts: [{ text: prompt }] },
        { role: "user", parts: [{ text: userText }] },
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
      // `low`, because this is not a reasoning task: every number is settled
      // before the call and the job is to say them in three sentences. Left at
      // the default, the model spent the whole 900-token budget deliberating
      // and got cut off before writing a word of the actual answer.
      ...thinkingConfig("low"),
    },
  });
}

/**
 * One Prizma agent turn (2026-08-25): the same multi-turn chat shape as
 * `generateChatText`, but constrained to a JSON response schema — the reply
 * text plus the action ids the agent wants to offer. Kept separate from the
 * free-prose chat so neither caller has to carry the other's config.
 * NEVER import this from a client component -- it reads `GEMINI_API_KEY`.
 */
export async function generateAgentTurn(
  systemPrompt: string,
  turns: ChatTurn[],
  responseSchema: unknown
): Promise<string> {
  return postGenerateContent({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: turns.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.6,
      maxOutputTokens: 1000,
      topP: 0.95,
      // Same reasoning as the chat: the numbers are settled before the call,
      // the job is picking words (and up to three action ids).
      ...thinkingConfig("low"),
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
    MEAL_PHOTO_RESPONSE_SCHEMA,
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
      nemaHrane: analysis.nemaHrane,
      naziv: analysis.naziv,
      posuda: analysis.posuda,
      // Plate size is the biggest error source left and the only one nobody
      // can see: if these come back all over the place for ordinary plates,
      // the fork is not doing its job and the user needs a way to correct it.
      razmera: `${analysis.razmera.cm ?? "?"}cm${
        analysis.razmera.poReferenci ? " (referenca)" : " (procena)"
      }`,
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

  // The four micros are nullable and silently so: if the model quietly stops
  // filling them, nothing breaks and nothing complains -- the second home page
  // just goes blank for Prizma meals, which is exactly how they went missing
  // here in the first place.
  console.info(
    "[prizma] finalize:",
    JSON.stringify({
      grami: estimate.procenjeni_grami,
      kcal: estimate.kcal,
      mikro: {
        vlakna: estimate.vlakna_g,
        secer: estimate.secer_g,
        natrijum: estimate.natrijum_mg,
        zasicene: estimate.zasicene_g,
      },
    })
  );

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
 * "Gric" — one spoken clip -> small items GROUPED BY EATING OCCASION (see
 * `gric-estimate.ts`). Separate from `estimateMealFromAudio` because the shapes
 * differ: that one collapses a whole recording into a single meal, this one
 * keeps the occasions apart — "jaja, slaninu i hleb" is one plate of three
 * parts, "čokolada pa sladoled" is two separate entries.
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
  const parsed = parseGricResponse(parseJson(text));
  if (!parsed) {
    throw new GeminiError("Gemini output did not match the expected shape");
  }
  return parsed;
}

/**
 * "Gric", typed: one written sentence -> the same occasion-grouped items the
 * spoken clip produces.
 *
 * Shares `GRIC_RESPONSE_SCHEMA` and `parseGricResponse` with the audio path on
 * purpose — the two mouths of Gric must produce the same entry for the same
 * food, and that is only true while they share the schema, the parse and (via
 * `GRIC_RULES`) the rules. The only difference here is that there is no clip to
 * transcribe, so the model has strictly less to do: same "low" thinking, and in
 * practice this is the faster of the two.
 */
/** What Prizma's ear is told: write down EXACTLY what was said, nothing else.
 * The agent reasons over the transcript later — a transcriber that "helps" by
 * cleaning up or answering is a broken microphone. */
const TRANSCRIBE_PROMPT = `Zapiši TAČNO šta je izgovoreno na snimku, od reči do reči, na jeziku i pismu kojim je izgovoreno (očekuj srpski). Ne odgovaraj na pitanja sa snimka, ne prepričavaj, ne dodaj interpunkciju koja menja smisao. Ako se ništa razumljivo ne čuje, vrati prazan tekst.`;

const TRANSCRIBE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: { text: { type: "STRING" } },
  required: ["text"],
} as const;

/**
 * Prizma's ear (2026-08-26): one spoken clip -> a verbatim transcript. The
 * same audio-in-the-model posture as Gric (no separate STT service), but the
 * output is the user's own sentence, because the AGENT decides what to do
 * with it — this function must not.
 * NEVER import this from a client component -- it reads `GEMINI_API_KEY`.
 */
export async function transcribeSpeech(
  base64Audio: string,
  mimeType: string
): Promise<string> {
  const text = await generateJsonFromAudio(
    TRANSCRIBE_PROMPT,
    TRANSCRIBE_RESPONSE_SCHEMA,
    base64Audio,
    mimeType,
    process.env.GEMINI_VOICE_MODEL || VOICE_MODEL,
    // Writing down a sentence is extraction — same "low" as the other ears.
    "low"
  );
  const parsed = parseJson(text) as { text?: unknown };
  if (typeof parsed?.text !== "string") {
    throw new GeminiError("Gemini output did not match the expected shape");
  }
  return parsed.text.trim();
}

export async function estimateGricFromText(
  userText: string
): Promise<GricEstimate> {
  const text = await generateJsonFromText(
    GRIC_TEXT_PROMPT,
    GRIC_RESPONSE_SCHEMA,
    userText,
    process.env.GEMINI_VOICE_MODEL || VOICE_MODEL,
    "low"
  );
  const parsed = parseGricResponse(parseJson(text));
  if (!parsed) {
    throw new GeminiError("Gemini output did not match the expected shape");
  }
  return parsed;
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

/* ------------------------------------------------------------------ */
/* Avatar klon -- the one call that asks for a picture back            */
/* ------------------------------------------------------------------ */

/** One image on its way in or out of the model. Base64 without a `data:` prefix. */
export type InlineImage = { base64: string; mimeType: string };

/**
 * Shown when the model answered but drew nothing. In practice this is a safety
 * refusal (a photo it would not render a person from), and the honest thing is
 * to say the photos are the problem without accusing the user of anything.
 */
export const CLONE_NO_IMAGE_ERROR_SR =
  "Nismo uspeli da nacrtamo lik sa ovih slika. Probaj sa drugim slikama — najbolje rade jasne, dobro osvetljene, gde si sam na slici.";

/**
 * The Serbian sentence for a failed klon.
 *
 * Split out from `aiErrorSr` because the klon has a failure mode the logging
 * flows do not: it can fail for reasons that have NOTHING to do with the
 * photos, and the default message ("try different photos") then sends someone
 * to re-shoot twenty pictures against a wall that is ours, not theirs. A model
 * id that does not exist on this key, or a key the API rejects, is a
 * configuration problem and has to say so -- to the user plainly, and to us in
 * the logs precisely.
 */
export function cloneErrorSr(err: unknown): string {
  if (isQuotaError(err)) return AI_BUSY_ERROR_SR;

  if (err instanceof GeminiError) {
    // 404: the configured image model does not exist on this key (a rename, a
    // typo in GEMINI_IMAGE_MODEL, or a preview model that was withdrawn).
    // 400 + API_KEY_INVALID: the key itself was refused, both ways.
    if (err.status === 404 || err.message.includes("API_KEY_INVALID")) {
      return "Crtanje trenutno ne radi kod nas — nije do tvojih slika. Radimo na tome, probaj kasnije.";
    }
  }

  return CLONE_NO_IMAGE_ERROR_SR;
}

/**
 * Image sibling of `postGenerateContent`: same transport, same key, same
 * timeout and error handling, but it digs the PICTURE out of the response
 * instead of the text.
 *
 * It cannot reuse `postGenerateContent`, which joins the text parts and throws
 * on an empty string -- on an image answer the text part is decoration ("Evo
 * lika!") and the payload is `inlineData`. Sharing the function would mean
 * either throwing away the image or teaching every text caller about pixels.
 */
async function postGenerateImage(
  body: unknown,
  modelOverride?: string
): Promise<InlineImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError("GEMINI_API_KEY is not set");

  const model = modelOverride || process.env.GEMINI_IMAGE_MODEL || IMAGE_MODEL;

  let response: Response;
  try {
    // Drawing takes far longer than reading -- the shared 45s ceiling times out
    // on a perfectly healthy image request.
    response = await postToModel(model, apiKey, body, IMAGE_TIMEOUT_MS);
  } catch (err) {
    throw new GeminiError(
      err instanceof Error && err.name === "AbortError"
        ? "Gemini image request timed out"
        : `Gemini image request failed: ${String(err)}`
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GeminiError(
      `Gemini ${response.status}: ${detail.slice(0, 300)}`,
      response.status
    );
  }

  const json = (await response.json()) as GeminiResponse;

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

  const image = (json.candidates?.[0]?.content?.parts ?? []).find(
    (part) => part.thought !== true && part.inlineData?.data
  )?.inlineData;

  if (!image?.data) throw new GeminiError("Gemini returned no image");
  return { base64: image.data, mimeType: image.mimeType || "image/png" };
}

/**
 * The klon: 5-20 photos of one person in, one drawn character out.
 *
 * Every photo goes in as its own inline part, all under a single `user` turn,
 * with the instruction FIRST. Order matters more than it looks: the prompt sets
 * up "these are all the same person" before the model has seen an image, which
 * is what stops it from reading a batch of shots as a group photo of several
 * people and drawing a stranger.
 *
 * Temperature is high-ish on purpose and is NOT a knob to turn down for
 * consistency. Consistency here comes from the template text
 * (`src/lib/avatar/clone-prompt.ts`), which is identical for every user; a low
 * temperature on an image model buys stiff, lifeless drawings without making
 * two users' klons any more alike.
 */
export async function generateAvatarClone(
  photos: readonly InlineImage[],
  prompt: string,
  /**
   * Both optional and both defaulted to the klon's own values, so this stays
   * the same call it has always been for `generateKlon` below.
   *
   * They exist for the OKRET (`src/lib/avatar/okret-prompt.ts`), which needs
   * the same transport with two things different: a full-figure frame is 9:16
   * rather than 3:4 (a standing person in 3:4 spends half the picture on empty
   * air), and a photographic frame wants a lower temperature than a drawing --
   * every degree of freedom here is a degree in which a real face drifts.
   */
  options?: { aspectRatio?: string; temperature?: number }
): Promise<InlineImage> {
  return postGenerateImage({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...photos.map((photo) => ({
            inline_data: { mime_type: photo.mimeType, data: photo.base64 },
          })),
        ],
      },
    ],
    generationConfig: {
      // BOTH modalities, not `["IMAGE"]`: the image models answer with a short
      // sentence alongside the picture and reject a request that forbids it.
      // The sentence is dropped above.
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio: options?.aspectRatio ?? "3:4" },
      temperature: options?.temperature ?? 0.9,
    },
  });
}

/**
 * Step one of the klon: a plain photographic portrait, used as the identity
 * reference for step two. See `CLONE_PORTRAIT_PROMPT` for why two calls beat
 * one -- in short, the stylisation averages a face away unless it is told
 * exactly which face it is looking at.
 *
 * Temperature is LOW here, the opposite of the character call. This request is
 * not asking for a drawing with any life in it; it is asking for a faithful
 * copy of features that already exist, and every degree of freedom it gets is
 * a degree in which the nose can drift.
 */
export async function generateReferencePortrait(
  photos: readonly InlineImage[]
): Promise<InlineImage> {
  return postGenerateImage({
    contents: [
      {
        role: "user",
        parts: [
          { text: CLONE_PORTRAIT_PROMPT },
          ...photos.map((photo) => ({
            inline_data: { mime_type: photo.mimeType, data: photo.base64 },
          })),
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio: "3:4" },
      temperature: 0.35,
    },
  });
}

/**
 * The klon, both steps: photos -> reference portrait -> character.
 *
 * This is what the screens call. The portrait is scaffolding -- it is never
 * stored and never shown -- so a failure in step one must NOT fail the klon:
 * we log it and draw from the photos alone, which is exactly the v1 behaviour
 * and still produces a picture. Failing here would trade a weaker likeness for
 * no klon at all.
 *
 * Cost and time both roughly double (two image calls, ~25-35s each). That is
 * the price of a face that belongs to the person, measured on 24.08.2026
 * against the same twelve photos.
 */
export async function generateKlon(
  photos: readonly InlineImage[]
): Promise<InlineImage> {
  let reference: InlineImage | null = null;
  try {
    reference = await generateReferencePortrait(photos);
  } catch (err) {
    console.warn("[klon] reference portrait failed, drawing without it:", err);
  }

  return generateAvatarClone(
    reference ? [...photos, reference] : photos,
    buildClonePrompt(photos.length, reference !== null)
  );
}
