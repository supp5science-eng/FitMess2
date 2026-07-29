// Data-layer copy: strings that pure `lib/**` logic used to return pre-baked in
// Serbian (nutrient names, the health-score band label + note, weekday
// abbreviations, activity levels). The logic still returns its Serbian value
// for its own unit tests; it now ALSO returns a stable message KEY that the
// rendering component resolves through `t()`, so these switch language too.

export const dataMessages = {
  sr: {
    // Micronutrient names (lib/nutrition/micro.ts MICRO_SPECS)
    "micro.protein": "Proteini",
    "micro.fiber": "Vlakna",
    "micro.sugar": "Šećer",
    "micro.sodium": "So",
    "micro.satFat": "Zasićene masti",

    // Health-score band label (lib/nutrition/health-score.ts)
    "score.band.excellent": "Odlično",
    "score.band.veryGood": "Vrlo dobro",
    "score.band.good": "Dobro",
    "score.band.couldBeBetter": "Može bolje",
    "score.band.room": "Ima prostora",

    // Health-score one-line note
    "score.note.balanced": "Nastavi tako — dan izgleda uravnoteženo.",
    "score.note.protein":
      "Najviše bi pomoglo malo više proteina u ostatku dana.",
    "score.note.fiber": "Dodaj vlakna — povrće, voće sa korom, integralno.",
    "score.note.sugar":
      "Šećera je danas više nego obično; nije problem, samo znaj.",
    "score.note.sodium":
      "Slano je danas naglašeno — pij vodu i olakšaj sledeći obrok.",
    "score.note.satFat":
      "Zasićenih masti je danas više; sutra biraj mršavije izvore.",
    "score.note.naFewMeals":
      "Unesi par obroka pa ćemo izračunati ocenu za danas — gleda koliko je hrana bila kvalitetna, ne koliko je bilo kalorija.",
    "score.note.naLowCoverage":
      "Za veći deo današnjih unosa nemamo podatke o vlaknima, šećeru i soli, pa ocenu ne prikazujemo.",
    "score.note.naNotEnough": "Još nemamo dovoljno podataka za ocenu.",

    // Weekday abbreviations, Mon..Sun (lib/home/date-strip.ts)
    "dow.short": "Pon Uto Sre Čet Pet Sub Ned",

    // Activity levels (lib/onboarding/types.ts ACTIVITY_LEVEL_OPTIONS)
    "activity.sedentary": "Sedentaran",
    "activity.light": "Lagana aktivnost",
    "activity.moderate": "Umerena aktivnost",
    "activity.active": "Aktivan",
    "activity.veryActive": "Veoma aktivan",
    "activity.sedentary.desc": "Malo ili nimalo vežbanja, pretežno sedenje.",
    "activity.light.desc": "Lagane aktivnosti ili vežbanje 1-3x nedeljno.",
    "activity.moderate.desc": "Umereno vežbanje 3-5x nedeljno.",
    "activity.active.desc": "Intenzivno vežbanje 6-7x nedeljno.",
    "activity.veryActive.desc": "Fizički posao ili trening dva puta dnevno.",
    "onboarding.activity.title": "Koliko si aktivan/aktivna?",
    "onboarding.activity.subtitle":
      "Izaberi opciju koja najbolje opisuje tvoju nedelju.",
    "onboarding.activity.legend": "Nivo aktivnosti",
  },
  en: {
    "micro.protein": "Protein",
    "micro.fiber": "Fiber",
    "micro.sugar": "Sugar",
    "micro.sodium": "Salt",
    "micro.satFat": "Saturated fat",

    "score.band.excellent": "Excellent",
    "score.band.veryGood": "Very good",
    "score.band.good": "Good",
    "score.band.couldBeBetter": "Could be better",
    "score.band.room": "Room to improve",

    "score.note.balanced": "Keep it up — your day looks balanced.",
    "score.note.protein":
      "A little more protein through the rest of the day would help most.",
    "score.note.fiber":
      "Add some fiber — vegetables, fruit with the skin, whole grains.",
    "score.note.sugar":
      "Sugar's a bit higher than usual today; no problem, just so you know.",
    "score.note.sodium":
      "Salt is on the high side today — drink water and go lighter next meal.",
    "score.note.satFat":
      "Saturated fat is a bit high today; pick leaner sources tomorrow.",
    "score.note.naFewMeals":
      "Log a couple of meals and we'll work out today's score — it looks at how good the food was, not how many calories.",
    "score.note.naLowCoverage":
      "We're missing fiber, sugar and salt data for most of today's entries, so we're not showing a score.",
    "score.note.naNotEnough": "Not enough data yet to score today.",

    "dow.short": "Mon Tue Wed Thu Fri Sat Sun",

    "activity.sedentary": "Sedentary",
    "activity.light": "Lightly active",
    "activity.moderate": "Moderately active",
    "activity.active": "Active",
    "activity.veryActive": "Very active",
    "activity.sedentary.desc": "Little or no exercise, mostly sitting.",
    "activity.light.desc": "Light activity or exercise 1-3x a week.",
    "activity.moderate.desc": "Moderate exercise 3-5x a week.",
    "activity.active.desc": "Intense exercise 6-7x a week.",
    "activity.veryActive.desc": "Physical job or training twice a day.",
    "onboarding.activity.title": "How active are you?",
    "onboarding.activity.subtitle":
      "Pick the option that best describes your week.",
    "onboarding.activity.legend": "Activity level",
  },
} as const;
