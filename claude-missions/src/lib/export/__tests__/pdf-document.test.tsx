import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import zlib from "node:zlib";

import { buildReportDocument } from "../pdf-document";
import { buildReportModel } from "../report-model";
import type { UserExport } from "../user-data";

// Renders the actual report. Slower than the pure model tests, but this is the
// only place that proves the document survives a real render -- and, crucially,
// that Serbian letters end up IN the file rather than as boxes: PDF's built-in
// fonts have no č/ć/š/ž/đ, so an unregistered font would silently mangle every
// Serbian word in the export.

const SAMPLE: UserExport = {
  exported_at: "2026-07-25T12:00:00.000Z",
  schema_note: "n/a",
  missing_sections: [],
  account: { id: "u1", email: "marko@fitmess.app" },
  profile: {
    sex: "male",
    birth_year: 1996,
    height_cm: 183,
    weight_kg: 88.4,
    activity_level: "active",
    created_at: "2026-07-17T09:00:00.000Z",
  },
  rules: [
    { id: "povrce", textSr: "Jedi povrće svaki dan.", enabled: true },
    { id: "voda", textSr: "Popij čašu vode pre svakog obroka.", enabled: false },
  ],
  targets: [
    {
      goal: "lose",
      daily_kcal: 2150,
      protein_g: 175,
      carbs_g: 210,
      fat_g: 62,
      effective_from: "2026-07-20T00:00:00.000Z",
    },
  ],
  logs: [
    {
      name: "Ćevapi sa đevrekom",
      grams: 220,
      kcal: 640,
      protein: 38.5,
      carbs: 44.1,
      fat: 32.7,
      logged_at: "2026-07-24T12:30:00.000Z",
    },
  ],
  weighIns: [{ day: "2026-07-24", weight_kg: 88.4 }],
  waterIntake: [{ day: "2026-07-24", ml: 1750 }],
  stepCounts: [{ day: "2026-07-24", steps: 8400 }],
  habitChecks: [{ habit_id: "povrce", day: "2026-07-24" }],
  mealPhotos: [],
} as UserExport;

async function render(data: UserExport = SAMPLE): Promise<Buffer> {
  return renderToBuffer(buildReportDocument(buildReportModel(data)));
}

/** Pulls the ToUnicode CMaps out of a PDF -- they map glyphs back to
 * codepoints, which is what makes the text selectable/searchable and is where
 * a missing diacritic would show up. */
function toUnicodeMaps(pdf: Buffer): string[] {
  const maps: string[] = [];
  const streams = pdf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)endstream/g);

  for (const match of streams) {
    try {
      const inflated = zlib
        .inflateSync(Buffer.from(match[1], "latin1"))
        .toString("latin1");
      if (inflated.includes("beginbfchar") || inflated.includes("beginbfrange")) {
        maps.push(inflated.toUpperCase());
      }
    } catch {
      // Not a deflate stream (or an image) -- skip.
    }
  }

  return maps;
}

describe("DataReportDocument", () => {
  it("test_renders_a_real_pdf_file", async () => {
    const pdf = await render();

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
  }, 30_000);

  it("test_serbian_diacritics_are_embedded_not_dropped", async () => {
    const pdf = await render();
    const maps = toUnicodeMaps(pdf).join("\n");

    // č, ć, š, ž, đ -- if the font failed to register, none of these would be
    // in the file and every Serbian word in the report would be mangled.
    for (const codepoint of ["010D", "0107", "0161", "017E", "0111"]) {
      expect(maps).toContain(codepoint);
    }
  }, 30_000);

  it("test_the_font_is_embedded_so_the_file_renders_the_same_everywhere", async () => {
    const pdf = await render();
    // A subsetted TrueType font travels inside the file; without this the
    // report would depend on whatever font the reader's device happens to have.
    expect(pdf.toString("latin1")).toContain("FontFile2");
  }, 30_000);

  it("test_a_user_with_no_data_still_produces_a_valid_report", async () => {
    const empty = {
      ...SAMPLE,
      profile: null,
      rules: [],
      targets: [],
      logs: [],
      weighIns: [],
      waterIntake: [],
      stepCounts: [],
      habitChecks: [],
    } as unknown as UserExport;

    const pdf = await render(empty);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30_000);
});
