// Translation fragment for Nedeljno merenje (`/merenje`, the `/danas` banner,
// `/profil/merenje`). `sr` is the source-of-truth key set; `en` mirrors it
// exactly. Interpolation placeholders ({kcal}, {kg}, ...) are identical across
// both locales.
//
// Tone note: this surface reports a measurement that can contradict the plan
// the app itself wrote. Every string here is deliberately blame-free -- the
// number is information, never a verdict on the person -- and the copy for a
// missing food log says WE don't know, never "you failed to log".
export const merenjeMessages = {
  sr: {
    // The /danas banner
    "merenje.banner.title": "Nedeljno merenje",
    "merenje.banner.today": "Danas je dan za merenje. Traje 10 sekundi.",
    "merenje.banner.waitingOne": "Merenje te čeka od juče.",
    "merenje.banner.waitingMany": "Merenje te čeka {days} dana.",
    "merenje.banner.cta": "Izmeri se",

    // /merenje — the weigh-in itself
    "merenje.title": "Nedeljno merenje",
    "merenje.subtitle":
      "Vaga je jedino što stvarno MERI koliko trošiš. Sve ostalo je procena.",
    "merenje.howTo":
      "Meri se ujutru, posle WC-a, pre jela, bez odeće — uvek isto.",
    "merenje.howToWhy":
      "Uvek na isti način, jer se dnevno kolebanje od 1–2 kg (voda, so, glikogen) inače pomeša sa stvarnom promenom.",
    "merenje.field": "Težina (kg)",
    "merenje.readout": "Očitano sa vage",
    "merenje.save": "Sačuvaj merenje",
    "merenje.saving": "Čuvam…",
    "merenje.saved": "Merenje je sačuvano.",
    "merenje.change": "Izmeni merenje",
    "merenje.error.range": "Unesi težinu između 30 i 300 kg.",
    "merenje.error.generic":
      "Nismo uspeli da sačuvamo merenje. Pokušaj ponovo.",
    "merenje.lastWeighIn": "Poslednje merenje: {weight} kg ({date})",
    "merenje.backToToday": "Nazad na Danas",

    // The weekly result card
    "merenje.result.title": "Šta kaže vaga",
    "merenje.result.trend": "Trend",
    "merenje.result.expected": "Očekivano",
    "merenje.result.perWeek": "{kg} kg/ned",
    "merenje.result.range": "{from} do {to}",
    "merenje.result.measured": "Izmerena potrošnja",
    "merenje.result.planned": "Plan je računao",
    "merenje.result.kcalPerDay": "{kcal} kcal/dan",
    "merenje.result.basedOn":
      "Izračunato iz {days} dana i prosečnog unosa od {kcal} kcal.",
    "merenje.result.lowConfidence":
      "Za sada su ovo dva merenja — trend će biti pouzdaniji posle trećeg.",

    // Statuses
    "merenje.status.onTrack": "Ide po planu",
    "merenje.status.tooSlow": "Sporije od plana",
    "merenje.status.stalled": "Stoji u mestu",
    "merenje.status.tooFast": "Brže od plana",
    "merenje.status.unknown": "Još nemamo dovoljno podataka",

    // What each status means, in one sentence
    "merenje.explain.onTrack":
      "Težina se kreće tempom koji tvoj cilj traži. Ništa ne menjamo.",
    "merenje.explain.tooSlow":
      "Težina se pomera sporije nego što plan predviđa. Verovatno trošiš manje nego što smo procenili.",
    "merenje.explain.stalled":
      "Dve nedelje bez pomaka. To ne znači da nešto radiš pogrešno — znači da je procena potrošnje bila viša od stvarne.",
    "merenje.explain.tooFast":
      "Ide brže nego što je zdravo. Prebrzo mršavljenje se plaća mišićima i energijom, pa je bolje malo popustiti.",

    // Insufficient data — never a verdict about the plan
    "merenje.explain.fewWeighIns":
      "Jedno merenje ne znači ništa: voda i so lako naprave kilogram razlike. Kad se izmeriš još jednom kroz nedelju dana, moći ćemo da čitamo trend.",
    "merenje.explain.spanTooShort":
      "Merenja su preblizu jedno drugom da bi se videla nedeljna promena. Sledeće za koji dan.",
    "merenje.explain.untrustedIntake":
      "Vagu vidimo, ali dnevnik ishrane je previše prazan da bismo iz njega izračunali potrošnju. Ne znamo šta si jeo — zato ne diramo plan.",
    "merenje.explain.implausibleMeasurement":
      "Vaga se pomerila više nego što na tvom unosu telo stvarno može da se promeni za toliko dana — to su skoro uvek voda, so i različito doba merenja. Iz ovoga se potrošnja ne može izračunati, pa plan ostaje kakav jeste do sledećeg merenja.",

    // The suggestion
    "merenje.suggest.title": "Predlog",
    "merenje.suggest.cut":
      "Predlažemo {kcal} kcal dnevno umesto dosadašnjih {old}.",
    "merenje.suggest.add":
      "Predlažemo {kcal} kcal dnevno umesto dosadašnjih {old} — više hrane, ne manje.",
    "merenje.suggest.steps":
      "Ili, ako ne želiš da diraš hranu: {steps} koraka više dnevno donosi isto.",
    "merenje.suggest.capped":
      "Zaustavili smo korekciju na bezbednoj granici — dalje rezanje hrane ne bi bilo u redu, pa ostatak ide na aktivnost.",
    "merenje.suggest.accept": "Prihvati novi plan",
    "merenje.suggest.keep": "Zadrži trenutni",
    "merenje.suggest.applying": "Menjam plan…",
    "merenje.suggest.accepted": "Plan je promenjen na {kcal} kcal dnevno.",
    "merenje.suggest.kept":
      "U redu, ostajemo na trenutnom planu. Nećemo te pitati narednih 14 dana.",
    "merenje.suggest.stale":
      "Ovaj predlog više nije aktuelan. Osveži stranicu da vidiš novi.",
    "merenje.suggest.error": "Nismo uspeli da sačuvamo odluku. Pokušaj ponovo.",

    // Analitika card
    "merenje.chart.title": "Merenja",
    "merenje.chart.subtitle":
      "Tačke su ono što je vaga rekla. Linija je ono po čemu se plan meri.",
    "merenje.chart.changeLabel": "promena za {days} dana",
    "merenje.chart.currentLabel": "poslednje merenje",
    "merenje.chart.empty":
      "Kad se izmeriš bar dva puta, ovde se pojavi tvoj trend.",

    // /profil/merenje — choosing the day
    "merenje.settings.title": "Dan merenja",
    "merenje.settings.subtitle":
      "Biraj jedan dan i drži ga se. Poređenje nedelje sa nedeljom ima smisla samo ako se meriš uvek istog dana.",
    "merenje.settings.day": "Merim se",
    "merenje.settings.push": "Podsetnik na telefon",
    "merenje.settings.pushOn": "Uključen",
    "merenje.settings.pushOff": "Isključen",
    "merenje.settings.time": "U koliko sati",
    "merenje.settings.save": "Sačuvaj",
    "merenje.settings.saved": "Sačuvano.",
  },
  en: {
    "merenje.banner.title": "Weekly weigh-in",
    "merenje.banner.today": "Today is weigh-in day. Takes 10 seconds.",
    "merenje.banner.waitingOne": "Your weigh-in has been waiting since yesterday.",
    "merenje.banner.waitingMany": "Your weigh-in has been waiting {days} days.",
    "merenje.banner.cta": "Weigh in",

    "merenje.title": "Weekly weigh-in",
    "merenje.subtitle":
      "The scale is the only thing that actually MEASURES what you burn. Everything else is an estimate.",
    "merenje.howTo":
      "Weigh in the morning, after the toilet, before eating, undressed — always the same.",
    "merenje.howToWhy":
      "Always the same way, because a 1–2 kg daily swing (water, salt, glycogen) otherwise gets mistaken for real change.",
    "merenje.field": "Weight (kg)",
    "merenje.readout": "Off the scale",
    "merenje.save": "Save weigh-in",
    "merenje.saving": "Saving…",
    "merenje.saved": "Weigh-in saved.",
    "merenje.change": "Edit weigh-in",
    "merenje.error.range": "Enter a weight between 30 and 300 kg.",
    "merenje.error.generic": "We couldn't save the weigh-in. Please try again.",
    "merenje.lastWeighIn": "Last weigh-in: {weight} kg ({date})",
    "merenje.backToToday": "Back to Today",

    "merenje.result.title": "What the scale says",
    "merenje.result.trend": "Trend",
    "merenje.result.expected": "Expected",
    "merenje.result.perWeek": "{kg} kg/week",
    "merenje.result.range": "{from} to {to}",
    "merenje.result.measured": "Measured burn",
    "merenje.result.planned": "The plan assumed",
    "merenje.result.kcalPerDay": "{kcal} kcal/day",
    "merenje.result.basedOn":
      "Computed from {days} days and an average intake of {kcal} kcal.",
    "merenje.result.lowConfidence":
      "That's two weigh-ins so far — the trend gets sturdier after a third.",

    "merenje.status.onTrack": "On track",
    "merenje.status.tooSlow": "Slower than planned",
    "merenje.status.stalled": "Standing still",
    "merenje.status.tooFast": "Faster than planned",
    "merenje.status.unknown": "Not enough data yet",

    "merenje.explain.onTrack":
      "Your weight is moving at the pace your goal asks for. We're changing nothing.",
    "merenje.explain.tooSlow":
      "Your weight is moving slower than the plan predicts. You most likely burn less than we estimated.",
    "merenje.explain.stalled":
      "Two weeks with no movement. That doesn't mean you're doing anything wrong — it means the estimate of your burn was higher than the real one.",
    "merenje.explain.tooFast":
      "This is faster than is healthy. Losing too fast is paid for in muscle and energy, so easing off is the better call.",

    "merenje.explain.fewWeighIns":
      "One weigh-in means nothing: water and salt easily make a kilogram of difference. Weigh in again in a week and we can read a trend.",
    "merenje.explain.spanTooShort":
      "The weigh-ins are too close together to show a weekly change. The next one is in a few days.",
    "merenje.explain.untrustedIntake":
      "We can see the scale, but the food log is too empty to compute your burn from. We don't know what you ate — so we're not touching the plan.",
    "merenje.explain.implausibleMeasurement":
      "The scale moved further than your body could actually change on your intake over that many days — that is almost always water, salt, and weighing at different times. Your burn can't be computed from this, so the plan stays as it is until the next weigh-in.",

    "merenje.suggest.title": "Suggestion",
    "merenje.suggest.cut": "We suggest {kcal} kcal a day instead of {old}.",
    "merenje.suggest.add":
      "We suggest {kcal} kcal a day instead of {old} — more food, not less.",
    "merenje.suggest.steps":
      "Or, if you'd rather not touch the food: {steps} more steps a day does the same.",
    "merenje.suggest.capped":
      "We stopped the correction at the safe limit — cutting food further wouldn't be right, so the rest goes to activity.",
    "merenje.suggest.accept": "Accept the new plan",
    "merenje.suggest.keep": "Keep the current one",
    "merenje.suggest.applying": "Updating your plan…",
    "merenje.suggest.accepted": "Your plan is now {kcal} kcal a day.",
    "merenje.suggest.kept":
      "Fine, we'll stay on the current plan. We won't ask again for 14 days.",
    "merenje.suggest.stale":
      "This suggestion is out of date. Refresh the page to see the current one.",
    "merenje.suggest.error": "We couldn't save your answer. Please try again.",

    "merenje.chart.title": "Weigh-ins",
    "merenje.chart.subtitle":
      "The dots are what the scale said. The line is what the plan is judged against.",
    "merenje.chart.changeLabel": "change over {days} days",
    "merenje.chart.currentLabel": "latest weigh-in",
    "merenje.chart.empty":
      "Weigh in at least twice and your trend shows up here.",

    "merenje.settings.title": "Weigh-in day",
    "merenje.settings.subtitle":
      "Pick one day and stick to it. Comparing week to week only means something if you weigh in on the same day.",
    "merenje.settings.day": "I weigh in on",
    "merenje.settings.push": "Phone reminder",
    "merenje.settings.pushOn": "On",
    "merenje.settings.pushOff": "Off",
    "merenje.settings.time": "At",
    "merenje.settings.save": "Save",
    "merenje.settings.saved": "Saved.",
  },
} as const;
