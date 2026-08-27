import Anthropic from "@anthropic-ai/sdk";

/**
 * Jarvis's turn — the same brain as `claude.ts`, asked a different question.
 *
 * `generateAgentTurnClaude` asks the model for a JSON reply and a navigational
 * action id: Prizma answers, and points at the screen where the user can do
 * the thing themselves. This asks for a TOOL CALL: Jarvis does the thing.
 *
 * Kept in its own module rather than added to `claude.ts` so the AI tab that
 * is live in production today cannot break while this is being built.
 *
 * NEVER import from a client component — it reads `ANTHROPIC_API_KEY`.
 */

const JARVIS_MODEL = "claude-opus-5";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  // Lazy, so importing this module (route bundling, tests) never throws on a
  // missing key — only an actual turn does.
  if (!client) client = new Anthropic();
  return client;
}

/** One entry of the conversation as the phone keeps it. Mirrors
 *  `fitmess-app/src/jarvis/mozak.ts`; the two shapes must stay in step. */
export type JarvisPoruka =
  | { uloga: "korisnik"; tekst: string }
  | {
      uloga: "jarvis";
      tekst: string;
      poziv?: { id: string; ime: string; argumenti: Record<string, unknown> };
    }
  | { uloga: "alat"; id: string; rezultat: { zaModel: string } };

/**
 * A tool as the phone declares it.
 *
 * `input_schema` is the SDK's own type rather than a loose record: it pins
 * `type: "object"` at the top level, which the API requires and which a plain
 * `Record<string, unknown>` would let through — producing a 400 at runtime,
 * from the phone, instead of a red line here.
 */
export type JarvisAlat = {
  name: string;
  description: string;
  input_schema: Anthropic.Tool["input_schema"];
};

export type JarvisOdgovor = {
  tekst: string;
  poziv?: { id: string; ime: string; argumenti: Record<string, unknown> };
};

/**
 * Translates the phone's history into Messages API turns.
 *
 * The awkward part, and the reason this is a function rather than a `.map`: a
 * tool result is a USER-role message in the API even though no user typed it,
 * and it must directly follow the assistant message that requested it. Get the
 * pairing wrong and the API rejects the whole conversation with an error that
 * names neither the tool nor the turn.
 */
function uMessages(poruke: JarvisPoruka[]): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];

  for (const poruka of poruke) {
    if (poruka.uloga === "korisnik") {
      messages.push({ role: "user", content: poruka.tekst });
      continue;
    }

    if (poruka.uloga === "jarvis") {
      const content: Anthropic.ContentBlockParam[] = [];
      // A turn can carry both: "Upisujem to." plus the call itself.
      if (poruka.tekst) content.push({ type: "text", text: poruka.tekst });
      if (poruka.poziv) {
        content.push({
          type: "tool_use",
          id: poruka.poziv.id,
          name: poruka.poziv.ime,
          input: poruka.poziv.argumenti,
        });
      }
      if (content.length) messages.push({ role: "assistant", content });
      continue;
    }

    messages.push({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: poruka.id, content: poruka.rezultat.zaModel },
      ],
    });
  }

  return messages;
}

export function hasJarvisKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** Today, recomputed from storage by the route — never sent by the phone. A
 *  client-supplied number is a client-supplied story. */
export type JarvisCinjenice = {
  ime: string | null;
  dan: string;
  ciljKcal: number | null;
  pojedenoKcal: number;
  obroci: { naziv: string; kcal: number }[];
  vodaMl: number | null;
  vodaCiljMl: number | null;
};

/**
 * Jarvis's instructions.
 *
 * Deliberately NOT the AI tab's persona prompt (`buildAgentSystemPrompt`).
 * That one describes an assistant who explains where to tap; this one
 * describes an assistant who does the thing. Two different jobs, and merging
 * them would blunt both.
 *
 * The rules below are short on purpose. Long personas make a model perform a
 * character instead of doing the work, and Opus 5 in particular gets worse the
 * more prescriptive the prompt — the notes in `docs/nativna-aplikacija.md` say
 * the same about over-specified prompts.
 */
export function buildJarvisSystemPrompt(c: JarvisCinjenice): string {
  const obroci = c.obroci.length
    ? c.obroci.map((o) => `${o.naziv} (${o.kcal} kcal)`).join(", ")
    : "još ništa";

  return [
    "Ti si Jarvis — asistent unutar FitMess aplikacije. Korisnik ti govori, najčešće naglas, i ti radiš ono što traži.",
    "",
    "KAKO RADIŠ:",
    "— Kad korisnik traži nešto što alat ume, pozovi alat. Nemoj da objašnjavaš gde da tapne — ti to uradiš.",
    "— Kad ti nešto nije jasno (koliko, kada, koji obrok), pitaj kratko pa onda uradi. Ne pogađaj količine.",
    "— Kad alat ne postoji za ono što traži, reci to jednom rečenicom i ponudi ono što umeš.",
    "",
    "KAKO PRIČAŠ:",
    "— Kratko. Ovo se sluša, ne čita. Jedna do dve rečenice.",
    // Serbian quotes are „…" — the closing one is a straight double quote and
    // ends the JS string. Single-quoted here for that reason alone.
    '— Srpski, obraćaš se na „ti".',
    "— Bez emodžija i bez nabrajanja u crticama — to se ne izgovara.",
    "— Kad alat vrati ekran, ti izgovoriš samo kratku polovinu; broj korisnik vidi.",
    "",
    "ŠTA NIKAD NE RADIŠ:",
    "— Ne izmišljaš brojeve. Ako ga nema u činjenicama ispod ili u rezultatu alata, nemaš ga.",
    "— Ne kritikuješ korisnika zbog onoga što je pojeo i ne držiš predavanja o zdravlju. Prekoračen cilj nije greška.",
    "— Ne tvrdiš da si nešto uradio dok ti alat nije vratio da jeste.",
    "",
    "DANAŠNJE STANJE (izračunato iz baze, ovo je istina):",
    `— Datum: ${c.dan}`,
    c.ime ? `— Ime: ${c.ime}` : "— Ime: nepoznato",
    c.ciljKcal ? `— Cilj: ${c.ciljKcal} kcal` : "— Cilj: nije postavljen",
    `— Pojedeno danas: ${c.pojedenoKcal} kcal`,
    `— Obroci danas: ${obroci}`,
    c.vodaMl !== null
      ? `— Voda danas: ${c.vodaMl} ml${c.vodaCiljMl ? ` od ${c.vodaCiljMl} ml` : ""}`
      : "— Voda danas: nepoznato",
  ].join("\n");
}

export async function jarvisTurn(
  systemPrompt: string,
  poruke: JarvisPoruka[],
  alati: JarvisAlat[]
): Promise<JarvisOdgovor> {
  const response = await getClient().messages.create({
    model: JARVIS_MODEL,
    // Adaptive thinking is on by default on Opus 5 and bills into max_tokens,
    // so this leaves headroom above a short spoken reply.
    max_tokens: 4096,
    system: systemPrompt,
    messages: uMessages(poruke),
    tools: alati,
    output_config: {
      /**
       * "low", and deliberately lower than the AI tab's "medium".
       *
       * Jarvis is spoken to. Every extra second of thinking is a second of
       * silence in what is supposed to be a conversation, and the hard part of
       * this turn is picking one tool from a short list — not reasoning. The
       * numbers were settled before the call.
       *
       * ⚠️ Effort is not where the latency fight is won regardless; streaming
       * is (see `docs/nativna-aplikacija.md`). This route answers in one shot
       * for now because a tool call cannot be acted on until it is complete —
       * the streaming that matters is of the SPOKEN reply, and that belongs to
       * the ElevenLabs leg.
       */
      effort: "low",
    },
  });

  if (response.stop_reason === "refusal") {
    // Safety classifier declined: HTTP 200, no usable content. Raised so the
    // route answers with its own calm Serbian copy.
    throw new Error("Claude declined the request (stop_reason: refusal)");
  }

  const tekst = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  const poziv = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  return {
    tekst,
    poziv: poziv
      ? {
          id: poziv.id,
          ime: poziv.name,
          // Already parsed by the SDK. Never string-match a serialised tool
          // input: Opus 5 varies its JSON escaping between turns.
          argumenti: poziv.input as Record<string, unknown>,
        }
      : undefined,
  };
}
