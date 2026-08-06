import { describe, expect, it } from "vitest";

import {
  COMBINED_LABEL_PROMPT,
  COMBINED_PROMPT,
} from "@/lib/ai/combined-estimate";
import { GRIC_PROMPT } from "@/lib/ai/gric-estimate";
import { LABEL_PROMPT } from "@/lib/ai/label-estimate";
import { MEAL_PROMPT } from "@/lib/ai/meal-estimate";
import {
  HIDDEN_FAT_COMPACT,
  HIDDEN_FAT_RULES,
  NUTRITION_ANCHORS,
} from "@/lib/ai/nutrition-anchors";
import {
  PRIZMA_ANALYZE_LABEL_PROMPT,
  PRIZMA_ANALYZE_PROMPT,
  PRIZMA_FINALIZE_LABEL_PROMPT,
  PRIZMA_FINALIZE_PROMPT,
} from "@/lib/ai/prizma";
import { VOICE_PROMPT } from "@/lib/ai/voice-estimate";

// These are wiring tests, not behaviour tests: they cannot prove the model
// counts oil correctly, only that every prompt which SHOULD carry the fat
// rules does, and that no prompt which shouldn't. That distinction is the
// whole feature -- the rules were Prizma-only, so the three flows most meals
// actually go through under-counted fried food by construction, while the
// label flows must stay untouched or they double-count.

describe("hidden-fat rules reach the estimating flows", () => {
  const inferring: [string, string][] = [
    ["MEAL_PROMPT (Slikaj obrok)", MEAL_PROMPT],
    ["COMBINED_PROMPT (slika + opis)", COMBINED_PROMPT],
    ["VOICE_PROMPT (Reci obrok)", VOICE_PROMPT],
  ];

  it.each(inferring)("%s carries the hidden-fat rules", (_name, prompt) => {
    expect(prompt).toContain(HIDDEN_FAT_RULES);
  });

  it.each(inferring)("%s carries the reference numbers", (_name, prompt) => {
    expect(prompt).toContain(NUTRITION_ANCHORS);
  });

  it("Gric carries the compact version, not the component-based one", () => {
    // Gric items are flat -- there is no `komponente` array to hold a separate
    // oil line -- so the fat has to land inside the item's own kcal.
    expect(GRIC_PROMPT).toContain(HIDDEN_FAT_COMPACT);
    expect(GRIC_PROMPT).not.toContain(HIDDEN_FAT_RULES);
  });
});

describe("label flows are left alone", () => {
  // A declared value already contains every gram of fat in the product. Adding
  // cooking oil on top of it would double-count the very thing this feature
  // exists to stop under-counting.
  const labelPrompts: [string, string][] = [
    ["LABEL_PROMPT", LABEL_PROMPT],
    ["COMBINED_LABEL_PROMPT", COMBINED_LABEL_PROMPT],
    ["PRIZMA_ANALYZE_LABEL_PROMPT", PRIZMA_ANALYZE_LABEL_PROMPT],
    ["PRIZMA_FINALIZE_LABEL_PROMPT", PRIZMA_FINALIZE_LABEL_PROMPT],
  ];

  it.each(labelPrompts)("%s has no hidden-fat rules", (_name, prompt) => {
    expect(prompt).not.toContain(HIDDEN_FAT_RULES);
    expect(prompt).not.toContain(HIDDEN_FAT_COMPACT);
  });
});

describe("Prizma keeps the anchors but not the inference rules", () => {
  // Prizma ASKS how the food was cooked (`PREP_HINTS` in `portion.ts`), so it
  // is never guessing. Handing it a rule that says "infer the fat and break
  // ties upward" would let a guess argue with the user's own one-tap answer.
  it("still has the reference numbers it always had", () => {
    expect(PRIZMA_ANALYZE_PROMPT).toContain(NUTRITION_ANCHORS);
    expect(PRIZMA_FINALIZE_PROMPT).toContain(NUTRITION_ANCHORS);
  });

  it("does not take the inference rules", () => {
    expect(PRIZMA_ANALYZE_PROMPT).not.toContain(HIDDEN_FAT_RULES);
    expect(PRIZMA_FINALIZE_PROMPT).not.toContain(HIDDEN_FAT_RULES);
  });
});

describe("the rules say the things that keep the number honest", () => {
  it("makes cooking fat its own component, so the user can strike it", () => {
    expect(HIDDEN_FAT_RULES).toContain("ZASEBNA komponenta");
  });

  it("forbids counting the same fat twice", () => {
    // Without this, a model told to "always add oil" adds a second helping on
    // top of an already-fried reference value (pomfrit is 310 kcal/100 g
    // BECAUSE of the oil) and lands ~200 kcal high.
    expect(HIDDEN_FAT_RULES).toContain("MAST SE BROJI SAMO JEDNOM");
    expect(HIDDEN_FAT_COMPACT).toContain("NE dodaj ulje");
  });

  it("scopes the upward tie-break to the fat alone", () => {
    // The asymmetry is real for hidden fat and only for hidden fat. Applied to
    // the whole meal it would just be a concealed multiplier.
    expect(HIDDEN_FAT_RULES).toContain("Ovo važi SAMO za mast");
  });

  it("stops the rule at food nobody cooked", () => {
    // Mirrors `NO_PREP_HINT` in `portion.ts`: a prompt that insists on cooking
    // fat will invent a spoonful of oil under a scoop of ice cream.
    expect(HIDDEN_FAT_RULES).toContain("sladoled");
    expect(HIDDEN_FAT_COMPACT).toContain("jogurt");
  });
});
