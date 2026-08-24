// Translation fragment for the /danas home-screen sub-components (adaptive plan
// card, add sheet, date strip, gric button, health score card, intake pager,
// micro cards, steps card, water button). Merged into the main dictionary
// alongside the base `home.*` keys already in `messages.ts`.
export const homeExtraMessages = {
  sr: {
    // Kartica „Plan za danas" je UKLONJENA 2026-08-01 (odluka vlasnika): plan i
    // dalje pomera brojeve u prstenu i cilj koraka. Stanje nedelje živi na vrhu
    // /analitika (`analytics.onTrack.*`).
    //
    // 2026-08-06: plan opet govori, ali kao TRENUTAK, ne kao nameštaj. Kartica
    // je pala zato što je bila stalna — kad nije imala šta da kaže, govorila je
    // „Plan za danas ostaje isti" uz broj koji prsten ionako pokazuje. Ekran
    // koji se pojavi, kaže i nestane nema tu cenu. Zato ovde NEMA poruke za
    // stanje „ništa se nije promenilo": kad nema šta da se kaže, ćuti se.
    "home.planIntro.title": "Plan za danas je prilagođen",
    "home.planIntro.from": "sa {kcal}",
    // Rešenje pre prestupa (dogovor 2026-08-01, tačka 3): prvo broj koji važi
    // danas, pa tek onda čime je izazvan. Dan se ne otvara prozivkom.
    "home.planIntro.walk": "Dodaj {min} min hoda pa se nedelja poravna.",
    "home.planIntro.dismiss": "Dodirni bilo gde",

    // Prekoračenje se javlja ODMAH (2026-08-06), a ne tek sutra ujutru: plan
    // gleda samo dane PRE današnjeg, pa prejedanje u četvrtak pomera petak.
    // Uzrok i posledica su inače razdvojeni pola dana i ništa ih ne povezuje.
    // Bezlično „uneto je" — isti razlog kao kod `causeOverYesterday`: ne mora
    // da bira između „uneo si" i „unela si".
    "home.overNotice.title": "Sutrašnji plan je preračunat",
    "home.overNotice.over": "Danas je uneto {kcal} kcal iznad cilja.",
    // Nedelja uveče: nema više dana koji bi to upili, pa se ne izmišlja broj za
    // dan koji pripada sledećem budžetu.
    "home.overNotice.spill":
      "Nedelja se završava — višak od {kcal} kcal prelazi u sledeću.",

    // Sitni podsetnik koji stoji dok je plan pomeren (2026-08-07, tražio
    // vlasnik). Trenutak se javi jednom i ode; ovo je jedina stvar koja svakog
    // dana kaže da broj u prstenu nije redovan. Jedan red visine — kartica je
    // pala baš zato što je bila veća od onoga što ima da kaže.
    "home.planNote.loweredDays": "Unos je smanjen još {days} {unit}",
    "home.planNote.raisedDays": "Unos je podignut još {days} {unit}",
    "home.planNote.loweredToday": "Unos je smanjen danas",
    "home.planNote.raisedToday": "Unos je podignut danas",
    "home.planNote.why": "Zašto?",

    // Pitanje o danu kome plan nije poverovao. Bezlično „uneto je" — ne mora
    // da bira između „uneo si" i „unela si". Pitanje imenuje dan i iznos, jer
    // „jedan raniji dan" ne bi značilo ništa nikome.
    "home.dayQuestion.ask": "Je li {day} stvarno bio dan od {kcal} kcal?",
    "home.dayQuestion.complete": "Da, bio je lagan dan",
    "home.dayQuestion.partial": "Nije sve upisano",
    "home.dayQuestion.why":
      "Dok ne odgovoriš, taj dan se računa kao da je odrađen po planu.",

    // Adaptive plan — rečenice preživele iz kartice (commit f79787d), sad ih
    // koristi trenutak na otvaranju dana.
    "home.adaptive.day": "dan",
    "home.adaptive.days": "dana",
    "home.adaptive.lifted":
      "Ranije ove nedelje je uneto manje nego što plan traži, pa je današnji cilj podignut — da nedelja ispuni svoje.",
    "home.adaptive.lowered":
      "Zbog ranijeg prekoračenja, današnji cilj je snižen — da se nedelja vrati na prag.",
    "home.adaptive.carry":
      "Uračunat je i prenos od {kcal} kcal iz prošle nedelje.",
    // „još 1 dan" / „još 4 dana" — jedina formulacija čija gramatika drži za
    // svaki broj bez plural engine-a.
    "home.adaptive.forward":
      "Važi i za još {days} {unit}: {kcal} kcal ({delta}/dan)",
    "home.adaptive.weekdays":
      "ponedeljak utorak sreda četvrtak petak subota nedelja",
    // ⚠️ „Juče" ima ZASEBNE rečenice: kao prilog ne može da stoji na mestu
    // naziva dana („četvrtak je bio veći" ✓, „juče je bio veći" ✗).
    "home.adaptive.causeOver": "Razlog: {day} je bio {kcal} kcal veći od plana.",
    "home.adaptive.causeUnder":
      "Razlog: {day} je bio {kcal} kcal manji od plana.",
    "home.adaptive.causeOverYesterday":
      "Razlog: juče je uneto {kcal} kcal više od plana.",
    "home.adaptive.causeUnderYesterday":
      "Razlog: juče je uneto {kcal} kcal manje od plana.",
    // „Višak", ne „ostatak" — red o hodanju već nosi svoju reč, a dva „ostatka"
    // jedan ispod drugog čitaju se kao isti broj rečen dvaput.
    "home.adaptive.spill":
      "Višak od {kcal} kcal ne staje u ovu nedelju — prelazi u sledeću.",

    // Add sheet
    "home.addSheet.title": "Dodaj unos",
    "home.addSheet.prizmaDesc": "92% tačnost procene kalorija",
    "home.addSheet.badge.mostAccurate": "NAJTAČNIJE",
    "home.addSheet.meal": "Slikaj obrok",
    "home.addSheet.mealDesc": "Jedna slika i gotovo",
    "home.addSheet.badge.fastest": "NAJBRŽE",
    "home.addSheet.gricDesc": "Sitnice — reci ili napiši sve odjednom, bez slikanja",
    "home.addSheet.label": "Slikaj deklaraciju",

    // Date strip
    "home.dateStrip.aria": "Izbor dana",
    "home.dateStrip.monthsShort":
      "jan feb mar apr maj jun jul avg sep okt nov dec",
    "home.dateStrip.today": "Danas, {date}",
    "home.dateStrip.logged": "{date} — uneo si obrok",

    // Gric button
    "home.gric.desc": "Reci ili napiši šta si grickao",

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
    // Plan moment (see the Serbian block for why this is a moment and not a
    // card, and why there is no "nothing changed" string).
    "home.planIntro.title": "Today's plan is adjusted",
    "home.planIntro.from": "from {kcal}",
    "home.planIntro.walk": "Add {min} min of walking and the week evens out.",
    "home.planIntro.dismiss": "Tap anywhere",

    "home.overNotice.title": "Tomorrow's plan is recalculated",
    "home.overNotice.over": "Today came in {kcal} kcal over target.",
    "home.overNotice.spill":
      "The week ends today — {kcal} kcal carries into the next one.",

    "home.planNote.loweredDays": "Intake stays lowered for {days} more {unit}",
    "home.planNote.raisedDays": "Intake stays raised for {days} more {unit}",
    "home.planNote.loweredToday": "Intake is lowered today",
    "home.planNote.raisedToday": "Intake is raised today",
    "home.planNote.why": "Why?",

    "home.dayQuestion.ask": "Was {day} really a {kcal} kcal day?",
    "home.dayQuestion.complete": "Yes, it was a light day",
    "home.dayQuestion.partial": "I didn't log it all",
    "home.dayQuestion.why":
      "Until you answer, that day counts as one done to plan.",

    // Adaptive plan
    "home.adaptive.day": "day",
    "home.adaptive.days": "days",
    "home.adaptive.lifted":
      "Earlier this week came in under what the plan asks for, so today's target is raised — so the week meets its own number.",
    "home.adaptive.lowered":
      "After an earlier overshoot, today's target is lowered — to bring the week back to its line.",
    "home.adaptive.carry": "This includes {kcal} kcal carried over from last week.",
    "home.adaptive.forward":
      "Holds for {days} more {unit}: {kcal} kcal ({delta}/day)",
    "home.adaptive.weekdays":
      "Monday Tuesday Wednesday Thursday Friday Saturday Sunday",
    "home.adaptive.causeOver": "Why: {day} came in {kcal} kcal over plan.",
    "home.adaptive.causeUnder": "Why: {day} came in {kcal} kcal under plan.",
    "home.adaptive.causeOverYesterday":
      "Why: yesterday came in {kcal} kcal over plan.",
    "home.adaptive.causeUnderYesterday":
      "Why: yesterday came in {kcal} kcal under plan.",
    "home.adaptive.spill":
      "{kcal} kcal doesn't fit in this week — it carries into the next one.",

    // Add sheet
    "home.addSheet.title": "Add entry",
    "home.addSheet.prizmaDesc": "92% calorie estimate accuracy",
    "home.addSheet.badge.mostAccurate": "MOST ACCURATE",
    "home.addSheet.meal": "Photograph a meal",
    "home.addSheet.mealDesc": "One photo and you're done",
    "home.addSheet.badge.fastest": "FASTEST",
    "home.addSheet.gricDesc": "Little bites — say or type them all at once, no photos",
    "home.addSheet.label": "Photograph a label",

    // Date strip
    "home.dateStrip.aria": "Day picker",
    "home.dateStrip.monthsShort":
      "jan feb mar apr may jun jul aug sep oct nov dec",
    "home.dateStrip.today": "Today, {date}",
    "home.dateStrip.logged": "{date} — you logged a meal",

    // Gric button
    "home.gric.desc": "Say or type what you snacked on",

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
