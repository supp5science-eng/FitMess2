// Translation fragment for Trening (`/dodaj/trening`, the `/danas` card, the
// "+" menu row). `sr` is the source-of-truth key set; `en` mirrors it exactly.
// Interpolation placeholders ({kcal}, {min}, ...) are identical across locales.
//
// Tone note: this surface reports EFFORT, never allowance. Every string here is
// written so that no reading of it suggests the burned calories may be eaten
// back -- the plan already pays for training through the activity multiplier,
// and the weekly weigh-in is what corrects it. `trening.note.plan` says so out
// loud on purpose: it is the one sentence keeping this screen honest.
export const treningMessages = {
  sr: {
    // Activity catalog (src/lib/workout/activities.ts)
    "workout.activity.teretana": "Teretana",
    "workout.activity.hodanje": "Hodanje",
    "workout.activity.trcanje": "Trčanje",
    "workout.activity.bicikl": "Bicikl",
    "workout.activity.kodKuce": "Trening kod kuće",
    "workout.activity.sipke": "Street workout",
    "workout.activity.hiit": "HIIT",
    "workout.activity.fudbal": "Fudbal",
    "workout.activity.kosarka": "Košarka",
    "workout.activity.tenis": "Tenis",
    "workout.activity.odbojka": "Odbojka",
    "workout.activity.plivanje": "Plivanje",
    "workout.activity.borilacki": "Borilački sport",
    "workout.activity.grupni": "Grupni trening",
    "workout.activity.joga": "Joga i pilates",
    "workout.activity.planinarenje": "Planinarenje",
    "workout.activity.veslanje": "Veslanje",
    "workout.activity.fizickiPosao": "Fizički posao",
    "workout.activity.ostalo": "Nešto drugo",
    /** Shown for a stored key the catalog no longer knows. */
    "workout.activity.unknown": "Aktivnost",

    // Intensity
    "workout.intensity.lako": "Lako",
    "workout.intensity.srednje": "Srednje",
    "workout.intensity.jako": "Jako",
    // Described by what you'd feel LOOKING BACK at the session, which is when
    // it gets logged. The old wording ("mogu da pričam bez problema") was the
    // textbook talk test -- accurate, but it asks about a moment that has
    // already passed and reads like a quiz.
    "workout.intensity.lakoDesc": "Bez znoja, mogao sam još dugo",
    "workout.intensity.srednjeDesc": "Oznojio sam se, ali sam držao tempo",
    "workout.intensity.jakoDesc": "Dao sam sve, jedva do kraja",

    // The /danas card + the "+" menu row
    "trening.card.label": "Trening",
    "trening.card.empty": "Danas ništa",
    "trening.card.kcal": "{kcal} kcal",
    "trening.card.minutes": "{minutes} min kretanja",
    "trening.card.breakdown":
      "Mirovanje {resting} + trening {training} = {total} kcal danas",
    "trening.addSheet.desc": "Teretana, trčanje, fudbal…",

    // /dodaj/trening
    "trening.title": "Trening",
    "trening.pick": "Šta si radio?",
    "trening.change": "Promeni",
    "trening.howLong": "Koliko dugo?",
    "trening.howHard": "Koliko jako?",
    "trening.minutes": "min",
    "trening.minusAria": "Skrati za {n} minuta",
    "trening.plusAria": "Produži za {n} minuta",
    "trening.inputAria": "Trajanje u minutima",
    "trening.save": "Sačuvaj trening",
    "trening.saving": "Čuvam…",
    "trening.saveFailed": "Nismo uspeli da sačuvamo trening. Pokušaj ponovo.",
    "trening.deleteFailed": "Nismo uspeli da obrišemo trening. Pokušaj ponovo.",
    "trening.deleteAria": "Obriši {activity}",
    "trening.burn": "≈ {kcal} kcal",

    // Today's list + breakdown
    "trening.today": "Danas",
    "trening.empty": "Danas još nisi upisao nijedan trening.",
    "trening.sessionLine": "{minutes} min · {intensity}",
    "trening.spent": "Potrošeno danas",
    "trening.resting": "Mirovanje (BMR)",
    "trening.fromTraining": "Trening",
    "trening.total": "Ukupno",
    "trening.totalMinutes": "{minutes} min kretanja",

    // The honest part
    "trening.note.plan":
      "Ovo ne menja tvoj dnevni cilj. Tvoj plan već računa da treniraš — ako treniraš više nego što plan pretpostavlja, nedeljno merenje to vidi na vagi i samo podigne cilj.",
    "trening.note.estimate":
      "Brojke su procena po tabelama potrošnje i tvojoj kilaži — dobre za poređenje sa sobom, ne za merenje u kaloriju tačno.",
  },
  en: {
    "workout.activity.teretana": "Gym",
    "workout.activity.hodanje": "Walking",
    "workout.activity.trcanje": "Running",
    "workout.activity.bicikl": "Cycling",
    "workout.activity.kodKuce": "Home workout",
    "workout.activity.sipke": "Street workout",
    "workout.activity.hiit": "HIIT",
    "workout.activity.fudbal": "Football",
    "workout.activity.kosarka": "Basketball",
    "workout.activity.tenis": "Tennis",
    "workout.activity.odbojka": "Volleyball",
    "workout.activity.plivanje": "Swimming",
    "workout.activity.borilacki": "Martial arts",
    "workout.activity.grupni": "Group class",
    "workout.activity.joga": "Yoga & pilates",
    "workout.activity.planinarenje": "Hiking",
    "workout.activity.veslanje": "Rowing",
    "workout.activity.fizickiPosao": "Physical work",
    "workout.activity.ostalo": "Something else",
    "workout.activity.unknown": "Activity",

    "workout.intensity.lako": "Easy",
    "workout.intensity.srednje": "Moderate",
    "workout.intensity.jako": "Hard",
    "workout.intensity.lakoDesc": "No sweat, could've kept going",
    "workout.intensity.srednjeDesc": "Worked up a sweat, held the pace",
    "workout.intensity.jakoDesc": "Gave everything, barely finished",

    "trening.card.label": "Workout",
    "trening.card.empty": "Nothing today",
    "trening.card.kcal": "{kcal} kcal",
    "trening.card.minutes": "{minutes} min of movement",
    "trening.card.breakdown":
      "At rest {resting} + training {training} = {total} kcal today",
    "trening.addSheet.desc": "Gym, running, football…",

    "trening.title": "Workout",
    "trening.pick": "What did you do?",
    "trening.change": "Change",
    "trening.howLong": "How long?",
    "trening.howHard": "How hard?",
    "trening.minutes": "min",
    "trening.minusAria": "Shorten by {n} minutes",
    "trening.plusAria": "Extend by {n} minutes",
    "trening.inputAria": "Duration in minutes",
    "trening.save": "Save workout",
    "trening.saving": "Saving…",
    "trening.saveFailed": "We couldn't save your workout. Please try again.",
    "trening.deleteFailed": "We couldn't delete your workout. Please try again.",
    "trening.deleteAria": "Delete {activity}",
    "trening.burn": "≈ {kcal} kcal",

    "trening.today": "Today",
    "trening.empty": "No workouts logged today yet.",
    "trening.sessionLine": "{minutes} min · {intensity}",
    "trening.spent": "Burned today",
    "trening.resting": "At rest (BMR)",
    "trening.fromTraining": "Training",
    "trening.total": "Total",
    "trening.totalMinutes": "{minutes} min of movement",

    "trening.note.plan":
      "This does not change your daily target. Your plan already assumes you train — and if you train more than it assumes, the weekly weigh-in sees it on the scale and raises the target itself.",
    "trening.note.estimate":
      "These figures are estimates from standard burn tables and your body weight — good for comparing against yourself, not accurate to the calorie.",
  },
} as const;
