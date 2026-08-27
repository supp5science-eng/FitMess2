import type { ComponentType } from "react";

/**
 * The tool registry — the part that decides whether Jarvis can do anything.
 *
 * The premise of the rebuild is Naval's: people should not have to learn an
 * app, they should say what they want. But a model that can only talk is a
 * chatbot with a nutrition opinion. What turns it into an assistant is this
 * file: a list of things it is allowed to actually DO, each one written by us,
 * typed, validated and reversible.
 *
 *     Jarvis is exactly as capable as the tools in this registry.
 *
 * Two rules hold the design together.
 *
 * RULE 1 — THE MODEL NEVER TOUCHES THE DATABASE. It picks a tool and fills in
 * arguments. Everything that reaches Supabase goes through `izvrsi` below,
 * which is ordinary code we can read, test and fix. A model that could write
 * rows directly would be one hallucinated number away from silently corrupting
 * a user's history, and no prompt is a substitute for a type check.
 *
 * RULE 2 — THE MODEL NEVER DRAWS THE SCREEN. It chooses a tool; the tool names
 * a component from `ekran`, and the app renders it. Letting a model emit
 * layout produces a UI that is different every time, cannot be tested, and
 * breaks in ways no one can reproduce. Choosing from a fixed set of components
 * gives the same freedom where it matters — the answer to "kako mi ide" really
 * is assembled on demand — while the pixels stay ours.
 *
 * That second rule is also the answer to the thing chat interfaces get wrong.
 * Voice is the fastest way to SAY something ("loguj 200g pirinča") and the
 * slowest way to READ something: nobody wants a week of calories recited at
 * them. So a tool may answer with a screen instead of a sentence, and the
 * good ones usually do.
 */

/** What the model is told a tool takes. A JSON Schema subset, deliberately
 *  small — every field here has to be explained to a model in a prompt. */
export type ShemaParametara = {
  type: "object";
  properties: Record<
    string,
    {
      type: "string" | "number" | "integer" | "boolean";
      description: string;
      /** Constrains the model to a fixed set rather than hoping it guesses. */
      enum?: readonly string[];
    }
  >;
  required?: readonly string[];
};

/** What running a tool produced. */
export type RezultatAlata = {
  /**
   * What the MODEL is told happened. Short, factual, in Serbian, and never a
   * sentence for the user — Jarvis writes that itself, in its own voice, from
   * this. ("Upisano: 250ml vode. Ukupno danas 1250ml.")
   */
  zaModel: string;
  /**
   * What the USER sees, if a screen says it better than a sentence. The tool
   * names a component and the props to hand it; nothing renders that we did
   * not write.
   */
  ekran?: {
    komponenta: string;
    props: Record<string, unknown>;
  };
  /** Set when the tool failed in a way Jarvis should tell the user about. */
  greska?: string;
};

/** Everything a tool is allowed to reach. Passed in rather than imported, so
 *  tools stay testable without a running app. */
export type KontekstAlata = {
  /** The signed-in user's id. Tools never take this as a model argument —
   *  a model that could name a user id could name someone else's. */
  korisnikId: string;
  /** Today, as a Belgrade calendar day (`YYYY-MM-DD`). The app decides what
   *  "danas" means; the model is not asked to know the date, because it does
   *  not reliably. */
  danas: string;
};

export type Alat = {
  /** The name the model calls. */
  ime: string;
  /** What it does, written FOR THE MODEL. This is the single biggest lever on
   *  whether the right tool gets picked — it is a prompt, not a comment. */
  opis: string;
  parametri: ShemaParametara;
  /**
   * Tools that change something the user would not want changed by accident
   * return a confirmation question here, and nothing runs until the user says
   * yes. Reads (`pregledDana`) return `null` and run immediately — asking
   * "smem li da pogledam?" is friction with no safety in it.
   *
   * This is the flow from the brief: user asks → Jarvis asks back → user
   * confirms → Jarvis does it.
   */
  potvrda: ((args: Record<string, unknown>) => string) | null;
  izvrsi: (args: Record<string, unknown>, ctx: KontekstAlata) => Promise<RezultatAlata>;
};

/** The components a tool may name in `ekran`. Registered here rather than
 *  imported dynamically so the set is knowable at build time — and so an
 *  invented component name fails loudly in dev instead of rendering nothing. */
export const komponente: Record<string, ComponentType<never>> = {};

export function registrujKomponentu(ime: string, komponenta: ComponentType<never>) {
  komponente[ime] = komponenta;
}

const registar = new Map<string, Alat>();

export function registrujAlat(alat: Alat) {
  if (registar.has(alat.ime)) {
    throw new Error(`Alat "${alat.ime}" je već registrovan.`);
  }
  registar.set(alat.ime, alat);
}

export function sviAlati(): Alat[] {
  return [...registar.values()];
}

export function nadjiAlat(ime: string): Alat | undefined {
  return registar.get(ime);
}

/**
 * The registry in the shape the Claude API's `tools` parameter wants.
 *
 * Deliberately derived rather than maintained by hand: a tool whose schema
 * here drifts from what `izvrsi` actually reads is a bug that shows up as the
 * model ""being stupid"" — passing the right argument under a name the code
 * never looks at — and it is invisible in every log.
 */
export function alatiZaModel() {
  return sviAlati().map((alat) => ({
    name: alat.ime,
    description: alat.opis,
    input_schema: alat.parametri,
  }));
}
