// "dodaj" UI copy. Filled by the i18n translation pass. Add keys to BOTH sr and
// en, keeping this typed structure (Serbian is the source of truth; en is typed
// against the sr keys so a missing translation fails the build). Namespace all
// keys as "dodaj.<name>".
const sr = {
  // --- Shared across the add-food flows -----------------------------------
  "dodaj.cancel": "Otkaži",
  "dodaj.addToDay": "Dodaj u dan",
  "dodaj.recordAgain": "Snimi ponovo",
  "dodaj.retakePhoto": "Slikaj ponovo",
  "dodaj.openCamera": "Otvori kameru",
  "dodaj.uploadExistingPhoto": "Otpremi postojeću sliku",
  "dodaj.done": "Gotovo",
  "dodaj.retry": "Pokušaj ponovo",

  // Shared form / macro field labels
  "dodaj.field.name": "Naziv",
  "dodaj.field.grams": "Gramaža (g)",
  "dodaj.macro.kcal": "Kalorije",
  "dodaj.macro.protein": "Protein (g)",
  "dodaj.macro.carbs": "Ugljeni hidrati (g)",
  "dodaj.macro.fat": "Masti (g)",
  "dodaj.abbr.protein": "P",
  "dodaj.abbr.carbs": "UH",
  "dodaj.abbr.fat": "M",

  // Shared AI-confidence badge
  "dodaj.confidence.low": "Niska sigurnost",
  "dodaj.confidence.medium": "Srednja sigurnost",
  "dodaj.confidence.high": "Visoka sigurnost",

  "dodaj.aiApprox": "AI procena je približna — proveri i doteraj po potrebi.",
  "dodaj.yourMealAlt": "Tvoj obrok",

  // Shared recording UI
  "dodaj.startRecording.aria": "Počni snimanje",
  "dodaj.stopRecording.aria": "Zaustavi snimanje",
  "dodaj.micDenied":
    "Nismo dobili pristup mikrofonu. Dozvoli mikrofon u podešavanjima pa pokušaj ponovo.",
  "dodaj.processRecordingFailed":
    "Nismo uspeli da obradimo snimak. Pokušaj ponovo.",

  // Shared AiThinking strings
  "dodaj.thinking.almostDone": "Skoro gotovo…",
  "dodaj.thinking.listenCompute": "Slušam i računam…",
  "dodaj.thinking.recognizePlate": "Prepoznajem šta je na tanjiru…",
  "dodaj.thinking.computeMacros": "Računam makronutrijente…",

  // Shared server-action errors
  "dodaj.error.sessionExpired":
    "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
  "dodaj.error.imageTooLarge": "Slika je prevelika. Pokušaj ponovo.",
  "dodaj.error.noImageMeal": "Nema slike. Slikaj obrok pa pokušaj ponovo.",
  "dodaj.error.recordingTooLong": "Snimak je predugačak. Pokušaj ponovo, kraće.",
  "dodaj.error.recordingTooLarge":
    "Snimak je prevelik. Snimi kraće pa pokušaj ponovo.",
  "dodaj.error.understandRecordingFailed":
    "Nismo uspeli da razumemo snimak. Pokušaj ponovo.",
  "dodaj.error.estimateMealFailed":
    "Nismo uspeli da procenimo obrok. Pokušaj ponovo.",
  "dodaj.error.saveFailed": "Nismo uspeli da sačuvamo unos. Pokušaj ponovo.",
  "dodaj.error.noFood":
    "Ne vidim hranu na ovoj slici. Uslikaj svoj obrok (tanjir, piće, grickalicu…) pa ćemo probati ponovo.",

  // --- deklaracija (photograph a nutrition label) -------------------------
  "dodaj.deklaracija.title": "Slikaj deklaraciju",
  "dodaj.deklaracija.captureTitle": "Slikaj nutritivnu tabelu",
  "dodaj.deklaracija.captureSubtitle":
    "AI će očitati vrednosti na 100 g, ti samo potvrdiš",
  "dodaj.deklaracija.uploadFromGallery": "Otpremi sliku iz galerije",
  "dodaj.deklaracija.thinking.title": "Čitam deklaraciju…",
  "dodaj.deklaracija.thinking.line1": "Očitavam nutritivnu tabelu…",
  "dodaj.deklaracija.thinking.line2": "Preračunavam na 100 g…",
  "dodaj.deklaracija.error.noImage":
    "Nema slike. Slikaj deklaraciju pa pokušaj ponovo.",
  "dodaj.deklaracija.error.readFailed":
    "Nismo uspeli da pročitamo deklaraciju. Uslikaj tabelu izbliza i pokušaj ponovo.",

  // --- glas (speak your meal) ---------------------------------------------
  "dodaj.glas.title": "Reci obrok",
  "dodaj.glas.idleTitle": "Dodirni i reci šta si jeo ili pio",
  "dodaj.glas.idleSubtitle":
    "Možeš izgovoriti vrednosti sa deklaracije, ili samo opisati obrok — AI će proceniti.",
  "dodaj.glas.recordingHint": "Snimam… dodirni da zaustaviš",
  "dodaj.glas.thinking.line1": "Razumem šta si rekao…",
  "dodaj.glas.thinking.line2": "Prepoznajem obrok i količinu…",
  "dodaj.glas.error.noRecording": "Nema snimka. Snimi obrok pa pokušaj ponovo.",

  // --- gric (quick snacks) ------------------------------------------------
  "dodaj.gric.title": "Gric",
  "dodaj.gric.idleTitle": "Reci šta si gricnuo",
  "dodaj.gric.idleSubtitle":
    "Možeš nabrojati više stvari odjednom — „krastavac, šaka semenki i dve kajsije”.",
  "dodaj.gric.frequentTitle": "Opet isto",
  "dodaj.gric.frequentHint": "Jedan dodir doda stavku u dan — bez snimanja.",
  "dodaj.gric.recordingHint": "Slušam… dodirni da zaustaviš",
  "dodaj.gric.thinking.line1": "Razdvajam šta si sve pomenuo…",
  "dodaj.gric.thinking.line2": "Procenjujem količine…",
  "dodaj.gric.thinking.line3": "Računam kalorije…",
  "dodaj.gric.total": "Ukupno",
  "dodaj.gric.addingIn": "Dodajem za {n}…",
  "dodaj.gric.waitAdjust": "Sačekaj, hoću da doteram",
  "dodaj.gric.approxNote": "Procena je približna — za sitnice je to sasvim dovoljno.",
  "dodaj.gric.savedKcal": "Sačuvano — ≈ {n} kcal",
  "dodaj.gric.doneNote":
    "Ovo je bio pravi obrok, ne sitnica. Slikaj ga ako hoćeš tačniju procenu — sve ostaje zabeleženo i bez toga.",
  "dodaj.gric.portionQuestion": "Kolika je bila porcija?",
  "dodaj.gric.restoreItem": "Vrati {name}",
  "dodaj.gric.removeItem": "Ukloni {name}",
  "dodaj.gric.error.noRecording":
    "Nema snimka. Reci šta si gricnuo pa pokušaj ponovo.",
  "dodaj.gric.error.invalidInput": "Neispravan unos. Pokušaj ponovo.",
  "dodaj.gric.error.noFoodHeard":
    "Nismo čuli hranu u snimku. Probaj ponovo — reci npr. „pojeo sam krastavac i šaku semenki”.",

  // Portion-size chips (from PORTION_SIZES in @/lib/ai/gric-estimate)
  "dodaj.portion.small": "Manje",
  "dodaj.portion.normal": "Normalno",
  "dodaj.portion.large": "Više",

  // --- obrok (photograph a plate) -----------------------------------------
  "dodaj.obrok.title": "Slikaj obrok",
  "dodaj.obrok.cameraHint": "Uslikaj ceo tanjir odozgo",
  "dodaj.obrok.cameraSubtitle": "AI će proceniti kalorije i makronutrijente",
  "dodaj.obrok.thinking.title": "Analiziram obrok…",
  "dodaj.obrok.thinking.line2": "Procenjujem porciju…",
  "dodaj.obrok.mealFallback": "Obrok",
  "dodaj.obrok.hide": "Sakrij",
  "dodaj.obrok.fix": "Ispravi",
  "dodaj.obrok.tryPrizma": "Ne deluje tačno? Probaj Prizmu",
  "dodaj.obrok.error.invalidInput": "Neispravan unos. Proveri vrednosti.",

  // --- najtacnije (Prizma — highest-accuracy flow) ------------------------
  "dodaj.najtacnije.title": "Prizma",
  "dodaj.najtacnije.showGuideAria": "Prikaži vodič za slikanje",
  "dodaj.najtacnije.modeIntro":
    "Slikaš jednom, kažeš koliko ima i odgovoriš na par pitanja — zato je ovo najtačnija procena u aplikaciji.",
  "dodaj.najtacnije.mode.meal": "Obrok",
  "dodaj.najtacnije.mode.mealDesc": "Slikaj tanjir pa nam reci koliko ima",
  "dodaj.najtacnije.mode.label": "Deklaracija",
  "dodaj.najtacnije.mode.labelDesc":
    "Slikaj nutritivnu tabelu pa odgovori na pitanja",
  "dodaj.najtacnije.guide1.title": "Slikaj pravo odozgo",
  "dodaj.najtacnije.guide1.subtitle":
    "Tako vidim šta je na tanjiru i kako je raspoređeno.",
  "dodaj.najtacnije.guide1.tip1":
    "Stavi viljušku ili kašiku PORED tanjira — po njoj merim veličinu",
  "dodaj.najtacnije.guide1.tip2": "Ceo tanjir u kadru",
  "dodaj.najtacnije.guide1.tip3": "Dobro svetlo — bez senke preko tanjira",
  "dodaj.najtacnije.guide1.cta": "Jasno — otvori kameru",
  "dodaj.najtacnije.topPhotoAlt": "Slika odozgo",
  "dodaj.najtacnije.chooseAnotherAria": "Izaberi drugu sliku",
  "dodaj.najtacnije.refQuestion": "Ima li nečega pored tanjira?",
  "dodaj.najtacnije.refHint":
    "Po tome merim koliko je tanjir velik — bez toga samo pogađam.",
  "dodaj.najtacnije.next": "Dalje",
  "dodaj.najtacnije.ref.viljuska": "Viljuška",
  "dodaj.najtacnije.ref.kasika": "Kašika",
  "dodaj.najtacnije.ref.kartica": "Kartica",
  "dodaj.najtacnije.ref.nista": "Ništa",
  "dodaj.najtacnije.guide2.title": "Još jedna slika, iz ugla",
  "dodaj.najtacnije.guide2.subtitle":
    "Odozgo se ne vidi šta je ispod — iz ugla se vidi i visina.",
  "dodaj.najtacnije.guide2.tip1":
    "Viljuška neka ostane PORED tanjira, kao na prvoj slici",
  "dodaj.najtacnije.guide2.tip2": "Spusti telefon na oko 45°",
  "dodaj.najtacnije.guide2.tip3": "Isti tanjir — ne pomeraj hranu",
  "dodaj.najtacnije.capture.title": "Slikaj deklaraciju (nutritivnu tabelu)",
  "dodaj.najtacnije.capture.desc":
    "Dodaj i sliku pakovanja ako se na njemu vidi ukupna masa. AI će te pitati koliko si pojeo.",
  "dodaj.najtacnije.capture.cameraHint": "Neka tabela bude oštra i cela u kadru",
  "dodaj.najtacnije.photoAlt": "Slika {n}",
  "dodaj.najtacnije.removePhotoAria": "Ukloni sliku {n}",
  "dodaj.najtacnije.addPhotoAria": "Dodaj još jednu sliku",
  "dodaj.najtacnije.uploadExistingPhotos": "Otpremi postojeće slike",
  "dodaj.najtacnije.analyze": "Analiziraj",
  "dodaj.najtacnije.analyzing.title": "Gledam tvoj tanjir…",
  "dodaj.najtacnije.analyzing.line2": "Merim tanjir po viljušci…",
  "dodaj.najtacnije.analyzing.line3": "Spremam ti klizač za količinu…",
  "dodaj.najtacnije.analyzing.line4": "Gledam šta mi još nije jasno…",
  "dodaj.najtacnije.dishHowMuch": "{dish} — koliko ima?",
  "dodaj.najtacnije.howMuchApprox": "Koliko otprilike ima?",
  "dodaj.najtacnije.howMuchHint":
    "Vidim šta je na tanjiru, ali ne i koliko toga ima. Ti to vidiš — reci grubo, ja ću odatle da izračunam.",
  "dodaj.najtacnije.prepQuestion": "Kako je pripremljeno?",
  "dodaj.najtacnije.prepHint":
    "Mast se ne vidi na slici, a nosi najviše kalorija — kašika ulja je 126 kcal.",
  "dodaj.najtacnije.angleFallback": "Odozgo ne vidim šta je ispod.",
  "dodaj.najtacnije.angleSuffix": "Jedna slika iz ugla bi to rešila.",
  "dodaj.najtacnije.shootAngle": "Slikaj iz ugla",
  "dodaj.najtacnije.skip": "Preskoči",
  "dodaj.najtacnije.cantSeeFromPhoto": "Ovo ne mogu da vidim sa slike",
  "dodaj.najtacnije.multiSelect": "može više",
  "dodaj.najtacnije.sayWhat": "Reci šta je bilo",
  "dodaj.najtacnije.answerByVoiceAll": "…ili odgovori glasom na sve",
  "dodaj.najtacnije.recorded": "Snimljeno ({s}s) — snimi ponovo",
  "dodaj.najtacnije.sayByVoice": "Reci glasom",
  "dodaj.najtacnije.recordingStop": "Snimam… {time} — zaustavi",
  "dodaj.najtacnije.recordingReady": "Snimak spreman ✓",
  "dodaj.najtacnije.notePlaceholder": "…ili dopiši nešto (opciono)",
  "dodaj.najtacnije.calculate": "Izračunaj",
  "dodaj.najtacnije.backToPhotos": "Nazad na slike",
  "dodaj.najtacnije.finalizing.title": "Računam tvoju porciju…",
  "dodaj.najtacnije.finalizing.line1": "Spajam sliku i tvoje odgovore…",
  "dodaj.najtacnije.finalizing.line2": "Razlažem obrok na sastojke…",
  "dodaj.najtacnije.finalizing.line3": "Sabiram makronutrijente…",
  "dodaj.najtacnije.breakdown": "Od čega se sastoji",
  "dodaj.najtacnije.removeUneaten": "skloni što nisi jeo",
  "dodaj.najtacnije.removeComponent": "Skloni {name}",
  "dodaj.najtacnije.howEstimated": "Kako sam došao do procene",
  "dodaj.najtacnije.back": "Nazad",
  "dodaj.najtacnije.dismissGuide": "Znam već — ne prikazuj vodič",
  "dodaj.najtacnije.photoWarnSuffix":
    "— procena će biti tačnija ako slikaš ponovo.",
  "dodaj.najtacnije.dontKnow": "Ne znam",
  "dodaj.najtacnije.other": "Nešto drugo",
  "dodaj.najtacnije.saidOther": "Rekao si „{label}\" — dopiši ili reci šta je bilo.",
  "dodaj.najtacnije.issue.blurry": "Slika deluje mutno",
  "dodaj.najtacnije.issue.dark": "Slika je tamna",
  "dodaj.najtacnije.error.addOneImage": "Dodaj bar jednu sliku.",
  "dodaj.najtacnije.error.analyzeFailedClient":
    "Nismo uspeli da analiziramo. Pokušaj ponovo.",
  "dodaj.najtacnije.error.estimateFailedClient":
    "Nismo uspeli da procenimo. Pokušaj ponovo.",
  "dodaj.najtacnije.error.choosePrep":
    "Izaberi kako je pripremljeno — to najviše menja kalorije.",
  "dodaj.najtacnije.error.answerQuestions":
    "Odgovori na pitanja — tapni opcije ili odgovori glasom.",
  "dodaj.najtacnije.error.needDescription":
    "Dodaj opis — reci ili napiši šta si pojeo i koliko.",
  "dodaj.najtacnije.error.tooManyImages": "Previše slika. Najviše {n} po obroku.",
  "dodaj.najtacnije.error.someImageTooLarge":
    "Neka slika je prevelika. Pokušaj ponovo.",
  "dodaj.najtacnije.error.analyzeFailed":
    "Nismo uspeli da analiziramo slike. Pokušaj ponovo.",

  // Preparation-method chips (from PREP_LABELS in @/lib/ai/portion)
  "dodaj.prep.kuvano": "Kuvano / na pari",
  "dodaj.prep.bez_ulja": "Pečeno bez ulja",
  "dodaj.prep.malo_ulja": "Na malo ulja",
  "dodaj.prep.przeno": "Prženo / pohovano",

  // --- novi-proizvod (first-time product entry) ---------------------------
  "dodaj.newProduct.title": "Novi proizvod",
  "dodaj.newProduct.labelPrefill.pre": "Popunili smo vrednosti sa deklaracije —",
  "dodaj.newProduct.labelPrefill.emph": "proveri",
  "dodaj.newProduct.labelPrefill.post": "i doteraj po potrebi pa sačuvaj.",
  "dodaj.newProduct.barcodePrefix": "Barkod",
  "dodaj.newProduct.barcodeSuffix":
    "nije u našoj bazi. Dodaj ga i biće odmah dostupan svima.",
  "dodaj.newProduct.notInDb":
    "Ova namirnica nije u našoj bazi. Dodaj je i biće odmah dostupna svima.",

  // --- porcija (portion picker load errors) -------------------------------
  "dodaj.porcija.notFound": "Namirnica nije pronađena.",
  "dodaj.porcija.backToSearch": "Nazad na pretragu",

  // --- uskoro (coming-soon placeholder) -----------------------------------
  "dodaj.uskoro.badge": "Uskoro",
  "dodaj.uskoro.searchFood": "Pretraži hranu",
  "dodaj.uskoro.backToDanas": "Nazad na Danas",
  "dodaj.uskoro.barkod.title": "Skeniranje barkoda",
  "dodaj.uskoro.barkod.body":
    "Uskoro ćeš moći da skeniraš barkod proizvoda i odmah dodaš unos.",
  "dodaj.uskoro.deklaracija.title": "Slikanje deklaracije",
  "dodaj.uskoro.deklaracija.body":
    "Uskoro ćeš moći da slikaš nutritivnu deklaraciju, a mi ćemo je pretvoriti u gotov unos.",
  "dodaj.uskoro.obrok.title": "Slikanje obroka",
  "dodaj.uskoro.obrok.body":
    "Uskoro ćeš moći da slikaš svoj obrok, a mi ćemo proceniti kalorije i makronutrijente.",
  "dodaj.uskoro.fallback.title": "Uskoro dostupno",
  "dodaj.uskoro.fallback.body":
    "Radimo na ovoj funkciji. U međuvremenu, unos možeš dodati pretragom.",

  // --- proizvod (dedicated add-a-catalog-product flow) --------------------
  "dodaj.proizvod.title": "Dodaj proizvod",
  "dodaj.proizvod.scanSubtitle":
    "Skeniraj ili otpremi barkod. Ovde dodaješ proizvode koji imaju deklaraciju i barkod.",
  "dodaj.proizvod.checking": "Proveravamo barkod…",
  "dodaj.proizvod.lookupFailed":
    "Nismo uspeli da proverimo barkod. Pokušaj ponovo.",
  "dodaj.proizvod.existsSuffix":
    "već postoji u bazi — ne moraš ponovo da ga dodaješ.",
  "dodaj.proizvod.openProduct": "Otvori proizvod",
  "dodaj.proizvod.addAnotherLink": "Dodaj drugi proizvod",
  "dodaj.proizvod.barcodeSuffix":
    "nije u bazi. Popuni vrednosti ili slikaj deklaraciju, pa sačuvaj.",
  "dodaj.proizvod.successTitle": "Proizvod dodat",
  "dodaj.proizvod.successSuffix": "je sada u bazi i dostupan svima.",
  "dodaj.proizvod.addAnother": "Dodaj još jedan",
} as const;

const en: Record<keyof typeof sr, string> = {
  // --- Shared across the add-food flows -----------------------------------
  "dodaj.cancel": "Cancel",
  "dodaj.addToDay": "Add to day",
  "dodaj.recordAgain": "Record again",
  "dodaj.retakePhoto": "Retake",
  "dodaj.openCamera": "Open camera",
  "dodaj.uploadExistingPhoto": "Upload an existing photo",
  "dodaj.done": "Done",
  "dodaj.retry": "Try again",

  "dodaj.field.name": "Name",
  "dodaj.field.grams": "Weight (g)",
  "dodaj.macro.kcal": "Calories",
  "dodaj.macro.protein": "Protein (g)",
  "dodaj.macro.carbs": "Carbs (g)",
  "dodaj.macro.fat": "Fat (g)",
  "dodaj.abbr.protein": "P",
  "dodaj.abbr.carbs": "C",
  "dodaj.abbr.fat": "F",

  "dodaj.confidence.low": "Low confidence",
  "dodaj.confidence.medium": "Medium confidence",
  "dodaj.confidence.high": "High confidence",

  "dodaj.aiApprox": "The AI estimate is approximate — check it and adjust as needed.",
  "dodaj.yourMealAlt": "Your meal",

  "dodaj.startRecording.aria": "Start recording",
  "dodaj.stopRecording.aria": "Stop recording",
  "dodaj.micDenied":
    "We couldn't access the microphone. Allow the mic in settings and try again.",
  "dodaj.processRecordingFailed":
    "We couldn't process the recording. Try again.",

  "dodaj.thinking.almostDone": "Almost done…",
  "dodaj.thinking.listenCompute": "Listening and calculating…",
  "dodaj.thinking.recognizePlate": "Working out what's on the plate…",
  "dodaj.thinking.computeMacros": "Calculating the macros…",

  "dodaj.error.sessionExpired":
    "Your session expired. Sign in again and try again.",
  "dodaj.error.imageTooLarge": "The image is too large. Try again.",
  "dodaj.error.noImageMeal": "No photo. Take a picture of your meal and try again.",
  "dodaj.error.recordingTooLong": "The recording is too long. Try again, shorter.",
  "dodaj.error.recordingTooLarge":
    "The recording is too large. Record something shorter and try again.",
  "dodaj.error.understandRecordingFailed":
    "We couldn't make out the recording. Try again.",
  "dodaj.error.estimateMealFailed":
    "We couldn't estimate the meal. Try again.",
  "dodaj.error.saveFailed": "We couldn't save the entry. Try again.",
  "dodaj.error.noFood":
    "I can't see any food in this photo. Take a picture of your meal (a plate, a drink, a snack…) and we'll try again.",

  // --- deklaracija ---------------------------------------------------------
  "dodaj.deklaracija.title": "Photograph a label",
  "dodaj.deklaracija.captureTitle": "Photograph the nutrition table",
  "dodaj.deklaracija.captureSubtitle":
    "The AI reads the per-100 g values, you just confirm",
  "dodaj.deklaracija.uploadFromGallery": "Upload a photo from your gallery",
  "dodaj.deklaracija.thinking.title": "Reading the label…",
  "dodaj.deklaracija.thinking.line1": "Reading the nutrition table…",
  "dodaj.deklaracija.thinking.line2": "Converting to per 100 g…",
  "dodaj.deklaracija.error.noImage":
    "No photo. Take a picture of the label and try again.",
  "dodaj.deklaracija.error.readFailed":
    "We couldn't read the label. Take a close-up of the table and try again.",

  // --- glas ----------------------------------------------------------------
  "dodaj.glas.title": "Say your meal",
  "dodaj.glas.idleTitle": "Tap and say what you ate or drank",
  "dodaj.glas.idleSubtitle":
    "You can read out the values from a label, or just describe the meal — the AI will estimate it.",
  "dodaj.glas.recordingHint": "Recording… tap to stop",
  "dodaj.glas.thinking.line1": "Understanding what you said…",
  "dodaj.glas.thinking.line2": "Recognizing the meal and the amount…",
  "dodaj.glas.error.noRecording": "No recording. Record your meal and try again.",

  // --- gric ----------------------------------------------------------------
  "dodaj.gric.title": "Snack",
  "dodaj.gric.idleTitle": "Say what you snacked on",
  "dodaj.gric.idleSubtitle":
    "You can list several things at once — „a cucumber, a handful of seeds and two apricots”.",
  "dodaj.gric.frequentTitle": "Same again",
  "dodaj.gric.frequentHint": "One tap adds it to your day — no recording.",
  "dodaj.gric.recordingHint": "Listening… tap to stop",
  "dodaj.gric.thinking.line1": "Picking apart everything you mentioned…",
  "dodaj.gric.thinking.line2": "Estimating the amounts…",
  "dodaj.gric.thinking.line3": "Calculating calories…",
  "dodaj.gric.total": "Total",
  "dodaj.gric.addingIn": "Adding in {n}…",
  "dodaj.gric.waitAdjust": "Hold on, I want to adjust",
  "dodaj.gric.approxNote": "The estimate is rough — for small stuff that's plenty.",
  "dodaj.gric.savedKcal": "Saved — ≈ {n} kcal",
  "dodaj.gric.doneNote":
    "That was a real meal, not a snack. Photograph it if you want a more accurate estimate — it stays logged either way.",
  "dodaj.gric.portionQuestion": "How big was the portion?",
  "dodaj.gric.restoreItem": "Restore {name}",
  "dodaj.gric.removeItem": "Remove {name}",
  "dodaj.gric.error.noRecording":
    "No recording. Say what you snacked on and try again.",
  "dodaj.gric.error.invalidInput": "Invalid input. Try again.",
  "dodaj.gric.error.noFoodHeard":
    "We didn't hear any food in the recording. Try again — say something like „I ate a cucumber and a handful of seeds”.",

  "dodaj.portion.small": "Less",
  "dodaj.portion.normal": "Normal",
  "dodaj.portion.large": "More",

  // --- obrok ---------------------------------------------------------------
  "dodaj.obrok.title": "Photograph a meal",
  "dodaj.obrok.cameraHint": "Photograph the whole plate from above",
  "dodaj.obrok.cameraSubtitle": "The AI will estimate the calories and macros",
  "dodaj.obrok.thinking.title": "Analyzing the meal…",
  "dodaj.obrok.thinking.line2": "Estimating the portion…",
  "dodaj.obrok.mealFallback": "Meal",
  "dodaj.obrok.hide": "Hide",
  "dodaj.obrok.fix": "Edit",
  "dodaj.obrok.tryPrizma": "Doesn't look right? Try Prizma",
  "dodaj.obrok.error.invalidInput": "Invalid input. Check the values.",

  // --- najtacnije (Prizma) -------------------------------------------------
  "dodaj.najtacnije.title": "Prizma",
  "dodaj.najtacnije.showGuideAria": "Show the photo guide",
  "dodaj.najtacnije.modeIntro":
    "You take one photo, tell us how much there is and answer a couple of questions — that's why this is the most accurate estimate in the app.",
  "dodaj.najtacnije.mode.meal": "Meal",
  "dodaj.najtacnije.mode.mealDesc": "Photograph the plate, then tell us how much there is",
  "dodaj.najtacnije.mode.label": "Label",
  "dodaj.najtacnije.mode.labelDesc":
    "Photograph the nutrition table, then answer the questions",
  "dodaj.najtacnije.guide1.title": "Shoot straight from above",
  "dodaj.najtacnije.guide1.subtitle":
    "That way I can see what's on the plate and how it's laid out.",
  "dodaj.najtacnije.guide1.tip1":
    "Put a fork or spoon NEXT TO the plate — I measure the size by it",
  "dodaj.najtacnije.guide1.tip2": "The whole plate in frame",
  "dodaj.najtacnije.guide1.tip3": "Good light — no shadow across the plate",
  "dodaj.najtacnije.guide1.cta": "Got it — open the camera",
  "dodaj.najtacnije.topPhotoAlt": "Photo from above",
  "dodaj.najtacnije.chooseAnotherAria": "Choose another photo",
  "dodaj.najtacnije.refQuestion": "Is there anything next to the plate?",
  "dodaj.najtacnije.refHint":
    "That's how I measure how big the plate is — without it I'm just guessing.",
  "dodaj.najtacnije.next": "Next",
  "dodaj.najtacnije.ref.viljuska": "Fork",
  "dodaj.najtacnije.ref.kasika": "Spoon",
  "dodaj.najtacnije.ref.kartica": "Card",
  "dodaj.najtacnije.ref.nista": "Nothing",
  "dodaj.najtacnije.guide2.title": "One more photo, from an angle",
  "dodaj.najtacnije.guide2.subtitle":
    "From above you can't see what's underneath — from an angle you can also see the height.",
  "dodaj.najtacnije.guide2.tip1":
    "Keep the fork NEXT TO the plate, like in the first photo",
  "dodaj.najtacnije.guide2.tip2": "Lower the phone to about 45°",
  "dodaj.najtacnije.guide2.tip3": "Same plate — don't move the food",
  "dodaj.najtacnije.capture.title": "Photograph the label (nutrition table)",
  "dodaj.najtacnije.capture.desc":
    "Add a photo of the packaging too if the total weight is shown on it. The AI will ask you how much you ate.",
  "dodaj.najtacnije.capture.cameraHint": "Keep the table sharp and fully in frame",
  "dodaj.najtacnije.photoAlt": "Photo {n}",
  "dodaj.najtacnije.removePhotoAria": "Remove photo {n}",
  "dodaj.najtacnije.addPhotoAria": "Add another photo",
  "dodaj.najtacnije.uploadExistingPhotos": "Upload existing photos",
  "dodaj.najtacnije.analyze": "Analyze",
  "dodaj.najtacnije.analyzing.title": "Looking at your plate…",
  "dodaj.najtacnije.analyzing.line2": "Measuring the plate against the fork…",
  "dodaj.najtacnije.analyzing.line3": "Getting your amount slider ready…",
  "dodaj.najtacnije.analyzing.line4": "Checking what's still unclear to me…",
  "dodaj.najtacnije.dishHowMuch": "{dish} — how much is there?",
  "dodaj.najtacnije.howMuchApprox": "Roughly how much is there?",
  "dodaj.najtacnije.howMuchHint":
    "I can see what's on the plate, but not how much of it. You can — give me a rough idea and I'll work it out from there.",
  "dodaj.najtacnije.prepQuestion": "How was it cooked?",
  "dodaj.najtacnije.prepHint":
    "Fat doesn't show in a photo, and it carries the most calories — a spoon of oil is 126 kcal.",
  "dodaj.najtacnije.angleFallback": "From above I can't see what's underneath.",
  "dodaj.najtacnije.angleSuffix": "One photo from an angle would sort it out.",
  "dodaj.najtacnije.shootAngle": "Shoot from an angle",
  "dodaj.najtacnije.skip": "Skip",
  "dodaj.najtacnije.cantSeeFromPhoto": "This I can't see from the photo",
  "dodaj.najtacnije.multiSelect": "multiple allowed",
  "dodaj.najtacnije.sayWhat": "Say what it was",
  "dodaj.najtacnije.answerByVoiceAll": "…or answer all of it by voice",
  "dodaj.najtacnije.recorded": "Recorded ({s}s) — record again",
  "dodaj.najtacnije.sayByVoice": "Answer by voice",
  "dodaj.najtacnije.recordingStop": "Recording… {time} — stop",
  "dodaj.najtacnije.recordingReady": "Recording ready ✓",
  "dodaj.najtacnije.notePlaceholder": "…or add a note (optional)",
  "dodaj.najtacnije.calculate": "Calculate",
  "dodaj.najtacnije.backToPhotos": "Back to photos",
  "dodaj.najtacnije.finalizing.title": "Calculating your portion…",
  "dodaj.najtacnije.finalizing.line1": "Combining the photo and your answers…",
  "dodaj.najtacnije.finalizing.line2": "Breaking the meal down into components…",
  "dodaj.najtacnije.finalizing.line3": "Adding up the macros…",
  "dodaj.najtacnije.breakdown": "What it's made of",
  "dodaj.najtacnije.removeUneaten": "remove what you didn't eat",
  "dodaj.najtacnije.removeComponent": "Remove {name}",
  "dodaj.najtacnije.howEstimated": "How I reached the estimate",
  "dodaj.najtacnije.back": "Back",
  "dodaj.najtacnije.dismissGuide": "I know already — don't show the guide",
  "dodaj.najtacnije.photoWarnSuffix":
    "— the estimate will be more accurate if you retake it.",
  "dodaj.najtacnije.dontKnow": "Don't know",
  "dodaj.najtacnije.other": "Something else",
  "dodaj.najtacnije.saidOther": "You said „{label}\" — type or say what it was.",
  "dodaj.najtacnije.issue.blurry": "The photo looks blurry",
  "dodaj.najtacnije.issue.dark": "The photo is dark",
  "dodaj.najtacnije.error.addOneImage": "Add at least one photo.",
  "dodaj.najtacnije.error.analyzeFailedClient":
    "We couldn't analyze it. Try again.",
  "dodaj.najtacnije.error.estimateFailedClient":
    "We couldn't estimate it. Try again.",
  "dodaj.najtacnije.error.choosePrep":
    "Choose how it was cooked — that changes the calories the most.",
  "dodaj.najtacnije.error.answerQuestions":
    "Answer the questions — tap the options or answer by voice.",
  "dodaj.najtacnije.error.needDescription":
    "Add a description — say or type what you ate and how much.",
  "dodaj.najtacnije.error.tooManyImages": "Too many photos. At most {n} per meal.",
  "dodaj.najtacnije.error.someImageTooLarge":
    "One of the photos is too large. Try again.",
  "dodaj.najtacnije.error.analyzeFailed":
    "We couldn't analyze the photos. Try again.",

  "dodaj.prep.kuvano": "Boiled / steamed",
  "dodaj.prep.bez_ulja": "Baked without oil",
  "dodaj.prep.malo_ulja": "With a little oil",
  "dodaj.prep.przeno": "Fried / breaded",

  // --- novi-proizvod -------------------------------------------------------
  "dodaj.newProduct.title": "New product",
  "dodaj.newProduct.labelPrefill.pre": "We filled in the values from the label —",
  "dodaj.newProduct.labelPrefill.emph": "check them",
  "dodaj.newProduct.labelPrefill.post": "and adjust as needed, then save.",
  "dodaj.newProduct.barcodePrefix": "Barcode",
  "dodaj.newProduct.barcodeSuffix":
    "isn't in our database. Add it and everyone will have it right away.",
  "dodaj.newProduct.notInDb":
    "This food isn't in our database. Add it and everyone will have it right away.",

  // --- porcija -------------------------------------------------------------
  "dodaj.porcija.notFound": "Food not found.",
  "dodaj.porcija.backToSearch": "Back to search",

  // --- uskoro --------------------------------------------------------------
  "dodaj.uskoro.badge": "Coming soon",
  "dodaj.uskoro.searchFood": "Search food",
  "dodaj.uskoro.backToDanas": "Back to Today",
  "dodaj.uskoro.barkod.title": "Barcode scanning",
  "dodaj.uskoro.barkod.body":
    "Soon you'll be able to scan a product's barcode and add an entry right away.",
  "dodaj.uskoro.deklaracija.title": "Label photos",
  "dodaj.uskoro.deklaracija.body":
    "Soon you'll be able to photograph a nutrition label and we'll turn it into a ready entry.",
  "dodaj.uskoro.obrok.title": "Meal photos",
  "dodaj.uskoro.obrok.body":
    "Soon you'll be able to photograph your meal and we'll estimate the calories and macros.",
  "dodaj.uskoro.fallback.title": "Coming soon",
  "dodaj.uskoro.fallback.body":
    "We're working on this feature. In the meantime, you can add an entry via search.",

  // --- proizvod ------------------------------------------------------------
  "dodaj.proizvod.title": "Add product",
  "dodaj.proizvod.scanSubtitle":
    "Scan or upload a barcode. This is where you add products that have a nutrition label and a barcode.",
  "dodaj.proizvod.checking": "Checking the barcode…",
  "dodaj.proizvod.lookupFailed": "We couldn't check the barcode. Try again.",
  "dodaj.proizvod.existsSuffix":
    "is already in the database — no need to add it again.",
  "dodaj.proizvod.openProduct": "Open product",
  "dodaj.proizvod.addAnotherLink": "Add another product",
  "dodaj.proizvod.barcodeSuffix":
    "isn't in the database. Fill in the values or photograph the label, then save.",
  "dodaj.proizvod.successTitle": "Product added",
  "dodaj.proizvod.successSuffix": "is now in the database and available to everyone.",
  "dodaj.proizvod.addAnother": "Add another",
};

export const dodaj = { sr, en };
