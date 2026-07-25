/**
 * Turns the raw export object (`collectUserExport`) into the readable report
 * the PDF renders: Serbian labels, formatted dates and numbers, newest first.
 *
 * Pure and framework-free on purpose -- the PDF component then only lays out
 * strings, so every formatting decision here is unit-testable without
 * rendering a document.
 */

import type { UserExport } from "@/lib/export/user-data";

const BELGRADE_TZ = "Europe/Belgrade";

/** How many rows of each list the report prints. A GDPR export must be
 * complete, and it is -- the JSON download carries every row. The PDF is the
 * readable companion, so it stops at a length a person can actually look
 * through instead of running to hundreds of pages; the cut is stated in the
 * section itself, never silent. */
export const PDF_ROW_LIMIT = 200;

export interface ReportField {
  label: string;
  value: string;
}

export interface ReportTable {
  title: string;
  columns: string[];
  /** Column alignment -- numbers read better right-aligned. */
  numeric: boolean[];
  rows: string[][];
  /** Set when the underlying list was longer than `PDF_ROW_LIMIT`. */
  truncatedNote?: string;
  /** Shown instead of the table when there is nothing to print. */
  emptyNote?: string;
}

export interface ReportModel {
  generatedAt: string;
  account: ReportField[];
  profile: ReportField[];
  plan: ReportField[];
  tables: ReportTable[];
  /** Categories that could not be included (see `UserExport.missing_sections`). */
  missingNote: string | null;
}

// --- formatting ---------------------------------------------------------

function formatDateTime(iso: unknown): string {
  if (typeof iso !== "string") return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BELGRADE_TZ,
  }).format(date);
}

function formatDate(value: unknown): string {
  if (typeof value !== "string") return "—";
  // Bare `date` columns ("2026-07-15") must not be shifted by a timezone --
  // they are already calendar days, so they are reformatted textually.
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (bare) return `${bare[3]}.${bare[2]}.${bare[1]}.`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: BELGRADE_TZ,
  }).format(date);
}

function formatNumber(value: unknown, digits = 0): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("sr-RS", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

const SEX_SR: Record<string, string> = { male: "muški", female: "ženski" };

const ACTIVITY_SR: Record<string, string> = {
  sedentary: "sedeći način života",
  light: "lagana aktivnost",
  moderate: "umerena aktivnost",
  active: "aktivan/na",
  very_active: "veoma aktivan/na",
};

const GOAL_SR: Record<string, string> = {
  lose: "smršati",
  gain: "nabaciti mišiće",
  maintain: "održavanje",
  tone: "zategnuti se",
};

/** Reads a property off an unknown row without `any`. */
function field(row: unknown, key: string): unknown {
  if (typeof row !== "object" || row === null) return undefined;
  return (row as Record<string, unknown>)[key];
}

function asRows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Newest first, by whichever timestamp/day column the table carries. */
function sortNewestFirst(rows: unknown[], key: string): unknown[] {
  return [...rows].sort((a, b) =>
    String(field(b, key) ?? "").localeCompare(String(field(a, key) ?? ""))
  );
}

function buildTable(
  title: string,
  columns: string[],
  numeric: boolean[],
  rows: string[][],
  emptyNote: string
): ReportTable {
  const limited = rows.slice(0, PDF_ROW_LIMIT);
  return {
    title,
    columns,
    numeric,
    rows: limited,
    truncatedNote:
      rows.length > PDF_ROW_LIMIT
        ? `Prikazano je najnovijih ${PDF_ROW_LIMIT} od ukupno ${rows.length}. Ceo spisak je u .json izvozu.`
        : undefined,
    emptyNote: rows.length === 0 ? emptyNote : undefined,
  };
}

// --- model --------------------------------------------------------------

export function buildReportModel(data: UserExport): ReportModel {
  const profile = data.profile ?? {};
  const targets = sortNewestFirst(asRows(data.targets), "effective_from");
  const currentTarget = targets[0];

  const birthYear = field(profile, "birth_year");
  const age =
    typeof birthYear === "number"
      ? new Date().getFullYear() - birthYear
      : undefined;

  const account: ReportField[] = [
    { label: "Email", value: data.account.email ?? "—" },
    { label: "Nalog otvoren", value: formatDate(field(profile, "created_at")) },
  ];

  const profileFields: ReportField[] = [
    {
      label: "Pol",
      value: SEX_SR[String(field(profile, "sex"))] ?? "—",
    },
    { label: "Godine", value: age !== undefined ? String(age) : "—" },
    { label: "Visina", value: `${formatNumber(field(profile, "height_cm"))} cm` },
    { label: "Težina", value: `${formatNumber(field(profile, "weight_kg"), 1)} kg` },
    {
      label: "Aktivnost",
      value: ACTIVITY_SR[String(field(profile, "activity_level"))] ?? "—",
    },
  ];

  const plan: ReportField[] = currentTarget
    ? [
        {
          label: "Cilj",
          value: GOAL_SR[String(field(currentTarget, "goal"))] ?? "—",
        },
        {
          label: "Dnevni unos",
          value: `${formatNumber(field(currentTarget, "daily_kcal"))} kcal`,
        },
        {
          label: "Proteini",
          value: `${formatNumber(field(currentTarget, "protein_g"))} g`,
        },
        {
          label: "Ugljeni hidrati",
          value: `${formatNumber(field(currentTarget, "carbs_g"))} g`,
        },
        { label: "Masti", value: `${formatNumber(field(currentTarget, "fat_g"))} g` },
        {
          label: "Plan važi od",
          value: formatDate(field(currentTarget, "effective_from")),
        },
      ]
    : [];

  // --- habits: name + how many days it was checked ---
  const habitChecks = asRows(data.habitChecks);
  const checksPerHabit = new Map<string, number>();
  for (const row of habitChecks) {
    const id = String(field(row, "habit_id") ?? "");
    checksPerHabit.set(id, (checksPerHabit.get(id) ?? 0) + 1);
  }

  const habitRows = data.rules.map((rule) => [
    rule.textSr,
    rule.enabled ? "da" : "ne",
    formatNumber(checksPerHabit.get(rule.id) ?? 0),
  ]);

  const logRows = sortNewestFirst(asRows(data.logs), "logged_at").map((row) => [
    formatDateTime(field(row, "logged_at")),
    String(field(row, "name") ?? "—"),
    formatNumber(field(row, "grams")),
    formatNumber(field(row, "kcal")),
    formatNumber(field(row, "protein"), 1),
    formatNumber(field(row, "carbs"), 1),
    formatNumber(field(row, "fat"), 1),
  ]);

  const weighInRows = sortNewestFirst(asRows(data.weighIns), "day").map((row) => [
    formatDate(field(row, "day")),
    formatNumber(field(row, "weight_kg"), 1),
  ]);

  const waterRows = sortNewestFirst(asRows(data.waterIntake), "day").map((row) => [
    formatDate(field(row, "day")),
    formatNumber(field(row, "ml")),
  ]);

  const stepRows = sortNewestFirst(asRows(data.stepCounts), "day").map((row) => [
    formatDate(field(row, "day")),
    formatNumber(field(row, "steps")),
  ]);

  const planHistoryRows = targets.map((row) => [
    formatDate(field(row, "effective_from")),
    GOAL_SR[String(field(row, "goal"))] ?? "—",
    formatNumber(field(row, "daily_kcal")),
    formatNumber(field(row, "protein_g")),
    formatNumber(field(row, "carbs_g")),
    formatNumber(field(row, "fat_g")),
  ]);

  const missing = Array.isArray(data.missing_sections)
    ? data.missing_sections
    : [];

  return {
    generatedAt: formatDateTime(data.exported_at),
    account,
    profile: profileFields,
    plan,
    missingNote:
      missing.length > 0
        ? `Nije bilo moguće uključiti: ${missing.join(", ")}.`
        : null,
    tables: [
      buildTable(
        "Navike",
        ["Navika", "Pratim", "Čekirano (dana)"],
        [false, false, true],
        habitRows,
        "Još uvek nemaš navike."
      ),
      buildTable(
        "Unosi hrane",
        ["Kada", "Šta", "g", "kcal", "P", "UH", "M"],
        [false, false, true, true, true, true, true],
        logRows,
        "Nema unetih obroka."
      ),
      buildTable(
        "Merenja težine",
        ["Datum", "kg"],
        [false, true],
        weighInRows,
        "Nema unetih merenja."
      ),
      buildTable(
        "Unos vode",
        ["Datum", "ml"],
        [false, true],
        waterRows,
        "Nema unete vode."
      ),
      buildTable(
        "Koraci",
        ["Datum", "Koraci"],
        [false, true],
        stepRows,
        "Nema unetih koraka."
      ),
      buildTable(
        "Istorija plana",
        ["Važi od", "Cilj", "kcal", "P (g)", "UH (g)", "M (g)"],
        [false, false, true, true, true, true],
        planHistoryRows,
        "Nema izmena plana."
      ),
    ],
  };
}
