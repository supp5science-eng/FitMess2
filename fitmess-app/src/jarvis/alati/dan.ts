import { supabase } from "@/lib/supabase";
import { registrujAlat, type RezultatAlata } from "../alat";

/**
 * "Kako mi ide danas" — the tool that exists to prove a point.
 *
 * This is the case where a chat interface is WORSE than the screen it
 * replaces. Spoken aloud, the honest answer is:
 *
 *   "Pojeo si hiljadu četiristo dvadeset od dve hiljade sto kalorija, ostalo
 *    ti je šesto osamdeset, od toga sto dva grama proteina od sto trideset,
 *    četrdeset i dva grama masti od sedamdeset…"
 *
 * Nobody wants that. It takes twenty seconds, it is gone as it is said, and
 * the listener has to hold six numbers in their head to make sense of it.
 *
 * So the tool answers with a CARD, and gives the model one short sentence to
 * say over it. `zaModel` is deliberately compact — the model needs the numbers
 * to reason ("ostalo ti je taman za večeru"), not to recite them.
 *
 * That split is the rule the whole assistant is built on: voice is the fastest
 * way to SAY something and the slowest way to READ something.
 */

registrujAlat({
  ime: "pregledDana",
  opis:
    "Vraća današnje stanje: pojedene kalorije, cilj, ostatak i makroe. " +
    "Koristi kad korisnik pita kako mu ide, koliko je pojeo, koliko mu je " +
    "ostalo, ili šta može još da pojede. Rezultat se korisniku prikazuje kao " +
    "kartica — ti kaži samo jednu kratku rečenicu preko nje, nemoj da " +
    "nabrajaš brojeve naglas.",
  parametri: { type: "object", properties: {} },
  // A read. Asking permission to look at the user's own day would be friction
  // with no safety in it.
  potvrda: null,

  async izvrsi(_args, ctx): Promise<RezultatAlata> {
    // Two reads rather than a join: `targets` is one row and `logs` is many,
    // and PostgREST would otherwise hand back the target duplicated onto every
    // log row.
    const [logsResult, targetResult] = await Promise.all([
      supabase
        .from("logs")
        .select("name, kcal, protein, carbs, fat")
        .eq("user_id", ctx.korisnikId)
        .eq("day", ctx.danas),
      supabase
        .from("targets")
        .select("daily_kcal, protein_g, carbs_g, fat_g")
        .eq("user_id", ctx.korisnikId)
        .maybeSingle(),
    ]);

    if (logsResult.error) {
      return { zaModel: "Nismo uspeli da pročitamo današnji dan.", greska: logsResult.error.message };
    }

    const logs = logsResult.data ?? [];
    const ukupno = logs.reduce(
      (zbir, log) => ({
        kcal: zbir.kcal + (log.kcal ?? 0),
        protein: zbir.protein + (log.protein ?? 0),
        carbs: zbir.carbs + (log.carbs ?? 0),
        fat: zbir.fat + (log.fat ?? 0),
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const cilj = targetResult.data ?? null;
    const ostalo = cilj?.daily_kcal ? cilj.daily_kcal - ukupno.kcal : null;

    // Compact, and written for a model that has to REASON with these, not
    // read them out. The card carries the presentation.
    const zaModel = [
      `Pojedeno: ${ukupno.kcal} kcal`,
      cilj?.daily_kcal ? `cilj ${cilj.daily_kcal} kcal` : "cilj nije postavljen",
      ostalo !== null
        ? ostalo >= 0
          ? `ostalo ${ostalo} kcal`
          : `preko cilja za ${Math.abs(ostalo)} kcal`
        : null,
      `P/UH/M: ${ukupno.protein}/${ukupno.carbs}/${ukupno.fat} g`,
      `obroka: ${logs.length}`,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      zaModel,
      ekran: {
        komponenta: "KarticaDana",
        props: {
          pojedeno: ukupno.kcal,
          cilj: cilj?.daily_kcal ?? null,
          protein: ukupno.protein,
          ugljeni: ukupno.carbs,
          masti: ukupno.fat,
          ciljProtein: cilj?.protein_g ?? null,
          ciljUgljeni: cilj?.carbs_g ?? null,
          ciljMasti: cilj?.fat_g ?? null,
          obroci: logs.map((log) => ({ naziv: log.name, kcal: log.kcal ?? 0 })),
        },
      },
    };
  },
});
