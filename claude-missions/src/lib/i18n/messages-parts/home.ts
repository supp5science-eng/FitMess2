// Translation fragment for the /danas home-screen sub-components (adaptive plan
// card, add sheet, date strip, gric button, health score card, intake pager,
// micro cards, steps card, water button). Merged into the main dictionary
// alongside the base `home.*` keys already in `messages.ts`.
export const homeExtraMessages = {
  sr: {
    // Adaptive plan card
    "home.adaptive.adjusted": "Plan za danas je prilagođen",
    "home.adaptive.regular": "redovni {kcal}",
    "home.adaptive.weekSpent":
      "Ove nedelje potrošeno {spent} od {budget} kcal · još {days} {unit}",
    "home.adaptive.day": "dan",
    "home.adaptive.days": "dana",
    "home.adaptive.lifted":
      "Ranije ove nedelje si uneo manje nego što plan traži, pa je današnji cilj podignut — da nedelja ispuni svoje.",
    "home.adaptive.lowered":
      "Zbog ranijeg prekoračenja, današnji cilj je snižen — da se nedelja vrati na prag.",
    "home.adaptive.carry":
      "Uračunat je i prenos od {kcal} kcal iz prošle nedelje.",
    "home.adaptive.trainingLead": "Ostatak pokrij kretanjem:",
    "home.adaptive.trainingWalk":
      "(≈ {min} min brzog hoda). Cilj koraka danas je",
    "home.adaptive.unchanged": "Plan za danas ostaje isti",
    // "još 1 dan" / "još 4 dana" / "još 5 dana" -- the one phrasing whose
    // grammar holds for every count without a plural engine.
    "home.adaptive.forward":
      "Važi i za još {days} {unit}: {kcal} kcal ({delta}/dan)",
    "home.adaptive.weekdays":
      "ponedeljak utorak sreda četvrtak petak subota nedelja",
    // Dve varijante zbog slaganja: nabroji dva dana pa reci „taj dan" i
    // rečenica se raspada („sreda, četvrtak … taj dan").
    "home.adaptive.untrustedLead":
      "Nisam uračunao: {days} — unos izgleda nepotpuno, pa je taj dan tretiran kao da je odrađen po planu.",
    "home.adaptive.untrustedLeadPlural":
      "Nisam uračunao: {days} — unos izgleda nepotpuno, pa su ti dani tretirani kao da su odrađeni po planu.",
    "home.adaptive.askDay": "Je li {day} stvarno bio dan od {kcal} kcal?",
    "home.adaptive.answerComplete": "Da, bio je lagan dan",
    "home.adaptive.answerPartial": "Nisam sve upisao",

    // Zašto se plan pomerio — imenovan uzrok, ispod rešenja a ne iznad njega.
    // „Juče" ima svoje rečenice: kao prilog ne može da stoji na mestu naziva
    // dana („četvrtak je bio veći" ✓, „juče je bio veći" ✗). Bezlično „uneto"
    // je i rodno neutralno, pa ne mora da bira između „uneo" i „unela".
    "home.adaptive.causeOver": "Razlog: {day} je bio {kcal} kcal veći od plana.",
    "home.adaptive.causeUnder": "Razlog: {day} je bio {kcal} kcal manji od plana.",
    "home.adaptive.causeOverYesterday":
      "Razlog: juče je uneto {kcal} kcal više od plana.",
    "home.adaptive.causeUnderYesterday":
      "Razlog: juče je uneto {kcal} kcal manje od plana.",
    // „Višak", ne „ostatak": red ispod već počinje sa „Ostatak pokrij
    // kretanjem", a to je druga stvar — ovo je deo koji nedelja ne može da
    // proguta, ono je deo koji treba prehodati. Dva „Ostatka" jedan ispod
    // drugog čitaju se kao isti broj rečen dvaput.
    "home.adaptive.spill":
      "Višak od {kcal} kcal ne staje u ovu nedelju — prelazi u sledeću.",
    "home.adaptive.onTrack": "Nedelja ti je u planu",
    // Nosi i „još N dana", jer u ovom stanju kartica NEMA traku ni red o
    // potrošenom — ovo joj je ceo sadržaj.
    "home.adaptive.onTrackRoom":
      "Još {days} {unit} u nedelji — imaš {kcal} kcal više nego što plan traži.",

    // Add sheet
    "home.addSheet.title": "Dodaj unos",
    "home.addSheet.prizmaDesc": "92% tačnost procene kalorija",
    "home.addSheet.badge.mostAccurate": "NAJTAČNIJE",
    "home.addSheet.meal": "Slikaj obrok",
    "home.addSheet.mealDesc": "Jedna slika i gotovo",
    "home.addSheet.badge.fastest": "NAJBRŽE",
    "home.addSheet.gricDesc": "Sitnice — reci ih sve odjednom, bez slikanja",
    "home.addSheet.label": "Slikaj deklaraciju",

    // Date strip
    "home.dateStrip.aria": "Izbor dana",
    "home.dateStrip.monthsShort":
      "jan feb mar apr maj jun jul avg sep okt nov dec",
    "home.dateStrip.today": "Danas, {date}",
    "home.dateStrip.logged": "{date} — uneo si obrok",

    // Gric button
    "home.gric.desc": "Reci šta si grickao — bez slikanja",

    // Health score card
    "home.health.title": "Ocena zdravosti",
    "home.health.ariaScore": "Ocena zdravosti {score} od 10",
    "home.health.ariaUnavailable": "Ocena zdravosti još nije dostupna",

    // Intake pager
    "home.pager.show": "Prikaži: {label}",

    // Micro cards
    "home.micro.noData": "nema podataka",
    "home.micro.aboveGoal": "iznad cilja",
    "home.micro.overLimit": "preko granice",
    "home.micro.remaining": "preostalo",
    "home.micro.goal": "cilj {target}",
    "home.micro.coveragePartial":
      "Podaci pokrivaju ~{percent}% današnjih kalorija — za ostatak još nemamo vlakna, šećer i so.",
    "home.micro.coverageNone":
      "Za današnje unose još nemamo podatke o vlaknima, šećeru i soli.",

    // Shared card copy (steps + water + add sheet)
    "home.close": "Zatvori",
    "home.card.goalReached": "Cilj 🎉",
    "home.card.dailyGoal": "Dnevni cilj: {goal}",
    "home.card.saving": "Čuvanje...",
    "home.card.add": "Dodaj",
    "home.card.remove": "Ukloni",

    // Steps card
    "home.steps.saveFailed":
      "Nismo uspeli da sačuvamo korake. Pokušaj ponovo.",
    "home.steps.preset.short": "Kratka",
    "home.steps.preset.walk": "Šetnja",
    "home.steps.preset.long": "Duga",
    "home.steps.label": "Koraci",
    "home.steps.aria": "Koraci: {total} od {goal}. Dodaj korake.",
    "home.steps.sheetTitle": "Unesi korake",
    "home.steps.minusAria": "Skini {n} koraka (drži za brže)",
    "home.steps.plusAria": "Dodaj {n} koraka (drži za brže)",
    "home.steps.inputAria": "Broj koraka za dodavanje",
    "home.steps.unit": "kor.",
    "home.steps.loggedToday": "Uneseno danas: {steps} koraka",
    "home.steps.totalToday": "Ukupno danas: {steps} koraka",
    "home.steps.editGoal": "Cilj: {goal} · promeni",

    // Water button
    "home.water.saveFailed": "Nismo uspeli da sačuvamo vodu. Pokušaj ponovo.",
    "home.water.preset.glass": "+1 čaša",
    "home.water.preset.bottle": "+1 flaša",
    "home.water.preset.large": "+1 velika flaša",
    "home.water.label": "Voda",
    "home.water.aria": "Voda: {total}. Dodaj vodu.",
    "home.water.ariaWithGoal": "Voda: {total} od {goal}. Dodaj vodu.",
    "home.water.sheetTitle": "Unesi vodu",
    "home.water.minusAria": "Skini {n} mL",
    "home.water.plusAria": "Dodaj {n} mL",
    "home.water.inputAria": "Količina vode u mililitrima",
    "home.water.loggedToday": "Uneseno: {total}",
    "home.water.totalToday": "Ukupno danas: {total}",
  },
  en: {
    // Adaptive plan card
    "home.adaptive.adjusted": "Today's plan is adjusted",
    "home.adaptive.regular": "regular {kcal}",
    "home.adaptive.weekSpent":
      "This week you've used {spent} of {budget} kcal · {days} {unit} left",
    "home.adaptive.day": "day",
    "home.adaptive.days": "days",
    "home.adaptive.lifted":
      "Earlier this week you ate less than the plan calls for, so today's goal is raised — to let the week even out.",
    "home.adaptive.lowered":
      "Because of an earlier overshoot, today's goal is lowered — to bring the week back to target.",
    "home.adaptive.carry":
      "It also includes a carryover of {kcal} kcal from last week.",
    "home.adaptive.trainingLead": "Cover the rest with movement:",
    "home.adaptive.trainingWalk":
      "(≈ {min} min of brisk walking). Today's step goal is",
    "home.adaptive.unchanged": "Today's plan stays the same",
    "home.adaptive.forward":
      "Holds for {days} more {unit}: {kcal} kcal ({delta}/day)",
    "home.adaptive.weekdays":
      "Monday Tuesday Wednesday Thursday Friday Saturday Sunday",
    "home.adaptive.untrustedLead":
      "Left out: {days} — the log looks incomplete, so that day was counted as if it went to plan.",
    "home.adaptive.untrustedLeadPlural":
      "Left out: {days} — the logs look incomplete, so those days were counted as if they went to plan.",
    "home.adaptive.askDay": "Was {day} really a {kcal} kcal day?",
    "home.adaptive.answerComplete": "Yes, it was a light day",
    "home.adaptive.answerPartial": "I didn't log it all",

    "home.adaptive.causeOver": "Why: {day} came in {kcal} kcal over plan.",
    "home.adaptive.causeUnder": "Why: {day} came in {kcal} kcal under plan.",
    "home.adaptive.causeOverYesterday":
      "Why: yesterday came in {kcal} kcal over plan.",
    "home.adaptive.causeUnderYesterday":
      "Why: yesterday came in {kcal} kcal under plan.",
    "home.adaptive.spill":
      "The remaining {kcal} kcal doesn't fit in this week — it rolls into next.",
    "home.adaptive.onTrack": "Your week is on plan",
    "home.adaptive.onTrackRoom":
      "{days} {unit} left — you have {kcal} kcal more than the plan asks for.",

    // Add sheet
    "home.addSheet.title": "Add entry",
    "home.addSheet.prizmaDesc": "92% calorie estimate accuracy",
    "home.addSheet.badge.mostAccurate": "MOST ACCURATE",
    "home.addSheet.meal": "Photograph a meal",
    "home.addSheet.mealDesc": "One photo and you're done",
    "home.addSheet.badge.fastest": "FASTEST",
    "home.addSheet.gricDesc": "Little bites — say them all at once, no photos",
    "home.addSheet.label": "Photograph a label",

    // Date strip
    "home.dateStrip.aria": "Day picker",
    "home.dateStrip.monthsShort":
      "jan feb mar apr may jun jul aug sep oct nov dec",
    "home.dateStrip.today": "Today, {date}",
    "home.dateStrip.logged": "{date} — you logged a meal",

    // Gric button
    "home.gric.desc": "Say what you snacked on — no photos",

    // Health score card
    "home.health.title": "Health score",
    "home.health.ariaScore": "Health score {score} out of 10",
    "home.health.ariaUnavailable": "Health score not available yet",

    // Intake pager
    "home.pager.show": "Show: {label}",

    // Micro cards
    "home.micro.noData": "no data",
    "home.micro.aboveGoal": "above goal",
    "home.micro.overLimit": "over the limit",
    "home.micro.remaining": "remaining",
    "home.micro.goal": "goal {target}",
    "home.micro.coveragePartial":
      "The data covers ~{percent}% of today's calories — for the rest we don't have fiber, sugar, and salt yet.",
    "home.micro.coverageNone":
      "We don't have fiber, sugar, and salt data for today's entries yet.",

    // Shared card copy (steps + water + add sheet)
    "home.close": "Close",
    "home.card.goalReached": "Goal 🎉",
    "home.card.dailyGoal": "Daily goal: {goal}",
    "home.card.saving": "Saving...",
    "home.card.add": "Add",
    "home.card.remove": "Remove",

    // Steps card
    "home.steps.saveFailed": "We couldn't save your steps. Please try again.",
    "home.steps.preset.short": "Short",
    "home.steps.preset.walk": "Walk",
    "home.steps.preset.long": "Long",
    "home.steps.label": "Steps",
    "home.steps.aria": "Steps: {total} of {goal}. Add steps.",
    "home.steps.sheetTitle": "Enter steps",
    "home.steps.minusAria": "Remove {n} steps (hold for faster)",
    "home.steps.plusAria": "Add {n} steps (hold for faster)",
    "home.steps.inputAria": "Number of steps to add",
    "home.steps.unit": "steps",
    "home.steps.loggedToday": "Logged today: {steps} steps",
    "home.steps.totalToday": "Total today: {steps} steps",
    "home.steps.editGoal": "Goal: {goal} · change",

    // Water button
    "home.water.saveFailed": "We couldn't save your water. Please try again.",
    "home.water.preset.glass": "+1 glass",
    "home.water.preset.bottle": "+1 bottle",
    "home.water.preset.large": "+1 large bottle",
    "home.water.label": "Water",
    "home.water.aria": "Water: {total}. Add water.",
    "home.water.ariaWithGoal": "Water: {total} of {goal}. Add water.",
    "home.water.sheetTitle": "Enter water",
    "home.water.minusAria": "Remove {n} mL",
    "home.water.plusAria": "Add {n} mL",
    "home.water.inputAria": "Water amount in milliliters",
    "home.water.loggedToday": "Logged: {total}",
    "home.water.totalToday": "Total today: {total}",
  },
} as const;
