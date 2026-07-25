/**
 * Micronutrient FILL-IN (2026-07-25): a cheap, text-only Gemini call that
 * estimates fiber / total sugar / sodium / saturated fat for food that did not
 * arrive through the photo flows.
 *
 * ## Why this exists
 *
 * The four numbers on the home tab's second page are only honest if they cover
 * the whole day. The photo/voice estimators now return micros directly (see
 * `meal-estimate.ts`), but three other paths don't:
 *
 *   * catalog foods (search + barcode) -- the 350 curated `foods` rows have
 *     macros only;
 *   * the "Prizma" multi-shot flow, which owns its own response schema;
 *   * anything logged before this feature existed.
 *
 * For catalog foods the estimate is made ONCE per food and cached on the
 * `foods` row (`micro_source = 'ai'`), so the cost is paid a single time for the
 * whole user base and every later log of that food is instant. That is what
 * `scripts/backfill-food-micro.ts` does in bulk for the existing catalog, and
 * what `src/lib/food/micro-fill.ts` does lazily for a food nobody has estimated
 * yet. For a one-off meal the estimate is per-log.
 *
 * ## Why its own HTTP call instead of `gemini.ts`
 *
 * `gemini.ts` owns the vision/audio/chat transports, all tuned for their jobs:
 * a fixed 45 s timeout (fine for a photo the user is waiting on behind a
 * spinner, far too long for a fill-in that must never hold up a save) and, for
 * the chat helper, a warm temperature and a 900-token cap that a 25-item batch
 * would overflow. This module needs the opposite: near-zero temperature, a
 * short leash, and a token budget sized to a batch. It is a ~40-line POST, and
 * every failure mode collapses to `null` -- "we still don't know", which the
 * whole micro pipeline already handles as a first-class state.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Same Flash model the meal estimator settled on (real quota, good enough for a
// nutrition-table lookup from memory, which is what this task really is).
const DEFAULT_MODEL = "gemini-3.6-flash";

/** Single-food fill-in can sit on the log-save path, so it gets a short leash;
 * the batch (backfill script, nobody waiting) gets a longer one. */
const SINGLE_TIMEOUT_MS = 9_000;
const BATCH_TIMEOUT_MS = 60_000;

/** Batch size for the bulk backfill. 25 keeps the response comfortably inside
 * the output-token budget while making the per-call overhead negligible. */
export const MICRO_BATCH_SIZE = 25;

/** Retries for the BATCH path only (the backfill script). 30 s, 60 s, 120 s:
 * long enough to ride out a per-minute free-tier quota window. */
const BATCH_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 30_000;

export interface MicroPer100gEstimate {
  fiber_100g: number;
  sugar_100g: number;
  sodium_100g: number;
  sat_fat_100g: number;
}

export interface FoodMicroQuery {
  name: string;
  brand?: string | null;
  kcal100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
}

export interface MealMicroQuery {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealMicroEstimate {
  fiber: number;
  sugar: number;
  sodium: number;
  satFat: number;
}

interface GeminiTextResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
}

function model(): string {
  return (
    process.env.GEMINI_MICRO_MODEL ||
    process.env.GEMINI_MEAL_MODEL ||
    process.env.GEMINI_MODEL ||
    DEFAULT_MODEL
  );
}

/**
 * Minimal JSON-mode POST. Returns the model's raw text, or `null` on ANY
 * failure (missing key, HTTP error, timeout, empty candidate) -- callers treat
 * `null` as "still unknown" and carry on; a fill-in must never break a save.
 */
async function postJsonPrompt(
  prompt: string,
  responseSchema: unknown,
  timeoutMs: number,
  maxOutputTokens: number,
  retriesLeft = 0
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `${API_BASE}/${model()}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
            // Extraction, not creativity: we want the same answer for the same
            // food every time.
            temperature: 0,
            maxOutputTokens,
            // Looking up standard nutrition-table values needs no deliberation,
            // and on Gemini 3.x the default DOES deliberate -- measured on a
            // 25-item batch: 4000-5500 thinking tokens, which (a) are charged
            // against `maxOutputTokens`, so the JSON came back truncated and the
            // whole batch was lost, and (b) took 19-24 s instead of 5-7 s.
            // "low" produced literally 0 thinking tokens and the same 25 answers.
            //
            // `thinkingLevel` is the Gemini 3 spelling and is accepted by both
            // 3.5-flash and 3.6-flash (the older `thinkingBudget: 0` is REJECTED
            // with a 400 by 3.6-flash -- verified 2026-07-25). If a future model
            // rejects this field the call 400s and the fill returns null, which
            // every caller already treats as "still unknown".
            thinkingConfig: { thinkingLevel: "low" },
          },
        }),
      }
    );
    if (!response.ok) {
      console.warn("[micro-estimate] HTTP", response.status);
      // 429 (per-minute quota) and 5xx are transient: the free-tier limit is
      // exactly what a bulk backfill run bumps into, and losing a whole 25-food
      // batch to it would be silly. Callers that have someone waiting pass
      // `retriesLeft = 0` and take the null immediately.
      const transient =
        response.status === 429 || response.status >= 500;
      if (transient && retriesLeft > 0) {
        const waitMs = RETRY_BASE_DELAY_MS * 2 ** (BATCH_RETRIES - retriesLeft);
        console.warn(`[micro-estimate] retrying in ${waitMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        return postJsonPrompt(
          prompt,
          responseSchema,
          timeoutMs,
          maxOutputTokens,
          retriesLeft - 1
        );
      }
      return null;
    }
    const body = (await response.json()) as GeminiTextResponse;
    const candidate = body.candidates?.[0];
    const text = candidate?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    // MAX_TOKENS means the JSON came back CUT IN HALF, which then fails to
    // parse. Worth naming explicitly: on Gemini 3.x the model's internal
    // "thinking" is charged against this same output budget (measured: ~400-950
    // thought tokens on a 25-item batch), so a budget sized only to the visible
    // answer silently truncates. See the `maxOutputTokens` sizing below.
    if (candidate?.finishReason && candidate.finishReason !== "STOP") {
      console.warn("[micro-estimate] finishReason:", candidate.finishReason);
    }
    return text && text.length > 0 ? text : null;
  } catch (error) {
    console.warn(
      "[micro-estimate] call failed:",
      error instanceof Error ? error.message : error
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function num(value: unknown, max: number): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(Math.min(parsed, max) * 100) / 100;
}

/**
 * Physical sanity guards on whatever the model returns. Two relations must hold
 * no matter how confident it sounds: sugars are a SUBSET of carbohydrates, and
 * saturated fat is a SUBSET of total fat. (Fiber deliberately gets no such
 * clamp: EU declarations state fiber OUTSIDE "ugljeni hidrati", so
 * `fiber > carbs` is legitimate for e.g. bran.)
 */
function clampAgainstMacros(
  estimate: MicroPer100gEstimate,
  carbs: number,
  fat: number
): MicroPer100gEstimate {
  return {
    fiber_100g: estimate.fiber_100g,
    sugar_100g: Math.min(estimate.sugar_100g, Math.max(carbs, 0)),
    sodium_100g: estimate.sodium_100g,
    sat_fat_100g: Math.min(estimate.sat_fat_100g, Math.max(fat, 0)),
  };
}

const PER_100G_ITEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    i: { type: "INTEGER" },
    vlakna_100g: { type: "NUMBER" },
    secer_100g: { type: "NUMBER" },
    natrijum_100g_mg: { type: "NUMBER" },
    zasicene_100g: { type: "NUMBER" },
  },
  required: [
    "i",
    "vlakna_100g",
    "secer_100g",
    "natrijum_100g_mg",
    "zasicene_100g",
  ],
  propertyOrdering: [
    "i",
    "vlakna_100g",
    "secer_100g",
    "natrijum_100g_mg",
    "zasicene_100g",
  ],
} as const;

const BATCH_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: { namirnice: { type: "ARRAY", items: PER_100G_ITEM_SCHEMA } },
  required: ["namirnice"],
} as const;

const PER_100G_RULES = `Pravila za jedinice i logiku:
- "vlakna_100g": dijetna vlakna, GRAMI na 100 g. Meso, riba, jaja, sirevi, mleko, ulje i mast NEMAJU vlakna (0). Povrće, voće, mahunarke, integralne žitarice, orašasti plodovi ih imaju.
- "secer_100g": UKUPNI šećeri, GRAMI na 100 g (prirodni + dodati). Ne može biti veće od ukupnih ugljenih hidrata.
- "natrijum_100g_mg": natrijum u MILIGRAMIMA na 100 g (NE grami soli!). Ako znaš so u gramima: natrijum_mg = grami_soli × 400. Orijentir: sveže meso i povrće ≈ 40–80 mg; hleb ≈ 400–500 mg; kačkavalj ≈ 700–900 mg; suhomesnato ≈ 1000–1500 mg; supa iz kesice (spremljena) ≈ 300–400 mg.
- "zasicene_100g": zasićene masne kiseline, GRAMI na 100 g. Ne može biti veće od ukupne masti. Životinjske masti, mlečni proizvodi, palmino i kokosovo ulje su bogati; biljna ulja (suncokret, maslina) imaju manje.
- Koristi standardne nutritivne tabele za srpsko/balkansko tržište. Ako ne znaš tačno, daj najbolju procenu — nikad ne vraćaj prazno.
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;

/** The same unit rules stated for a WHOLE PORTION instead of per 100 g (the
 * per-log fill-in). Written out rather than string-munged from the per-100g
 * block: the orientation values differ, and a prompt is too load-bearing to
 * generate with a regex. */
const PORTION_RULES = `Pravila za jedinice i logiku:
- "vlakna_g": dijetna vlakna, GRAMI za celu porciju. Meso, riba, jaja, sirevi, mleko, ulje i mast NEMAJU vlakna (0). Povrće, voće, mahunarke, integralne žitarice i orašasti plodovi ih imaju.
- "secer_g": UKUPNI šećeri, GRAMI za celu porciju (prirodni + dodati). Ne može biti veće od navedenih ugljenih hidrata.
- "natrijum_mg": natrijum u MILIGRAMIMA za celu porciju (NE grami soli!). Ako znaš so u gramima: natrijum_mg = grami_soli × 400. Orijentir za ceo obrok: kuvano kod kuće bez dosoljavanja ≈ 300–600 mg; normalno posoljen obrok ≈ 800–1200 mg; restoranski/fast-food obrok ili suhomesnato ≈ 1500–2500 mg.
- "zasicene_g": zasićene masne kiseline, GRAMI za celu porciju. Ne može biti veće od navedene ukupne masti. Životinjske masti, mlečni proizvodi, palmino i kokosovo ulje su bogati; biljna ulja imaju manje.
- Koristi standardne nutritivne tabele za srpsko/balkansko tržište. Ako ne znaš tačno, daj najbolju procenu — nikad ne vraćaj prazno.
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;

/**
 * Estimates per-100g micros for a BATCH of catalog foods. The macros are sent
 * along deliberately: they anchor the model (a 900 kcal / 100 g food is oil, so
 * fiber and sugar are 0) and let us sanity-clamp the answer afterwards.
 *
 * Returns an array positionally aligned with `foods`; any entry the model
 * skipped, mangled, or that failed a sanity check comes back `null` (still
 * unknown) rather than a guess.
 */
export async function estimateFoodMicrosBatch(
  foods: FoodMicroQuery[]
): Promise<(MicroPer100gEstimate | null)[]> {
  if (foods.length === 0) return [];

  const lines = foods.map((food, index) => {
    const brand = food.brand ? ` (${food.brand})` : "";
    return `${index}. ${food.name}${brand} — na 100 g: ${food.kcal100g} kcal, protein ${food.protein100g} g, UH ${food.carbs100g} g, mast ${food.fat100g} g`;
  });

  const prompt = `Ti si nutricionista sa pristupom standardnim nutritivnim tabelama.
Za svaku namirnicu sa liste dopuni vrednosti NA 100 g koje nisu date: vlakna, ukupne šećere, natrijum i zasićene masti.

Namirnice (koristi isti indeks "i" u odgovoru):
${lines.join("\n")}

${PER_100G_RULES}
- Vrati po jedan objekat za SVAKU namirnicu sa liste, sa tačnim indeksom "i".`;

  const text = await postJsonPrompt(
    prompt,
    BATCH_RESPONSE_SCHEMA,
    BATCH_TIMEOUT_MS,
    // ~60 tokens of JSON per item, plus a generous fixed allowance for the
    // model's THINKING tokens, which are charged against this same budget on
    // Gemini 3.x (measured ~400-950 for a 25-item batch). Sizing this to the
    // visible answer alone is what truncated the response -- and a truncated
    // JSON object is indistinguishable from a broken model, so the whole batch
    // is lost. Slack here is free; we only pay for tokens actually produced.
    Math.min(8192, 2000 + foods.length * 140),
    BATCH_RETRIES
  );
  if (!text) return foods.map(() => null);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.warn("[micro-estimate] batch returned non-JSON");
    return foods.map(() => null);
  }

  const items = (parsed as { namirnice?: unknown })?.namirnice;
  if (!Array.isArray(items)) return foods.map(() => null);

  const results: (MicroPer100gEstimate | null)[] = foods.map(() => null);
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const index = num(item.i, foods.length);
    if (index === null) continue;
    const position = Math.round(index);
    const food = foods[position];
    if (!food) continue;

    const fiber = num(item.vlakna_100g, 100);
    const sugar = num(item.secer_100g, 100);
    const sodium = num(item.natrijum_100g_mg, 30000);
    const satFat = num(item.zasicene_100g, 100);
    if (fiber === null || sugar === null || sodium === null || satFat === null) {
      continue;
    }

    results[position] = clampAgainstMacros(
      {
        fiber_100g: fiber,
        sugar_100g: sugar,
        sodium_100g: sodium,
        sat_fat_100g: satFat,
      },
      food.carbs100g,
      food.fat100g
    );
  }

  return results;
}

/** Convenience single-food wrapper (the lazy fill at log time). */
export async function estimateFoodMicros(
  food: FoodMicroQuery
): Promise<MicroPer100gEstimate | null> {
  const [result] = await estimateFoodMicrosBatch([food]);
  return result ?? null;
}

const MEAL_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    vlakna_g: { type: "NUMBER" },
    secer_g: { type: "NUMBER" },
    natrijum_mg: { type: "NUMBER" },
    zasicene_g: { type: "NUMBER" },
  },
  required: ["vlakna_g", "secer_g", "natrijum_mg", "zasicene_g"],
  propertyOrdering: ["vlakna_g", "secer_g", "natrijum_mg", "zasicene_g"],
} as const;

/**
 * Estimates micros for ONE already-logged meal (name + portion + macros), used
 * when the flow that produced it doesn't return them itself -- today that's the
 * multi-shot "Prizma" path, whose response schema lives in `prizma.ts`.
 *
 * Values are TOTALS for the stated portion, matching the `logs` snapshot
 * columns. `null` on any failure: the meal stays saved, its micros stay unknown,
 * and the home screen reports partial coverage instead of a wrong number.
 */
export async function estimateMealMicros(
  meal: MealMicroQuery
): Promise<MealMicroEstimate | null> {
  const prompt = `Ti si nutricionista. Za opisani obrok dopuni vlakna, ukupne šećere, natrijum i zasićene masti.

Obrok: ${meal.name}
Porcija: ${Math.round(meal.grams)} g
Već poznato za tu porciju: ${Math.round(meal.kcal)} kcal, protein ${meal.protein} g, UH ${meal.carbs} g, mast ${meal.fat} g

Vrednosti vrati UKUPNO ZA TU PORCIJU (ne na 100 g).
${PORTION_RULES}`;

  const text = await postJsonPrompt(
    prompt,
    MEAL_RESPONSE_SCHEMA,
    SINGLE_TIMEOUT_MS,
    // Four numbers to produce, but the same thinking-token budget applies.
    1200
  );
  if (!text) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const item = parsed as Record<string, unknown>;

  const fiber = num(item.vlakna_g, 300);
  const sugar = num(item.secer_g, 1000);
  const sodium = num(item.natrijum_mg, 30000);
  const satFat = num(item.zasicene_g, 500);
  if (fiber === null || sugar === null || sodium === null || satFat === null) {
    return null;
  }

  return {
    fiber,
    // Same subset relations as the per-100g path.
    sugar: Math.min(sugar, Math.max(meal.carbs, 0)),
    sodium,
    satFat: Math.min(satFat, Math.max(meal.fat, 0)),
  };
}
