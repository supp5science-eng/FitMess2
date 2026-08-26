import { z } from "zod";

import {
  VARIANCE_VALUES,
  needsConfirmation,
  parseGricResponse,
  scaleGricItem,
  type GricItem,
  type PortionSizeId,
} from "@/lib/ai/gric-estimate";
import { buildGricRows, type GricRow, type GricRowItem } from "@/lib/gric/rows";

/**
 * Prizma's ONE mutating hand (2026-08-26): the meal draft.
 *
 * ## What changed
 *
 * Until now `/api/ai/agent` only ever answered with NAVIGATION: the model
 * picked ids out of `agent-actions.ts` and the client turned them into links.
 * Say "dva jaja i jogurt" to Prizma and she handed you a card that opened
 * Gric — the same sentence typed a second time, in another screen. That is
 * the one place where "Prizma is the app" visibly stops being true.
 *
 * So Prizma may now WRITE a meal — but only through a draft:
 *
 *   model -> `unos` (structured proposal)  ->  client shows it
 *                                          ->  user confirms
 *                                          ->  POST /api/ai/agent/unos writes
 *
 * There is no path from a model turn to a `logs` row that does not pass
 * through the user's confirmation. The chat turn NEVER writes; the write
 * route never calls a model. Two endpoints, one for each half, because a
 * single endpoint that could do both would eventually do both by accident.
 *
 * ## Why it reuses Gric wholesale
 *
 * A cucumber must weigh the same whether it was spoken into Gric or said to
 * Prizma — otherwise the day's total depends on which screen the user was on.
 * So this module owns NO nutrition math of its own: the model answers in
 * Gric's own shape, `parseGricResponse` parses it, and `buildGricRows` turns
 * items into the rows that get written (`@/lib/gric/rows`). The prompt rules
 * are shared too — `GRIC_RULES`, imported by `agent-chat.ts`.
 *
 * ## The invariant the confirmation rests on
 *
 * The occasions the user SEES are built by `buildGricRows` here, and the
 * occasions that get WRITTEN are built by `buildGricRows` from the same items
 * in the write route. `buildGricRows` is pure, so those two are the same
 * numbers by construction — the user cannot confirm one plate and have
 * another one land in the log. Row totals are always the sum of the parts the
 * SERVER computed; a client-asserted total is never stored (same stance as
 * `dodaj/gric/actions.ts`).
 */

/** One proposed item. Gric's item plus the occasion tag — same fields, same
 * bounds, so a draft can be handed straight to Gric's own helpers. */
export type AgentDraftItem = GricItem & { grupa?: number };

/** What the client renders and hands back on confirm. */
export interface AgentMealDraft {
  /** Room for `voda`/`trening` drafts later without reshaping the payload. */
  kind: "obrok";
  /** The proposal, verbatim — the client echoes this back to confirm. */
  items: AgentDraftItem[];
  /** One entry per eating occasion = one `logs` row that will be written. */
  occasions: GricRow[];
  /** Sum of the occasions (not of the items) — the number that will land in
   * the day's total, so the confirm screen and the log always agree. */
  totalKcal: number;
  /** True when some item's portion genuinely varies (cake, burek, restaurant
   * food) and the user should look at the size before confirming. */
  needsPortionCheck: boolean;
}

/** Gric items -> the row builder's input. The only translation layer in the
 * whole path, and it moves names, never numbers. */
function toRowItems(items: readonly AgentDraftItem[]): GricRowItem[] {
  return items.map((item) => ({
    name: item.naziv,
    amount: item.kolicina || undefined,
    grams: item.grami,
    kcal: item.kcal,
    protein: item.protein_g,
    carbs: item.uh_g,
    fat: item.mast_g,
    group: item.grupa,
  }));
}

/** The `logs` rows a draft writes, in the order the user saw them. Used by
 * both halves — preview and write — which is what makes them agree. */
export function draftRows(items: readonly AgentDraftItem[]): GricRow[] {
  return buildGricRows(toRowItems(items));
}

/** Wraps a set of items into the draft the client receives. */
export function draftFromItems(items: readonly AgentDraftItem[]): AgentMealDraft {
  const own = [...items];
  const occasions = draftRows(own);
  return {
    kind: "obrok",
    items: own,
    occasions,
    totalKcal: occasions.reduce((total, row) => total + row.kcal, 0),
    needsPortionCheck: needsConfirmation(own),
  };
}

/**
 * The model's `unos` field -> a draft, or `null`.
 *
 * `null` for anything that is not a usable proposal: the field absent (the
 * ordinary case — most turns are conversation), an empty `obroci` (the model
 * heard no food), or a shape it invented. A bad draft costs the draft, never
 * the reply — exactly how a hallucinated action id costs a card and not the
 * answer.
 */
export function buildAgentMealDraft(raw: unknown): AgentMealDraft | null {
  if (raw === null || raw === undefined) return null;
  const parsed = parseGricResponse(raw);
  if (!parsed || parsed.stavke.length === 0) return null;
  return draftFromItems(parsed.stavke);
}

/**
 * Rescale one drafted item to a portion size, for the size chips on a
 * high-variance line. Delegates to Gric's tested `scaleGricItem` (pure, and
 * always applied to the ORIGINAL item, so Manje -> Više -> Manje never drifts)
 * and keeps the occasion tag.
 */
export function scaleDraftItem(
  item: AgentDraftItem,
  size: PortionSizeId
): AgentDraftItem {
  return { ...scaleGricItem(item, size), grupa: item.grupa };
}

/**
 * What the client may send to `POST /api/ai/agent/unos`.
 *
 * Strict where the model-facing schema is forgiving: the model gets `.catch()`
 * defaults because a mangled model answer must not break a flow, but this is
 * the trust boundary — a request that is not a well-formed draft is refused
 * rather than silently zeroed into a 0 kcal meal. Bounds mirror
 * `gricItemSchema`'s clamps, so any draft this module produced round-trips.
 */
const confirmItemSchema = z.object({
  naziv: z.string().trim().min(1).max(60),
  kolicina: z.string().trim().max(40).optional().default(""),
  grami: z.coerce.number().min(1).max(2000),
  kcal: z.coerce.number().min(0).max(4000),
  protein_g: z.coerce.number().min(0).max(400),
  uh_g: z.coerce.number().min(0).max(700),
  mast_g: z.coerce.number().min(0).max(400),
  varijansa: z.enum(VARIANCE_VALUES).optional().default("srednja"),
  /** Opaque occasion id; equal values were eaten together. */
  grupa: z.coerce.number().int().min(0).max(31).optional(),
});

/** One sentence can describe a morning, not a shopping list — the same cap
 * the model's own item list carries. */
const MAX_CONFIRM_ITEMS = 8;

export const agentDraftConfirmSchema = z.object({
  items: z.array(confirmItemSchema).min(1).max(MAX_CONFIRM_ITEMS),
});

export type AgentDraftConfirmInput = z.input<typeof agentDraftConfirmSchema>;
