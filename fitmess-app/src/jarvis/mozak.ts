import { supabase } from "@/lib/supabase";
import { alatiZaModel, nadjiAlat, type KontekstAlata, type RezultatAlata } from "./alat";

/**
 * The wire between the phone and Jarvis's brain.
 *
 * WHY THERE IS A SERVER IN THE MIDDLE AT ALL. The Anthropic key cannot ship
 * inside the binary — anyone who downloads the app can read it out, and the
 * bill is ours. So the phone never talks to the model; it talks to
 * `fitmess.app/api/jarvis`, which holds the key and forwards the turn. Same
 * reason ElevenLabs will sit behind the same route.
 *
 * WHY THE PHONE STILL RUNS THE TOOLS. The obvious alternative — let the server
 * run everything — breaks the moment a tool has to touch the device: open the
 * camera, read the step count, navigate to a screen, buzz. And the data tools
 * do not need the server anyway: RLS lets the phone write its own rows
 * directly, so routing them through fitmess.app would add a hop for nothing.
 *
 * So the loop is split, and the conversation lives on the PHONE:
 *
 *   phone → server   messages so far + which tools this app version has
 *   server → model   one turn
 *   model → server   text, or "call `dodajVodu` with {mera:"casa"}"
 *   server → phone   that decision, verbatim
 *   phone            asks for confirmation if the tool requires it, runs it
 *   phone → server   the same messages plus the tool result → loop
 *
 * Keeping the history on the phone makes the server stateless: it can restart,
 * deploy or scale mid-conversation without dropping anyone, and a conversation
 * survives a lost connection because it never lived anywhere else.
 *
 * ⚠️ The tool list is sent per turn rather than hardcoded server-side, and
 * that is deliberate: an OTA update can add a tool to the app, while an old
 * install that never got it must not have the model calling something it
 * cannot run. The app declares what it can do; the server tells the model
 * only that.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://fitmess.app";

/** One entry in the conversation. Mirrors the Messages API's shape closely
 *  enough that the route can forward it without translating. */
export type Poruka =
  | { uloga: "korisnik"; tekst: string }
  | {
      uloga: "jarvis";
      tekst: string;
      /** Set when the model asked for a tool instead of (or as well as)
       *  answering. */
      poziv?: { id: string; ime: string; argumenti: Record<string, unknown> };
    }
  | {
      uloga: "alat";
      /** Matches the `poziv.id` this is answering. */
      id: string;
      rezultat: RezultatAlata;
    };

/** What one turn produced, for the screen to render. */
export type OdgovorMozga = {
  poruke: Poruka[];
  /** Set when a tool wants confirmation before it runs. The screen shows this
   *  question and calls `potvrdi()` or drops the call. */
  cekaPotvrdu?: { id: string; ime: string; argumenti: Record<string, unknown>; pitanje: string };
};

async function posalji(body: unknown): Promise<Response> {
  // The access token, not a cookie: `createClientFromRequest` on the server
  // reads this header and builds a session-scoped Supabase client from it, so
  // RLS applies to whatever the route does on the caller's behalf.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Nema sesije.");

  return fetch(`${BASE_URL}/api/jarvis`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Runs the conversation forward until Jarvis has actually answered.
 *
 * Loops rather than returning after one hop, because a single user sentence
 * routinely costs several model turns ("popio sam čašu i pojeo jabuku" is two
 * tools and then a sentence). The loop stops on a plain answer, on a tool that
 * needs confirmation, or at `MAX_KRUGOVA` — which exists so a model that keeps
 * calling tools cannot spend the user's money in a circle.
 */
const MAX_KRUGOVA = 8;

export async function odgovori(
  istorija: Poruka[],
  ctx: KontekstAlata
): Promise<OdgovorMozga> {
  const poruke = [...istorija];

  for (let krug = 0; krug < MAX_KRUGOVA; krug += 1) {
    const odgovor = await posalji({ poruke, alati: alatiZaModel(), danas: ctx.danas });

    if (!odgovor.ok) {
      throw new Error(`Jarvis nije odgovorio (${odgovor.status}).`);
    }

    const telo = (await odgovor.json()) as {
      tekst: string;
      poziv?: { id: string; ime: string; argumenti: Record<string, unknown> };
    };

    poruke.push({ uloga: "jarvis", tekst: telo.tekst, poziv: telo.poziv });

    // A plain answer ends the turn.
    if (!telo.poziv) return { poruke };

    const alat = nadjiAlat(telo.poziv.ime);
    if (!alat) {
      // The model named a tool this build does not have. Told, not crashed:
      // it can apologise or pick another one, and the user sees a sentence
      // rather than an error.
      poruke.push({
        uloga: "alat",
        id: telo.poziv.id,
        rezultat: { zaModel: `Alat "${telo.poziv.ime}" ne postoji u ovoj verziji aplikacije.` },
      });
      continue;
    }

    // Anything that changes something stops here and asks. The screen resumes
    // the loop through `potvrdi` once the user has answered.
    const pitanje = alat.potvrda?.(telo.poziv.argumenti) ?? null;
    if (pitanje) {
      return { poruke, cekaPotvrdu: { ...telo.poziv, pitanje } };
    }

    poruke.push({
      uloga: "alat",
      id: telo.poziv.id,
      rezultat: await alat.izvrsi(telo.poziv.argumenti, ctx),
    });
  }

  // Out of rounds. Honest rather than silent: a conversation that quietly
  // stops mid-task looks like the app froze.
  return {
    poruke: [
      ...poruke,
      { uloga: "jarvis", tekst: "Zapetljao sam se. Probaj da mi kažeš drugačije." },
    ],
  };
}

/** Continues after the user has answered a confirmation. `da === false` tells
 *  the model it was refused, so it can say something sensible instead of
 *  pretending the thing happened. */
export async function potvrdi(
  istorija: Poruka[],
  poziv: { id: string; ime: string; argumenti: Record<string, unknown> },
  da: boolean,
  ctx: KontekstAlata
): Promise<OdgovorMozga> {
  const alat = nadjiAlat(poziv.ime);

  const rezultat: RezultatAlata = !da
    ? { zaModel: "Korisnik je odbio. Nemoj to da uradiš i nemoj ponovo da nudiš." }
    : alat
      ? await alat.izvrsi(poziv.argumenti, ctx)
      : { zaModel: `Alat "${poziv.ime}" ne postoji u ovoj verziji aplikacije.` };

  return odgovori([...istorija, { uloga: "alat", id: poziv.id, rezultat }], ctx);
}
