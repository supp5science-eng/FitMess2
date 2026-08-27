import { supabase } from "@/lib/supabase";
import { registrujAlat, type RezultatAlata } from "../alat";

/**
 * "Popio sam čašu vode" — the smallest complete example of the whole idea.
 *
 * Worth reading as a template, because everything a real tool has to get right
 * is already here in miniature:
 *
 *   - The model supplies a QUANTITY, never a total. Two glasses logged a
 *     second apart must add up, not overwrite each other; the same reason the
 *     web route (`api/voda`) takes `deltaMl`.
 *   - The model does not supply the day or the user. `ctx` does. A model that
 *     could name either could name the wrong one.
 *   - The arguments are validated HERE, after the model has spoken. A schema
 *     tells the model what to send; it does not stop it from sending
 *     something else.
 *   - It answers with a SCREEN as well as a sentence. "1250 od 2500ml" read
 *     aloud is worse than a glass drawn filling up.
 */

const MAX_ML = 20000;

/** The three amounts the sheet on the web offers, so "čaša" means the same
 *  thing whether it is tapped or spoken. */
const MERE = {
  casa: 250,
  flasa: 500,
  "velika-flasa": 750,
} as const;

registrujAlat({
  ime: "dodajVodu",
  opis:
    "Upisuje popijenu vodu za danas. Koristi kad korisnik kaže da je popio vodu " +
    "— npr. „popio sam čašu vode", „dodaj pola litra", „još jednu flašu". " +
    "Prosledi ILI `mera` (čaša/flaša/velika flaša) ILI `ml` ako korisnik kaže " +
    "tačnu količinu. Ne šalji ukupnu dnevnu količinu, nego samo ono što je " +
    "sada popio. Za brisanje/ispravku pošalji negativan `ml`.",
  parametri: {
    type: "object",
    properties: {
      mera: {
        type: "string",
        description: "Uobičajena mera, ako je korisnik tako rekao.",
        enum: ["casa", "flasa", "velika-flasa"],
      },
      ml: {
        type: "number",
        description:
          "Tačna količina u mililitrima, ako je korisnik rekao broj. Negativno briše.",
      },
    },
  },
  // A read needs no permission; a write of this size needs no ceremony either.
  // Water is trivially correctable — and asking "smem li?" for every glass
  // would make the assistant exhausting to use. Confirmation is reserved for
  // things that are annoying to undo.
  potvrda: null,

  async izvrsi(args, ctx): Promise<RezultatAlata> {
    const mera = typeof args.mera === "string" ? args.mera : null;
    const delta =
      mera && mera in MERE
        ? MERE[mera as keyof typeof MERE]
        : typeof args.ml === "number" && Number.isFinite(args.ml)
          ? Math.round(args.ml)
          : null;

    if (delta === null || delta === 0) {
      return {
        zaModel: "Nije prosleđena količina. Pitaj korisnika koliko je popio.",
        greska: "nedostaje-kolicina",
      };
    }

    // Read-then-write rather than a bare increment: the total has to be
    // clamped, and `water_intake` holds one row per user per day.
    const { data: postojece, error: greskaCitanja } = await supabase
      .from("water_intake")
      .select("ml")
      .eq("user_id", ctx.korisnikId)
      .eq("day", ctx.danas)
      .maybeSingle();

    if (greskaCitanja) {
      return {
        zaModel: "Nismo uspeli da pročitamo vodu za danas.",
        greska: greskaCitanja.message,
      };
    }

    const trenutno = postojece?.ml ?? 0;
    const ukupno = Math.max(0, Math.min(MAX_ML, trenutno + delta));

    const { error: greskaUpisa } = await supabase
      .from("water_intake")
      .upsert(
        { user_id: ctx.korisnikId, day: ctx.danas, ml: ukupno },
        { onConflict: "user_id,day" }
      );

    if (greskaUpisa) {
      return { zaModel: "Nismo uspeli da upišemo vodu.", greska: greskaUpisa.message };
    }

    return {
      // What the model is told. It writes the user's sentence from this — it
      // does not read this out.
      zaModel:
        delta > 0
          ? `Upisano +${delta}ml. Ukupno danas: ${ukupno}ml.`
          : `Skinuto ${Math.abs(delta)}ml. Ukupno danas: ${ukupno}ml.`,
      ekran: { komponenta: "KarticaVode", props: { ml: ukupno, promena: delta } },
    };
  },
});
