import { describe, expect, it } from "vitest";

import {
  AGENT_RESPONSE_JSON_SCHEMA,
  AGENT_RESPONSE_SCHEMA,
  agentModelReplySchema,
} from "@/lib/ai/agent-chat";
import {
  agentDraftConfirmSchema,
  buildAgentMealDraft,
  draftFromItems,
  draftRows,
  scaleDraftItem,
  type AgentDraftItem,
} from "@/lib/ai/agent-draft";

// Izvršni put (2026-08-26): Prizma may propose a meal entry, and only a
// confirmed proposal is ever written. These tests hold the three things that
// makes safe:
//   1. the draft is a PROPOSAL — a malformed or foodless one costs the draft,
//      never the reply;
//   2. what the user SEES is what gets WRITTEN (the preview and the write
//      route build their rows with the same pure function);
//   3. the confirm boundary is strict — the model-facing schema forgives, this
//      one refuses.

/** One model answer, in the shape both dialect schemas describe. */
function modelDraft(): unknown {
  return {
    obroci: [
      {
        stavke: [
          {
            naziv: "Jaja",
            kolicina: "2 komada",
            grami: 120,
            kcal: 186,
            protein_g: 15.6,
            uh_g: 1.2,
            mast_g: 13.2,
            varijansa: "niska",
          },
          {
            naziv: "Jogurt",
            kolicina: "1 čaša",
            grami: 200,
            kcal: 122,
            protein_g: 8,
            uh_g: 9.4,
            mast_g: 6.4,
            varijansa: "niska",
          },
        ],
      },
    ],
  };
}

describe("buildAgentMealDraft", () => {
  it("turns one occasion into one row, with the parts kept as a breakdown", () => {
    const draft = buildAgentMealDraft(modelDraft());
    expect(draft).not.toBeNull();
    if (!draft) return;

    expect(draft.kind).toBe("obrok");
    expect(draft.items).toHaveLength(2);
    expect(draft.occasions).toHaveLength(1);

    const [occasion] = draft.occasions;
    expect(occasion.name).toBe("Jaja i jogurt");
    expect(occasion.grams).toBe(320);
    expect(occasion.kcal).toBe(308);
    expect(occasion.components).toHaveLength(2);
    // The natural unit survives, so "Dodaj još" can offer "+1 komad" later.
    expect(occasion.components?.[0]).toMatchObject({
      naziv: "Jaja",
      kom_naziv: "komad",
      kom_grami: 60,
    });
  });

  it("splits two eating occasions into two rows", () => {
    const draft = buildAgentMealDraft({
      obroci: [
        {
          stavke: [
            {
              naziv: "Čokolada",
              kolicina: "2 reda",
              grami: 40,
              kcal: 210,
              protein_g: 2,
              uh_g: 24,
              mast_g: 12,
              varijansa: "niska",
            },
          ],
        },
        {
          stavke: [
            {
              naziv: "Sladoled",
              kolicina: "1 kugla",
              grami: 80,
              kcal: 160,
              protein_g: 3,
              uh_g: 18,
              mast_g: 8,
              varijansa: "srednja",
            },
          ],
        },
      ],
    });
    expect(draft?.occasions.map((row) => row.name)).toEqual([
      "Čokolada",
      "Sladoled",
    ]);
    // A single-item occasion needs no breakdown of one line.
    expect(draft?.occasions.every((row) => row.components === null)).toBe(true);
    expect(draft?.totalKcal).toBe(370);
  });

  it("totals the OCCASIONS, so the confirm screen and the log agree", () => {
    const draft = buildAgentMealDraft(modelDraft());
    const summed =
      draft?.occasions.reduce((total, row) => total + row.kcal, 0) ?? -1;
    expect(draft?.totalKcal).toBe(summed);
  });

  it("flags a high-variance portion for the user's eyes", () => {
    const low = buildAgentMealDraft(modelDraft());
    expect(low?.needsPortionCheck).toBe(false);

    const burek = buildAgentMealDraft({
      obroci: [
        {
          stavke: [
            {
              naziv: "Burek",
              kolicina: "parče",
              grami: 250,
              kcal: 700,
              protein_g: 18,
              uh_g: 62,
              mast_g: 42,
              varijansa: "visoka",
            },
          ],
        },
      ],
    });
    expect(burek?.needsPortionCheck).toBe(true);
  });

  it("is null for anything that is not a usable proposal", () => {
    expect(buildAgentMealDraft(undefined)).toBeNull();
    expect(buildAgentMealDraft(null)).toBeNull();
    // The model heard no food.
    expect(buildAgentMealDraft({ obroci: [] })).toBeNull();
    expect(buildAgentMealDraft({ obroci: [{ stavke: [] }] })).toBeNull();
    expect(buildAgentMealDraft("dva jaja i jogurt")).toBeNull();
    expect(buildAgentMealDraft(42)).toBeNull();
  });

  it("survives a model that returned junk in the numeric fields", () => {
    const draft = buildAgentMealDraft({
      obroci: [
        {
          stavke: [
            {
              naziv: "Krastavac",
              kolicina: "1 komad",
              grami: "sto pedeset",
              kcal: null,
              protein_g: 0.7,
              uh_g: 3.6,
              mast_g: 0.1,
              varijansa: "izmišljena",
            },
          ],
        },
      ],
    });
    // Clamped, not crashed: a broken estimate becomes a small honest one.
    expect(draft?.items[0].grami).toBe(1);
    expect(draft?.items[0].kcal).toBe(0);
    expect(draft?.items[0].varijansa).toBe("srednja");
  });
});

describe("the draft inside a model turn", () => {
  it("rides along with the reply and the actions", () => {
    const parsed = agentModelReplySchema.safeParse({
      reply: "Spremila sam predlog — potvrdi pa upisujem.",
      actions: ["danas"],
      unos: modelDraft(),
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.unos?.occasions[0].name).toBe("Jaja i jogurt");
    expect(parsed.data.actions).toEqual(["danas"]);
  });

  it("a broken draft costs the draft, never the reply", () => {
    const parsed = agentModelReplySchema.safeParse({
      reply: "Evo odgovora.",
      unos: { obroci: "nešto sasvim drugo" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.unos).toBeNull();
  });

  it("an ordinary conversational turn carries no draft", () => {
    const parsed = agentModelReplySchema.safeParse({ reply: "Dobro stojiš." });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.unos).toBeNull();
  });
});

describe("both model dialects describe the same draft field", () => {
  it("Gemini gets uppercase types, Claude strict JSON Schema", () => {
    const gemini = AGENT_RESPONSE_SCHEMA.properties.unos;
    const claude = AGENT_RESPONSE_JSON_SCHEMA.properties.unos;
    expect(gemini.type).toBe("OBJECT");
    expect(claude.type).toBe("object");
    expect(gemini.properties.obroci.items.properties.stavke.items.required).toEqual(
      claude.properties.obroci.items.properties.stavke.items.required
    );
    // The whole Claude payload stays a closed object -- `unos` included.
    expect(claude.additionalProperties).toBe(false);
    expect(
      claude.properties.obroci.items.properties.stavke.items.additionalProperties
    ).toBe(false);
    // `unos` is optional: most turns are conversation, not logging.
    expect(AGENT_RESPONSE_JSON_SCHEMA.required).toEqual(["reply"]);
  });

  it("the item fields the schemas require are the ones the parse reads", () => {
    const required =
      AGENT_RESPONSE_JSON_SCHEMA.properties.unos.properties.obroci.items
        .properties.stavke.items.required;
    const item = buildAgentMealDraft(modelDraft())?.items[0];
    expect(item).toBeDefined();
    for (const field of required) {
      expect(item).toHaveProperty(field);
    }
  });
});

describe("the confirm boundary", () => {
  it("accepts a draft it produced itself, unchanged", () => {
    const draft = buildAgentMealDraft(modelDraft());
    const parsed = agentDraftConfirmSchema.safeParse({ items: draft?.items });
    expect(parsed.success).toBe(true);
  });

  it("writes exactly the plate the user confirmed", () => {
    const draft = buildAgentMealDraft(modelDraft());
    const parsed = agentDraftConfirmSchema.safeParse({ items: draft?.items });
    expect(parsed.success).toBe(true);
    if (!parsed.success || !draft) return;
    // What `/api/ai/agent/unos` inserts, rebuilt from the echoed items.
    expect(draftRows(parsed.data.items)).toEqual(draft.occasions);
  });

  it("refuses what is not a well-formed draft instead of zeroing it", () => {
    const bad: unknown[] = [
      { items: [] },
      { items: "dva jaja" },
      {},
      { items: [{ naziv: "", grami: 100, kcal: 10, protein_g: 1, uh_g: 1, mast_g: 1 }] },
      {
        items: [
          { naziv: "Jaja", grami: 0, kcal: 10, protein_g: 1, uh_g: 1, mast_g: 1 },
        ],
      },
      {
        items: [
          {
            naziv: "Jaja",
            grami: 120,
            kcal: 99999,
            protein_g: 1,
            uh_g: 1,
            mast_g: 1,
          },
        ],
      },
      {
        items: Array.from({ length: 9 }, () => ({
          naziv: "Jaje",
          grami: 60,
          kcal: 90,
          protein_g: 8,
          uh_g: 1,
          mast_g: 6,
        })),
      },
    ];
    for (const body of bad) {
      expect(agentDraftConfirmSchema.safeParse(body).success).toBe(false);
    }
  });

  it("defaults the fields a client may legitimately omit", () => {
    const parsed = agentDraftConfirmSchema.safeParse({
      items: [
        { naziv: "Krastavac", grami: 150, kcal: 24, protein_g: 1, uh_g: 5, mast_g: 0 },
      ],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.items[0].varijansa).toBe("srednja");
    expect(parsed.data.items[0].kolicina).toBe("");
    // No occasion tag = its own occasion, which is one row.
    expect(draftRows(parsed.data.items)).toHaveLength(1);
  });
});

describe("portion chips on a drafted item", () => {
  const burek: AgentDraftItem = {
    naziv: "Burek",
    kolicina: "parče",
    grami: 250,
    kcal: 700,
    protein_g: 18,
    uh_g: 62,
    mast_g: 42,
    varijansa: "visoka",
    grupa: 0,
  };

  it("rescales grams and macros together and keeps the occasion", () => {
    const smaller = scaleDraftItem(burek, "malo");
    expect(smaller.grami).toBe(150);
    expect(smaller.kcal).toBe(420);
    expect(smaller.grupa).toBe(0);
    expect(smaller.varijansa).toBe("visoka");
  });

  it("never drifts, because every tap scales the ORIGINAL item", () => {
    const there = scaleDraftItem(burek, "veliko");
    const back = scaleDraftItem(burek, "normalno");
    expect(there.kcal).toBe(1120);
    expect(back).toEqual(burek);
  });

  it("a rescaled item still passes the confirm boundary and moves the total", () => {
    const scaled = scaleDraftItem(burek, "malo");
    const parsed = agentDraftConfirmSchema.safeParse({ items: [scaled] });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(draftFromItems(parsed.data.items).totalKcal).toBe(420);
  });
});
