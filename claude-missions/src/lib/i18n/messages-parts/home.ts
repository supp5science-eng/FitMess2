// Translation fragment for the /danas home-screen sub-components (adaptive plan
// card, add sheet, date strip, gric button, health score card, intake pager,
// micro cards, steps card, water button). Merged into the main dictionary
// alongside the base `home.*` keys already in `messages.ts`.
export const homeExtraMessages = {
  sr: {
    // Kartica „Plan za danas" je UKLONJENA 2026-08-01 (odluka vlasnika): plan i
    // dalje pomera brojeve u prstenu i cilj koraka, ali se više ne objašnjava na
    // Početnoj. Stanje nedelje živi na vrhu /analitika (`analytics.onTrack.*`).
    // Sve `home.adaptive.*` poruke su otišle s njom.

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

    // Podsetnik za merenje — the one permission ask, on the home screen
    "home.pushNudge.title": "Da te podsetimo na merenje?",
    "home.pushNudge.body":
      "Jednom nedeljno, na dan merenja. Ništa drugo ti ne šaljemo.",
    "home.pushNudge.accept": "Podseti me",
    "home.pushNudge.decline": "Ne treba",
    "home.pushNudge.working": "Uključujem...",
    "home.pushNudge.done":
      "Važi — javićemo ti na dan merenja. Menjaš ga u Podešavanja → Dan merenja.",
    "home.pushNudge.error": "Nismo uspeli da uključimo podsetnik.",
  },
  en: {
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

    "home.pushNudge.title": "Remind you to weigh in?",
    "home.pushNudge.body":
      "Once a week, on your weigh-in day. Nothing else gets sent.",
    "home.pushNudge.accept": "Remind me",
    "home.pushNudge.decline": "No thanks",
    "home.pushNudge.working": "Turning on...",
    "home.pushNudge.done":
      "Done — we'll ping you on weigh-in day. Change it in Settings → Weigh-in day.",
    "home.pushNudge.error": "We couldn't turn the reminder on.",
  },
} as const;
