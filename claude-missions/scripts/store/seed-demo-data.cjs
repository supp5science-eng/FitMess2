/**
 * Fills the store reviewers' demo account with a believable recent history.
 *
 *   node scripts/store/seed-demo-data.cjs            # last 35 days, ending today
 *   node scripts/store/seed-demo-data.cjs --days=14
 *   node scripts/store/seed-demo-data.cjs --dry      # print, write nothing
 *
 * **Run this again right before each submission, and once during review.**
 * That is the whole reason it is a script and not a one-off pile of INSERTs: a
 * demo account goes stale by the calendar, not by anything anyone does to it.
 * A reviewer who opens FitMess two weeks after the data was written lands on an
 * empty Početna and cannot tell "nothing logged" from "broken" — and neither
 * can we, from the rejection notice.
 *
 * Everything is keyed off TODAY and everything is deterministic: the same day
 * always generates the same meals, because the pseudo-random source is seeded
 * from the date string. So re-running does not reshuffle a week the
 * screenshots were taken from.
 *
 * Idempotent by construction: the window is deleted and rewritten, never
 * appended to. Only this one account's rows in the chosen window are touched.
 *
 * What it writes: `logs` (meals with full micros), `water_intake`,
 * `step_counts`, `weigh_ins` (weekly), `workouts`, `habit_checks`, and the
 * habit definitions in `profiles.rules`.
 *
 * ---
 *
 * Two things it is deliberately careful about:
 *
 * **Days land NEAR the target, not far under it.** The account it replaced ate
 * 1100-1660 kcal against a 2450 target, every single day. The ring on Početna
 * was therefore always two-thirds empty and "Preostalo" always read ~900 — the
 * app looked like it was failing to record meals. Most days here land at
 * 94-105% of target; a couple deliberately overshoot, because the adaptive plan
 * card has nothing to say about a week with no overshoot in it.
 *
 * **Today is only as full as the hour allows.** Meals are written for slots
 * that have already passed, so a reviewer opening the app at 11:00 sees
 * breakfast and an empty afternoon — not a dinner logged three hours from now.
 */
const fs = require("fs");
const path = require("path");

const DEMO_EMAIL = "supp5science+fitmess-demo@gmail.com";
const ZONE = "Europe/Belgrade";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const DRY = args.includes("--dry");
const DAYS = Number(arg("days", "35"));

// ---------------------------------------------------------------- env + http

function loadEnv() {
  const file = path.resolve(__dirname, "../../.env");
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY;
if (!URL || !KEY) {
  console.error("Fale NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY u .env");
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function rest(pathAndQuery, init = {}) {
  const res = await fetch(`${URL}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  if (!res.ok) {
    throw new Error(`${init.method || "GET"} ${pathAndQuery} -> ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

/** Rows are posted in batches: one 4000-row body is a request PostgREST can
 *  refuse outright, and a partial failure there is far harder to read. */
async function insert(table, rows) {
  if (DRY || rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 200) {
    await rest(table, {
      method: "POST",
      body: JSON.stringify(rows.slice(i, i + 200)),
      headers: { Prefer: "return=minimal" },
    });
  }
}

// ------------------------------------------------------------------- da(y)tes

/** `YYYY-MM-DD` for a date, as read in Belgrade. */
function dayKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Local wall-clock time in Belgrade on `key`, as a UTC instant.
 *
 * Belgrade is +01:00 or +02:00 depending on the date, and hard-coding either
 * one puts every summer meal an hour off — enough to move a 00:30 snack into
 * the previous day and silently drop it from that day's total. So the offset is
 * measured for that actual date instead of assumed. */
function instantAt(key, hour, minute) {
  const naive = Date.UTC(
    Number(key.slice(0, 4)),
    Number(key.slice(5, 7)) - 1,
    Number(key.slice(8, 10)),
    hour,
    minute
  );
  const probe = new Date(naive);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    timeZoneName: "longOffset",
  }).formatToParts(probe);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const [, sign, hh, mm] = /GMT([+-])(\d{2}):(\d{2})/.exec(name) ?? [, "+", "00", "00"];
  const offsetMinutes = (sign === "-" ? -1 : 1) * (Number(hh) * 60 + Number(mm));
  return new Date(naive - offsetMinutes * 60_000);
}

function shiftKey(key, delta) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday .. 6 = Sunday, matching the app's week. */
function weekdayIndex(key) {
  return (new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7;
}

// --------------------------------------------------------------------- random

/** Deterministic per-day randomness: the same date always yields the same
 *  meals, so re-running before a submission does not rewrite the week the
 *  screenshots came from. */
function rng(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (random, list) => list[Math.floor(random() * list.length)];
const between = (random, lo, hi) => lo + random() * (hi - lo);

// ---------------------------------------------------------------------- meals

/** name, grams, kcal, protein, carbs, fat, fiber, sugar, sodium, sat_fat.
 *
 * Serbian home food on purpose — this account is the one a reviewer opens, and
 * a tracker for the Serbian market whose history is chicken-and-broccoli reads
 * as a template someone filled in. The micros are populated because the second
 * page of Početna is built from them; leaving them null shows dashes there, and
 * "null is not 0" means the app would honestly say it does not know. */
const BREAKFAST = [
  ["Ovsena kaša sa bananom i orasima", 340, 520, 18, 72, 17, 9, 22, 120, 3],
  ["Kajgana od 3 jaja sa slaninom i hlebom", 280, 585, 32, 38, 32, 3, 3, 980, 11],
  ["Grčki jogurt sa medom i granolom", 330, 495, 28, 62, 14, 5, 34, 140, 5],
  ["Sendvič sa pršutom i kačkavaljem", 260, 610, 34, 52, 28, 3, 4, 1350, 12],
  ["Palačinke sa džemom", 300, 560, 16, 88, 16, 3, 38, 420, 6],
  ["Burek sa sirom i jogurt", 350, 640, 22, 58, 36, 2, 6, 1180, 15],
];

const LUNCH = [
  ["Pileća šnicla sa pirinčem i salatom", 480, 760, 58, 78, 20, 5, 5, 890, 5],
  ["Sarma sa kiselim kupusom i hlebom", 480, 810, 38, 52, 46, 9, 8, 1620, 17],
  ["Pasulj sa slaninom i hlebom", 500, 780, 34, 86, 30, 16, 9, 1280, 10],
  ["Ćevapi sa lepinjom i lukom", 380, 850, 48, 62, 42, 4, 5, 1480, 16],
  ["Musaka sa mlevenim mesom", 450, 790, 40, 48, 44, 5, 7, 1120, 18],
  ["Punjena paprika sa krompirom", 470, 720, 36, 66, 32, 7, 10, 980, 12],
  ["Karađorđeva šnicla sa pomfritom", 420, 980, 46, 70, 54, 5, 4, 1560, 20],
  ["Riblja čorba i pečena riba", 520, 690, 56, 34, 34, 3, 4, 1240, 6],
];

const DINNER = [
  ["Losos sa krompirom i salatom", 400, 690, 46, 46, 34, 6, 4, 640, 7],
  ["Piletina sa povrćem iz rerne", 430, 620, 52, 38, 26, 7, 8, 720, 5],
  ["Špagete bolonjeze", 400, 780, 36, 88, 28, 6, 10, 860, 10],
  ["Omlet sa povrćem i tost", 300, 590, 34, 40, 30, 4, 5, 780, 9],
  ["Ćureći file sa kus-kusom", 380, 650, 54, 58, 18, 4, 4, 690, 3],
  ["Pica, dva parčeta", 320, 820, 34, 86, 36, 5, 8, 1620, 14],
  ["Tuna salata sa jajima i hlebom", 350, 610, 44, 42, 26, 5, 4, 920, 5],
];

const SNACK = [
  ["Banana i šaka badema", 130, 320, 10, 34, 18, 6, 20, 5, 2],
  ["Grčki jogurt sa medom", 200, 240, 18, 26, 6, 0, 24, 80, 4],
  ["Čokoladica", 45, 235, 3, 26, 13, 1, 24, 60, 7],
  ["Proteinski šejk", 350, 280, 32, 24, 6, 2, 18, 180, 2],
  ["Jabuka i kikiriki puter", 180, 290, 8, 32, 16, 6, 22, 120, 3],
  ["Krofna", 70, 300, 5, 38, 15, 1, 18, 240, 6],
];

/** Which slot each course is eaten in, and how the clock wanders within it. */
const SLOTS = {
  breakfast: [7, 40, 9, 10],
  snack: [16, 0, 17, 30],
  lunch: [12, 50, 14, 20],
  dinner: [19, 20, 20, 50],
};

const DAILY_KCAL = 2450;

/** How close to target a given day aims.
 *
 * Not every day is a good day, and a demo where every day lands on 100% reads
 * as generated — which it is, but it should not look it. Two shapes carry
 * meaning beyond variety: an `over` day is what the adaptive plan card exists
 * to talk about, and a `light` day is what makes the weekly average believable. */
function dayShape(key, random) {
  const weekday = weekdayIndex(key);
  // Saturdays run over. That is when people actually run over.
  if (weekday === 5 && random() < 0.7) return [1.1, 1.2];
  if (random() < 0.12) return [1.06, 1.14];
  if (random() < 0.15) return [0.8, 0.9];
  return [0.94, 1.05];
}

function mealRow(userId, entry, at, method) {
  const [name, grams, kcal, protein, carbs, fat, fiber, sugar, sodium, satFat] = entry;
  return {
    user_id: userId,
    food_id: null,
    name,
    grams,
    kcal,
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodium,
    sat_fat: satFat,
    method,
    logged_at: at.toISOString(),
  };
}

/**
 * One day's meals, chosen so the total lands inside the day's band.
 *
 * Tries whole combinations rather than scaling portions: a "Sarma × 0.83" is
 * not something anyone eats, and the grams are shown on the meal card.
 */
function buildDay(userId, key, now) {
  const random = rng(key);
  const [lo, hi] = dayShape(key, random);
  const min = DAILY_KCAL * lo;
  const max = DAILY_KCAL * hi;

  let chosen = null;
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const courses = [
      ["breakfast", pick(random, BREAKFAST)],
      ["lunch", pick(random, LUNCH)],
      ["dinner", pick(random, DINNER)],
    ];
    if (random() < 0.75) courses.push(["snack", pick(random, SNACK)]);

    const total = courses.reduce((sum, [, entry]) => sum + entry[2], 0);
    if (total >= min && total <= max) {
      chosen = courses;
      break;
    }
    // Keep the closest attempt so a narrow band still produces a day.
    if (!chosen || Math.abs(total - DAILY_KCAL) < Math.abs(chosen.total - DAILY_KCAL)) {
      chosen = Object.assign(courses, { total });
    }
  }

  const rows = [];
  for (const [slot, entry] of chosen) {
    const [h1, m1, h2, m2] = SLOTS[slot];
    const minutes = Math.round(between(random, h1 * 60 + m1, h2 * 60 + m2));
    const at = instantAt(key, Math.floor(minutes / 60), minutes % 60);
    // Today is only as full as the hour allows — no meal in the future.
    if (at.getTime() > now.getTime()) continue;
    // Most meals come from the camera, which is the product's headline; a few
    // from search, so the history does not look like one feature was used.
    rows.push(mealRow(userId, entry, at, random() < 0.75 ? "meal" : "search"));
  }
  return rows;
}

// --------------------------------------------------------------------- habits

/** Habits are defined on the profile (`profiles.rules`) and checked off per day.
 *  Without definitions the Navike screen is empty, which reads as an unfinished
 *  feature rather than an unused one. */
const HABITS = [
  { id: "voda-uz-svaki-obrok", textSr: "Čašu vode uz svaki obrok", enabled: true },
  { id: "bez-slatkog-posle-20", textSr: "Bez slatkog posle 20h", enabled: true },
  { id: "protein-uz-dorucak", textSr: "Protein uz doručak", enabled: true },
];

// ----------------------------------------------------------------------- main

async function main() {
  const now = new Date();
  const todayKey = dayKey(now);
  const firstKey = shiftKey(todayKey, -(DAYS - 1));

  // GoTrue, not PostgREST: the email lives in `auth.users`, which the REST API
  // does not expose. Errors are NOT swallowed here — "account not found" and
  // "the service key is wrong" look identical from the caller, and only one of
  // them is worth changing the email over.
  const usersRes = await fetch(`${URL}/auth/v1/admin/users?per_page=1000`, { headers });
  if (!usersRes.ok) {
    console.error(`Ne mogu da pročitam naloge: ${usersRes.status} ${await usersRes.text()}`);
    process.exit(1);
  }
  const list = (await usersRes.json())?.users ?? [];
  const user = list.find((u) => u.email === DEMO_EMAIL);
  if (!user) {
    console.error(`Ne mogu da nađem nalog ${DEMO_EMAIL}`);
    process.exit(1);
  }
  const userId = user.id;

  console.log(`Demo nalog ${DEMO_EMAIL} (${userId})`);
  console.log(`Prozor: ${firstKey} .. ${todayKey} (${DAYS} dana)${DRY ? "  [DRY]" : ""}`);

  const keys = [];
  for (let i = 0; i < DAYS; i += 1) keys.push(shiftKey(firstKey, i));

  // Wipe the window first. Append would double every meal on a second run, and
  // a demo day with two lunches is worse than no demo at all.
  const fromInstant = instantAt(firstKey, 0, 0).toISOString();
  if (!DRY) {
    await rest(`logs?user_id=eq.${userId}&logged_at=gte.${fromInstant}`, { method: "DELETE" });
    for (const table of ["water_intake", "step_counts", "weigh_ins", "workouts", "habit_checks"]) {
      await rest(`${table}?user_id=eq.${userId}&day=gte.${firstKey}`, { method: "DELETE" });
    }
  }

  const logs = [];
  const water = [];
  const steps = [];
  const weighIns = [];
  const workouts = [];
  const habitChecks = [];

  // Weight walks down towards the 80 kg goal and lands on today's profile
  // value, so the trend chart and the profile agree with each other.
  let weight = 90.4;

  for (const key of keys) {
    const random = rng(`${key}#extras`);
    logs.push(...buildDay(userId, key, now));

    water.push({ user_id: userId, day: key, ml: Math.round(between(random, 1500, 3000) / 250) * 250 });
    steps.push({ user_id: userId, day: key, steps: Math.round(between(random, 5200, 13400)) });

    // Sunday morning on the scale — the app's own weekly rhythm.
    if (weekdayIndex(key) === 6) {
      weight = Math.round((weight - between(random, 0.25, 0.75)) * 10) / 10;
      weighIns.push({ user_id: userId, day: key, weight_kg: weight });
    }

    if (random() < 0.42) {
      const [activity, intensity, minutes, kcal] = pick(random, [
        ["teretana", "srednje", 55, 330],
        ["trcanje", "jako", 35, 400],
        ["hodanje", "lako", 50, 180],
        ["bicikl", "srednje", 45, 350],
      ]);
      workouts.push({ user_id: userId, day: key, activity_key: activity, intensity, minutes, kcal });
    }

    for (const habit of HABITS) {
      // Kept high but not perfect: an unbroken 35-day streak on three habits is
      // the one detail that would make the account read as seeded.
      if (rng(`${key}#${habit.id}`)() < 0.78) {
        habitChecks.push({ user_id: userId, habit_id: habit.id, day: key });
      }
    }
  }

  // The newest weigh-in has to equal `profiles.weight_kg`, or Analitika and
  // Podešavanja quote two different weights for the same body.
  const latestWeight = weighIns.length ? weighIns[weighIns.length - 1].weight_kg : null;

  const perDay = new Map();
  for (const row of logs) {
    const key = dayKey(new Date(row.logged_at));
    perDay.set(key, (perDay.get(key) ?? 0) + row.kcal);
  }
  const totals = [...perDay.values()];
  const avg = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
  console.log(
    `Obroka: ${logs.length} | dnevni prosek ${avg} kcal (cilj ${DAILY_KCAL}, ${Math.round((100 * avg) / DAILY_KCAL)}%)`
  );
  console.log(`Danas (${todayKey}): ${perDay.get(todayKey) ?? 0} kcal`);
  console.log(
    `Voda ${water.length} | koraci ${steps.length} | merenja ${weighIns.length} | treninzi ${workouts.length} | navike ${habitChecks.length}`
  );

  if (DRY) {
    console.log("DRY — ništa nije upisano.");
    return;
  }

  await insert("logs", logs);
  await insert("water_intake", water);
  await insert("step_counts", steps);
  await insert("weigh_ins", weighIns);
  await insert("workouts", workouts);
  await insert("habit_checks", habitChecks);

  await rest(`profiles?user_id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      rules: HABITS,
      ...(latestWeight ? { weight_kg: latestWeight } : {}),
    }),
    headers: { Prefer: "return=minimal" },
  });

  console.log("Upisano.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
