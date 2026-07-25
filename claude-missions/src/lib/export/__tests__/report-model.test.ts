import { describe, expect, it } from "vitest";

import { buildReportModel, PDF_ROW_LIMIT } from "../report-model";
import type { UserExport } from "../user-data";

// The readable model behind the PDF report: Serbian labels, formatted values,
// newest first. Pure -- no document is rendered here.

function makeExport(overrides: Partial<UserExport> = {}): UserExport {
  return {
    exported_at: "2026-07-25T12:00:00.000Z",
    schema_note: "note",
    missing_sections: [],
    account: { id: "user-1", email: "marko@fitmess.app" },
    profile: {
      user_id: "user-1",
      sex: "male",
      birth_year: new Date().getFullYear() - 30,
      height_cm: 183,
      weight_kg: 88.4,
      activity_level: "active",
      created_at: "2026-07-17T09:00:00.000Z",
    },
    rules: [
      { id: "povrce", textSr: "Jedi povrće svaki dan.", enabled: true },
      { id: "voda", textSr: "Popij čašu vode pre obroka.", enabled: false },
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
      {
        goal: "maintain",
        daily_kcal: 2600,
        protein_g: 160,
        carbs_g: 300,
        fat_g: 80,
        effective_from: "2026-07-17T00:00:00.000Z",
      },
    ],
    logs: [
      {
        name: "Pileća prsa",
        grams: 180,
        kcal: 297,
        protein: 55.8,
        carbs: 0,
        fat: 6.4,
        logged_at: "2026-07-24T12:30:00.000Z",
      },
      {
        name: "Jabuka",
        grams: 150,
        kcal: 78,
        protein: 0.4,
        carbs: 20.7,
        fat: 0.3,
        logged_at: "2026-07-25T08:00:00.000Z",
      },
    ],
    weighIns: [{ day: "2026-07-24", weight_kg: 88.4 }],
    waterIntake: [{ day: "2026-07-24", ml: 1750 }],
    stepCounts: [{ day: "2026-07-24", steps: 8400 }],
    habitChecks: [
      { habit_id: "povrce", day: "2026-07-24" },
      { habit_id: "povrce", day: "2026-07-23" },
      { habit_id: "voda", day: "2026-07-23" },
    ],
    mealPhotos: [],
    ...overrides,
  } as UserExport;
}

function tableNamed(model: ReturnType<typeof buildReportModel>, title: string) {
  const table = model.tables.find((entry) => entry.title === title);
  if (!table) throw new Error(`no table titled ${title}`);
  return table;
}

describe("buildReportModel: account, profile and plan", () => {
  it("test_translates_profile_codes_into_serbian", () => {
    const model = buildReportModel(makeExport());

    expect(model.profile).toContainEqual({ label: "Pol", value: "muški" });
    expect(model.profile).toContainEqual({
      label: "Aktivnost",
      value: "aktivan/na",
    });
    expect(model.profile).toContainEqual({ label: "Godine", value: "30" });
  });

  it("test_the_current_plan_is_the_newest_target_not_the_first_row", () => {
    const model = buildReportModel(makeExport());

    expect(model.plan).toContainEqual({ label: "Cilj", value: "smršati" });
    expect(model.plan).toContainEqual({
      label: "Dnevni unos",
      value: "2.150 kcal",
    });
  });

  it("test_a_user_without_a_plan_gets_no_plan_section_rather_than_dashes", () => {
    const model = buildReportModel(makeExport({ targets: [] }));
    expect(model.plan).toEqual([]);
  });

  it("test_missing_profile_fields_render_as_a_dash_not_nan", () => {
    const model = buildReportModel(makeExport({ profile: null }));

    expect(model.profile).toContainEqual({ label: "Pol", value: "—" });
    expect(model.profile).toContainEqual({ label: "Godine", value: "—" });
    expect(JSON.stringify(model.profile)).not.toMatch(/NaN|undefined|null/);
  });
});

describe("buildReportModel: tables", () => {
  it("test_food_log_rows_are_newest_first", () => {
    const logs = tableNamed(buildReportModel(makeExport()), "Unosi hrane");

    expect(logs.rows[0][1]).toBe("Jabuka"); // 25.07.
    expect(logs.rows[1][1]).toBe("Pileća prsa"); // 24.07.
  });

  it("test_habits_show_whether_they_are_tracked_and_how_many_days_were_checked", () => {
    const habits = tableNamed(buildReportModel(makeExport()), "Navike");

    expect(habits.rows).toEqual([
      ["Jedi povrće svaki dan.", "da", "2"],
      ["Popij čašu vode pre obroka.", "ne", "1"],
    ]);
  });

  it("test_bare_calendar_days_are_not_shifted_by_a_timezone", () => {
    // `weigh_ins.day` is a bare date -- parsing it as a UTC instant would show
    // "23.07." for someone who weighed in on the 24th.
    const weighIns = tableNamed(buildReportModel(makeExport()), "Merenja težine");
    expect(weighIns.rows[0][0]).toBe("24.07.2026.");
  });

  it("test_an_empty_section_gets_a_serbian_note_instead_of_an_empty_table", () => {
    const model = buildReportModel(makeExport({ logs: [], weighIns: [] }));

    expect(tableNamed(model, "Unosi hrane").emptyNote).toMatch(/Nema unetih obroka/);
    expect(tableNamed(model, "Merenja težine").rows).toEqual([]);
  });

  it("test_a_very_long_log_is_capped_and_says_so_rather_than_cutting_silently", () => {
    const many = Array.from({ length: PDF_ROW_LIMIT + 25 }, (_, index) => ({
      name: `Obrok ${index}`,
      grams: 100,
      kcal: 200,
      protein: 10,
      carbs: 20,
      fat: 5,
      logged_at: `2026-07-${String((index % 28) + 1).padStart(2, "0")}T08:00:00.000Z`,
    }));

    const logs = tableNamed(buildReportModel(makeExport({ logs: many })), "Unosi hrane");

    expect(logs.rows).toHaveLength(PDF_ROW_LIMIT);
    expect(logs.truncatedNote).toMatch(new RegExp(`${PDF_ROW_LIMIT}`));
    expect(logs.truncatedNote).toMatch(/json/i);
  });

  it("test_numbers_are_formatted_for_serbian_readers", () => {
    const logs = tableNamed(buildReportModel(makeExport()), "Unosi hrane");
    // Protein 55.8 -> "55,8" (decimal comma), kcal 297 -> plain integer.
    expect(logs.rows[1][4]).toBe("55,8");
    expect(logs.rows[1][3]).toBe("297");
  });
});

describe("buildReportModel: missing sections", () => {
  it("test_a_missing_section_is_stated_on_the_report", () => {
    const model = buildReportModel(
      makeExport({ missing_sections: ["čekirane navike po danima"] })
    );

    expect(model.missingNote).toMatch(/čekirane navike/);
  });

  it("test_a_healthy_export_has_no_warning", () => {
    expect(buildReportModel(makeExport()).missingNote).toBeNull();
  });
});
