// Translation fragment for the Analitika surface (`/analitika` + its cards).
// `sr` is the source-of-truth key set; `en` mirrors it exactly. Interpolation
// placeholders ({name}) are identical across both locales.
export const analyticsMessages = {
  sr: {
    // Page-level states (/analitika)
    "analytics.error.sessionExpired":
      "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    "analytics.error.loadWeek":
      "Nismo uspeli da učitamo tvoju nedelju. Pokušaj ponovo.",
    "analytics.action.signIn": "Prijavi se",
    "analytics.action.retry": "Pokušaj ponovo",
    "analytics.noPlan":
      "Još nemaš plan ishrane. Završi upitnik pa se ovde pojavi tvoja nedelja.",
    "analytics.backToToday": "Nazad na Danas",

    // Stanje nedelje, na vrhu (2026-08-01). Preseljeno sa Početne: „sve je u
    // redu" nije zadatak za danas nego ocena nedelje, pa stoji ovde.
    "analytics.onTrack.title": "Nedelja ti je u planu",
    "analytics.onTrack.room":
      "Još {days} {unit} — imaš {kcal} kcal više nego što plan traži.",
    "analytics.onTrack.day": "dan",
    "analytics.onTrack.days": "dana",

    // Shared chart read-out
    "analytics.readout.close": "Zatvori detalje dana",
    "analytics.hint.default": "Dodirni dan na grafiku da vidiš tačne brojke.",

    // BMI card
    "analytics.bmi.title": "Tvoj BMI",
    "analytics.bmi.help":
      "Indeks telesne mase (ITM) je odnos težine i visine. Orijentaciona mera — ne razlikuje mišićnu od masne mase.",
    "analytics.bmi.empty":
      "Dopuni visinu i težinu u upitniku pa ćemo ti ovde izračunati indeks telesne mase.",
    "analytics.bmi.yourWeightIs": "Tvoja težina je",
    "analytics.bmi.zone.under.legend": "Pothranjenost",
    "analytics.bmi.zone.under.adjective": "premala",
    "analytics.bmi.zone.healthy.legend": "Zdravo",
    "analytics.bmi.zone.healthy.adjective": "zdrava",
    "analytics.bmi.zone.over.legend": "Prekomerna",
    "analytics.bmi.zone.over.adjective": "prekomerna",
    "analytics.bmi.zone.obese.legend": "Gojaznost",
    "analytics.bmi.zone.obese.adjective": "previsoka",

    // Intake-trend ("Procena težine") card
    "analytics.intake.title": "Procena težine",
    "analytics.intake.subtitle": "Na osnovu unosa · 7 dana",
    "analytics.intake.empty":
      "Dopuni pol, godine, visinu, težinu i nivo aktivnosti u upitniku pa ćemo iz tvog unosa proceniti trend težine.",
    "analytics.intake.hint":
      "Dodirni dan na liniji da vidiš procenu i šta si tada uneo/la.",
    "analytics.intake.estimateValue": "Procena {weight}",
    "analytics.intake.changeLabel": "procenjena promena, 7 dana",
    "analytics.intake.chartAria":
      "Procenjeni trend težine: {change} za 7 dana",
    "analytics.intake.noMealsThatDay":
      "Tog dana nema unetih obroka (računamo kao održavanje).",
    "analytics.intake.eatenLine": "Uneto {intake} kcal · {balance} kcal {direction}",
    "analytics.intake.dir.below": "manje od potrošnje",
    "analytics.intake.dir.above": "više od potrošnje",
    "analytics.intake.dir.exact": "tačno na potrošnji",
    "analytics.intake.note.noData": "Beleži obroke za precizniju procenu",
    "analytics.intake.note.fatHigh": "Masti malo iznad plana",
    "analytics.intake.note.proteinLow": "Manje proteina od cilja",
    "analytics.intake.note.surplus": "Unos iznad potrošnje",
    "analytics.intake.note.onTrack": "U skladu s planom",

    // Macro-average ("Dnevni prosek kalorija") card
    "analytics.macro.title": "Dnevni prosek kalorija",
    "analytics.macro.carbs": "Ugljeni hidrati",
    "analytics.macro.tab.thisWeek": "Ova nedelja",
    "analytics.macro.tab.lastWeek": "Prošla",
    "analytics.macro.tab.twoAgo": "Pre 2 ned.",
    "analytics.macro.tab.threeAgo": "Pre 3 ned.",
    "analytics.macro.weekSelector": "Izbor nedelje",
    "analytics.macro.emptyWeek": "Nema unetih obroka u ovoj nedelji.",
    "analytics.macro.emptyAll":
      "Počni da beležiš obroke pa ćeš ovde videti svoj dnevni prosek.",
    "analytics.macro.hint": "Dodirni stubić da vidiš tačan unos tog dana.",
    "analytics.macro.noEntry": "Nema unosa",
    "analytics.macro.aria.noEntry": "nema unosa",
    "analytics.macro.dayFuture": "Taj dan tek dolazi.",
    "analytics.macro.dayNoMeals": "Tog dana nije unet nijedan obrok.",
    "analytics.macro.gramsLine": "P {protein} g · UH {carbs} g · M {fat} g",

    // Meal-history ("Svi obroci") section
    "analytics.mealHistory.title": "Svi obroci",
    "analytics.mealHistory.empty":
      "Još nemaš unetih obroka. Kad počneš da unosiš, ovde ti stoji istorija poslednjih 30 dana.",
    "analytics.mealHistory.showMore": "Prikaži više",

    // Micronutrients ("Mikronutrijenti") card
    "analytics.micro.title": "Mikronutrijenti",
    "analytics.micro.sevenDays": "7 dana",
    "analytics.micro.selector": "Izbor mikronutrijenta",
    "analytics.micro.loadError":
      "Nismo uspeli da učitamo mikronutrijente. Osveži stranicu pa pokušaj ponovo.",
    "analytics.micro.empty":
      "Još nemamo podatke o vlaknima, šećeru i soli za ovu nedelju. Pojaviće se čim počneš da beležiš obroke.",
    "analytics.micro.tab.fiber": "Vlakna",
    "analytics.micro.tab.sugar": "Šećer",
    "analytics.micro.tab.sodium": "So",
    "analytics.micro.tab.satFat": "Zasićene",
    "analytics.micro.avgDaily": "{label} · prosečno dnevno",
    "analytics.micro.saltApprox": "≈ {grams} g soli",
    "analytics.micro.goal": "cilj",
    "analytics.micro.limit": "granica",
    "analytics.micro.hint": "Dodirni stubić da vidiš tačnu vrednost tog dana.",
    "analytics.micro.notEnoughData": "Nema dovoljno podataka",
    "analytics.micro.aria.notEnough": "nema dovoljno podataka",
    "analytics.micro.status.noData":
      "Još nemamo dovoljno podataka za {label}.",
    "analytics.micro.status.okGoal":
      "U proseku dostižeš dnevni cilj — samo tako. 🎉",
    "analytics.micro.status.okLimit": "U proseku si ispod dnevne granice.",
    "analytics.micro.status.under":
      "U proseku ti fali {amount} dnevno do cilja.",
    "analytics.micro.status.over": "U proseku {amount} dnevno preko granice.",
    "analytics.micro.day.partialCoverage":
      "Podaci pokrivaju samo ~{pct}% tog dana, pa ga ne računamo.",
    "analytics.micro.day.noNutrient":
      "Za taj dan nemamo podatke o ovom nutrijentu.",
    "analytics.micro.day.goalMet": "Cilj ({target}) ispunjen 🎉",
    "analytics.micro.day.goalShort": "Fali {diff} do cilja {target}",
    "analytics.micro.day.underLimit": "Ispod granice ({target})",
    "analytics.micro.day.overLimit": "{diff} preko granice {target}",
    "analytics.micro.footer.summary": "{inTarget} od {total} {measured} {target}.",
    "analytics.micro.footer.noData":
      "Nijedan dan ove nedelje nema dovoljno podataka.",
    "analytics.micro.footer.missing":
      "Za {n} {day} nemamo dovoljno podataka pa ih ne računamo.",
    "analytics.micro.footer.dayMeasuredOne": "izmerenog dana",
    "analytics.micro.footer.dayMeasuredMany": "izmerenih dana",
    "analytics.micro.footer.inGoal": "u cilju",
    "analytics.micro.footer.inLimit": "u granici",
    "analytics.micro.footer.dayOne": "dan",
    "analytics.micro.footer.dayMany": "dana",

    // Steps ("Koraci") card
    "analytics.steps.title": "Koraci",
    "analytics.steps.subtitle": "Poslednjih 7 dana",
    "analytics.steps.loadError": "Nismo uspeli da učitamo korake. Pokušaj ponovo.",
    "analytics.steps.hint": "Dodirni dan na grafiku da vidiš koliko si tada prošao/la.",
    "analytics.steps.goalReachedShort": "cilj ispunjen 🎉",
    "analytics.steps.pctOfGoal": "{pct}% dnevnog cilja",
    "analytics.steps.todayLine": "{hint} · danas",
    "analytics.steps.stepsCount": "{steps} koraka",
    "analytics.steps.avgPerDay": "prosek {steps} /dan",
    "analytics.steps.chartAria":
      "Koraci u poslednjih 7 dana; prosek {steps} dnevno",
    "analytics.steps.noStepsThatDay": "Tog dana nije uneto nijedan korak.",
    "analytics.steps.goalReached": "Cilj ({goal}) ispunjen 🎉",
    "analytics.steps.pctOfGoalValue": "{pct}% od cilja {goal}",

    // Water ("Voda") card
    "analytics.water.title": "Voda",
    "analytics.water.subtitle": "Danas · 7 dana",
    "analytics.water.empty":
      "Dodaj težinu u upitniku pa ćemo ti postaviti dnevni cilj za vodu.",
    "analytics.water.hint": "Dodirni stubić da vidiš koliko si tog dana popio/la.",
    "analytics.water.goalReachedShort": "Cilj ispunjen 🎉",
    "analytics.water.remaining": "Još {amount} do cilja",
    "analytics.water.ofGoal": "od {goal} cilj",
    "analytics.water.weekAvg": "Nedeljni prosek: {avg} / dan",
    "analytics.water.noWaterThatDay": "Tog dana nije uneta voda.",
    "analytics.water.goalReached": "Cilj ({goal}) ispunjen 🎉",
    "analytics.water.pctOfGoal": "{pct}% od cilja {goal}",
  },
  en: {
    // Page-level states (/analitika)
    "analytics.error.sessionExpired":
      "Your session expired. Sign in again and give it another go.",
    "analytics.error.loadWeek":
      "We couldn't load your week. Please try again.",
    "analytics.action.signIn": "Sign in",
    "analytics.action.retry": "Try again",
    "analytics.noPlan":
      "You don't have a nutrition plan yet. Finish the questionnaire and your week will show up here.",
    "analytics.backToToday": "Back to Today",

    "analytics.onTrack.title": "Your week is on plan",
    "analytics.onTrack.room":
      "{days} {unit} left — you have {kcal} kcal more than the plan asks for.",
    "analytics.onTrack.day": "day",
    "analytics.onTrack.days": "days",

    // Shared chart read-out
    "analytics.readout.close": "Close day details",
    "analytics.hint.default": "Tap a day on the chart to see the exact numbers.",

    // BMI card
    "analytics.bmi.title": "Your BMI",
    "analytics.bmi.help":
      "Body-mass index (BMI) is the ratio of weight to height. A rough guide — it doesn't tell muscle from fat.",
    "analytics.bmi.empty":
      "Add your height and weight in the questionnaire and we'll work out your body-mass index here.",
    "analytics.bmi.yourWeightIs": "Your weight is",
    "analytics.bmi.zone.under.legend": "Underweight",
    "analytics.bmi.zone.under.adjective": "too low",
    "analytics.bmi.zone.healthy.legend": "Healthy",
    "analytics.bmi.zone.healthy.adjective": "healthy",
    "analytics.bmi.zone.over.legend": "Overweight",
    "analytics.bmi.zone.over.adjective": "high",
    "analytics.bmi.zone.obese.legend": "Obesity",
    "analytics.bmi.zone.obese.adjective": "too high",

    // Intake-trend ("Weight estimate") card
    "analytics.intake.title": "Weight estimate",
    "analytics.intake.subtitle": "Based on intake · 7 days",
    "analytics.intake.empty":
      "Add your sex, age, height, weight and activity level in the questionnaire and we'll estimate your weight trend from your intake.",
    "analytics.intake.hint":
      "Tap a day on the line to see the estimate and what you ate that day.",
    "analytics.intake.estimateValue": "Estimate {weight}",
    "analytics.intake.changeLabel": "estimated change, 7 days",
    "analytics.intake.chartAria":
      "Estimated weight trend: {change} over 7 days",
    "analytics.intake.noMealsThatDay":
      "No meals logged that day (we count it as maintenance).",
    "analytics.intake.eatenLine": "Ate {intake} kcal · {balance} kcal {direction}",
    "analytics.intake.dir.below": "below burn",
    "analytics.intake.dir.above": "above burn",
    "analytics.intake.dir.exact": "right at burn",
    "analytics.intake.note.noData": "Log meals for a more precise estimate",
    "analytics.intake.note.fatHigh": "Fat a touch above plan",
    "analytics.intake.note.proteinLow": "Less protein than your goal",
    "analytics.intake.note.surplus": "Intake above burn",
    "analytics.intake.note.onTrack": "On plan",

    // Macro-average ("Daily calorie average") card
    "analytics.macro.title": "Daily calorie average",
    "analytics.macro.carbs": "Carbs",
    "analytics.macro.tab.thisWeek": "This week",
    "analytics.macro.tab.lastWeek": "Last",
    "analytics.macro.tab.twoAgo": "2 wks ago",
    "analytics.macro.tab.threeAgo": "3 wks ago",
    "analytics.macro.weekSelector": "Week selection",
    "analytics.macro.emptyWeek": "No meals logged this week.",
    "analytics.macro.emptyAll":
      "Start logging meals and you'll see your daily average here.",
    "analytics.macro.hint": "Tap a bar to see that day's exact intake.",
    "analytics.macro.noEntry": "No entry",
    "analytics.macro.aria.noEntry": "no entry",
    "analytics.macro.dayFuture": "That day is still ahead.",
    "analytics.macro.dayNoMeals": "No meals were logged that day.",
    "analytics.macro.gramsLine": "P {protein} g · C {carbs} g · F {fat} g",

    // Meal-history ("All meals") section
    "analytics.mealHistory.title": "All meals",
    "analytics.mealHistory.empty":
      "No meals logged yet. Once you start logging, your last 30 days show up here.",
    "analytics.mealHistory.showMore": "Show more",

    // Micronutrients card
    "analytics.micro.title": "Micronutrients",
    "analytics.micro.sevenDays": "7 days",
    "analytics.micro.selector": "Micronutrient selection",
    "analytics.micro.loadError":
      "We couldn't load your micronutrients. Refresh the page and try again.",
    "analytics.micro.empty":
      "We don't have fiber, sugar or salt data for this week yet. It'll show up as soon as you start logging meals.",
    "analytics.micro.tab.fiber": "Fiber",
    "analytics.micro.tab.sugar": "Sugar",
    "analytics.micro.tab.sodium": "Salt",
    "analytics.micro.tab.satFat": "Saturated",
    "analytics.micro.avgDaily": "{label} · daily average",
    "analytics.micro.saltApprox": "≈ {grams} g salt",
    "analytics.micro.goal": "goal",
    "analytics.micro.limit": "limit",
    "analytics.micro.hint": "Tap a bar to see that day's exact value.",
    "analytics.micro.notEnoughData": "Not enough data",
    "analytics.micro.aria.notEnough": "not enough data",
    "analytics.micro.status.noData":
      "We don't have enough data for {label} yet.",
    "analytics.micro.status.okGoal":
      "On average you're hitting your daily goal — keep it up. 🎉",
    "analytics.micro.status.okLimit": "On average you're under your daily limit.",
    "analytics.micro.status.under":
      "On average you're {amount} short of your daily goal.",
    "analytics.micro.status.over": "On average {amount} over your daily limit.",
    "analytics.micro.day.partialCoverage":
      "The data covers only ~{pct}% of that day, so we're not counting it.",
    "analytics.micro.day.noNutrient":
      "We have no data on this nutrient for that day.",
    "analytics.micro.day.goalMet": "Goal ({target}) met 🎉",
    "analytics.micro.day.goalShort": "{diff} short of your {target} goal",
    "analytics.micro.day.underLimit": "Under the limit ({target})",
    "analytics.micro.day.overLimit": "{diff} over the {target} limit",
    "analytics.micro.footer.summary": "{inTarget} of {total} {measured} {target}.",
    "analytics.micro.footer.noData":
      "No day this week has enough data.",
    "analytics.micro.footer.missing":
      "For {n} {day} we don't have enough data, so we're not counting them.",
    "analytics.micro.footer.dayMeasuredOne": "measured day",
    "analytics.micro.footer.dayMeasuredMany": "measured days",
    "analytics.micro.footer.inGoal": "on target",
    "analytics.micro.footer.inLimit": "within limit",
    "analytics.micro.footer.dayOne": "day",
    "analytics.micro.footer.dayMany": "days",

    // Steps card
    "analytics.steps.title": "Steps",
    "analytics.steps.subtitle": "Last 7 days",
    "analytics.steps.loadError": "We couldn't load your steps. Please try again.",
    "analytics.steps.hint": "Tap a day on the chart to see how far you went that day.",
    "analytics.steps.goalReachedShort": "goal reached 🎉",
    "analytics.steps.pctOfGoal": "{pct}% of daily goal",
    "analytics.steps.todayLine": "{hint} · today",
    "analytics.steps.stepsCount": "{steps} steps",
    "analytics.steps.avgPerDay": "avg {steps} /day",
    "analytics.steps.chartAria":
      "Steps over the last 7 days; average {steps} per day",
    "analytics.steps.noStepsThatDay": "No steps logged that day.",
    "analytics.steps.goalReached": "Goal ({goal}) reached 🎉",
    "analytics.steps.pctOfGoalValue": "{pct}% of your {goal} goal",

    // Water card
    "analytics.water.title": "Water",
    "analytics.water.subtitle": "Today · 7 days",
    "analytics.water.empty":
      "Add your weight in the questionnaire and we'll set a daily water goal for you.",
    "analytics.water.hint": "Tap a bar to see how much you drank that day.",
    "analytics.water.goalReachedShort": "Goal reached 🎉",
    "analytics.water.remaining": "{amount} to your goal",
    "analytics.water.ofGoal": "of {goal} goal",
    "analytics.water.weekAvg": "Weekly average: {avg} / day",
    "analytics.water.noWaterThatDay": "No water logged that day.",
    "analytics.water.goalReached": "Goal ({goal}) reached 🎉",
    "analytics.water.pctOfGoal": "{pct}% of your {goal} goal",
  },
} as const;
