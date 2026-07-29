// Media / capture / streaks / achievements surface copy: barcode scanner,
// in-app camera, the AI-thinking loader, the portion dial, the shot guide, the
// streak cards/pill/dots, and the achievements + reward screens.
export const mediaMessages = {
  sr: {
    // Barcode scanner (F030)
    "media.scanner.denied":
      "Nemamo pristup kameri. Dozvoli pristup kameri u podešavanjima pregledača, ili pretraži ručno.",
    "media.scanner.noCamera":
      "Nije pronađena kamera na ovom uređaju. Pretraži ručno.",
    "media.scanner.generic":
      "Skener trenutno ne radi na ovom uređaju. Pretraži ručno.",
    "media.scanner.decodeError": "Skeniranje trenutno ne radi. Pokušaj ponovo.",
    "media.scanner.defaultTitle": "Skeniraj barkod",
    "media.scanner.defaultSubtitle": "Uperi kameru u barkod proizvoda.",
    "media.scanner.uploadNotFound":
      "Nismo našli barkod na slici. Slikaj izbliza, ravno, dobro osvetljeno — pa pokušaj ponovo.",
    "media.scanner.uploadFailed":
      "Nismo uspeli da očitamo sliku. Pokušaj ponovo.",
    "media.scanner.readingImage": "Očitavam sliku…",
    "media.scanner.uploadButton": "Otpremi sliku barkoda",
    "media.scanner.requesting": "Tražimo pristup kameri...",
    "media.scanner.searchManually": "Pretraži ručno",
    "media.scanner.retry": "Pokušaj ponovo",
    "media.scanner.orSearchManually": "Ili pretraži ručno",
    "media.scanner.videoAria": "Prikaz kamere za skeniranje barkoda",
    "media.scanner.noBarcodeSearch": "Ne vidiš barkod? Pretraži ručno.",

    // Barcode lookup (F031)
    "media.scanLookup.checking": "Proveravamo barkod...",
    "media.scanLookup.failed":
      "Nismo uspeli da proverimo barkod. Pokušaj ponovo.",
    "media.scanLookup.retry": "Pokušaj ponovo",
    "media.scanLookup.searchFood": "Pretraži hranu",

    // In-app camera capture
    "media.camera.denied":
      "Nema pristupa kameri. Dozvoli kameru u podešavanjima pregledača, ili otpremi postojeću sliku.",
    "media.camera.noCamera":
      "Ne vidimo kameru na ovom uređaju. Otpremi postojeću sliku.",
    "media.camera.generic":
      "Kamera trenutno nije dostupna. Otpremi postojeću sliku.",
    "media.camera.opening": "Otvaram kameru…",
    "media.camera.cancel": "Otkaži",
    "media.camera.lens": "Sočivo",
    "media.camera.uploadExisting": "Otpremi postojeću sliku",
    "media.camera.takePhoto": "Slikaj",

    // AI-thinking loader
    "media.aiThinking.title": "Procenjujem…",
    "media.aiThinking.line1": "Analiziram slike…",
    "media.aiThinking.line2": "Prepoznajem sastojke…",
    "media.aiThinking.line3": "Računam makronutrijente…",
    "media.aiThinking.line4": "Skoro gotovo…",

    // Portion dial
    "media.portion.coverage.quarter": "četvrt",
    "media.portion.coverage.half": "pola",
    "media.portion.coverage.threeQuarters": "tri\nčetvrtine",
    "media.portion.coverage.wholePlate": "ceo\ntanjir",
    "media.portion.level.bottom": "na dnu",
    "media.portion.level.half": "do pola",
    "media.portion.level.threeQuarters": "tri\nčetvrtine",
    "media.portion.level.top": "do vrha",
    "media.portion.coverageLabel": "Koliki deo tanjira je pokriven",
    "media.portion.heightQuestion": "Koliko je visoko?",
    "media.portion.fillLabel": "Dokle je napunjeno",
    "media.portion.fewerPieces": "Manje komada",
    "media.portion.morePieces": "Više komada",
    "media.portion.plateAria": "Tanjir sa hranom",
    "media.portion.bowlAria": "Duboka posuda sa hranom",
    "media.portion.piecesAria": "{count} komada",

    // Shot guide
    "media.shotGuide.topAria":
      "Animacija: telefon stoji ravno iznad tanjira i slika pravo odozgo, viljuška leži pored tanjira",
    "media.shotGuide.angleAria":
      "Animacija: telefon se spušta po luku i naginje na 45 stepeni da uslika tanjir sa strane",

    // Streak dots
    "media.streakDots.summaryAria":
      "{logged} od poslednjih {total} dana sa unosom",
    "media.streakDots.weekday.sun": "ned",
    "media.streakDots.weekday.mon": "pon",
    "media.streakDots.weekday.tue": "uto",
    "media.streakDots.weekday.wed": "sre",
    "media.streakDots.weekday.thu": "čet",
    "media.streakDots.weekday.fri": "pet",
    "media.streakDots.weekday.sat": "sub",

    // Streak summary card
    "media.streakCard.hintStart": "Uloguj obrok pa kreni da nižeš dane.",
    "media.streakCard.hintNext": "Još {count} do {target} dana.",
    "media.streakCard.hintAllDone":
      "Prošao/la si svaki cilj — niz i dalje traje.",
    "media.streakCard.inARow": "{noun} zaredom",
    "media.streakCard.startYourStreak": "Započni svoj niz",
    "media.streakCard.longest": "Najduži niz: {count}",
    "media.streakCard.loggedToday": "Danas je ubeleženo — niz raste. 🔥",
    "media.streakCard.logToContinue":
      "Uloguj bar jedan obrok danas da nastaviš niz.",
    "media.streakCard.title": "Niz",
    "media.streakCard.daysWithLog": "Dani sa unosom",

    // Streak pill
    "media.streakPill.label": "Niz: {count}",
    "media.streakPill.openAchievements": ". Otvori dostignuća.",

    // Achievement tile
    "media.achievement.earnedAria": "{title}: osvojeno, {criteria}",
    "media.achievement.lockedAria":
      "{title}: zaključano, {value} od {threshold}",

    // Achievements screen
    "media.achievements.back": "Nazad",
    "media.achievements.title": "Dostignuća",
    "media.achievements.streak": "Niz",
    "media.achievements.longest": "najduži: {count}",
    "media.achievements.badges": "Bedževi",
    "media.achievements.badgesEarnedAria": "{earned} od {total} bedževa osvojeno",

    // Dostignuća page (expired session)
    "media.dostignuca.sessionExpired":
      "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    "media.dostignuca.login": "Prijavi se",

    // Reward celebration
    "media.reward.streakAria": "{streak} {noun} zaredom",
    "media.reward.dayOne": "dan",
    "media.reward.dayMany": "dana",
    "media.reward.dayInARowOne": "dan zaredom",
    "media.reward.dayInARowMany": "dana zaredom",
    "media.reward.title": "Pun dan!",
    "media.reward.subtitle": "Upisao si sva tri obroka. Značka je tvoja.",
    "media.reward.continue": "Nastavi",
    "media.reward.viewAnalytics": "Pogledaj Analitiku",
    "media.reward.notYetTitle": "Još malo",
    "media.reward.oneMealLeft":
      "Fali ti još jedan obrok do pune značke za danas.",
    "media.reward.mealsLeft":
      "Fali ti još {count} obroka do pune značke za danas.",
    "media.reward.logMeal": "Upiši obrok",
    "media.reward.backToToday": "Nazad na Danas",
  },
  en: {
    // Barcode scanner (F030)
    "media.scanner.denied":
      "We don't have camera access. Allow the camera in your browser settings, or search manually.",
    "media.scanner.noCamera":
      "No camera found on this device. Search manually.",
    "media.scanner.generic":
      "The scanner isn't working on this device right now. Search manually.",
    "media.scanner.decodeError": "Scanning isn't working right now. Try again.",
    "media.scanner.defaultTitle": "Scan barcode",
    "media.scanner.defaultSubtitle": "Point the camera at the product barcode.",
    "media.scanner.uploadNotFound":
      "We couldn't find a barcode in the image. Shoot it close up, straight on, well lit — then try again.",
    "media.scanner.uploadFailed":
      "We couldn't read the image. Try again.",
    "media.scanner.readingImage": "Reading image…",
    "media.scanner.uploadButton": "Upload barcode photo",
    "media.scanner.requesting": "Requesting camera access...",
    "media.scanner.searchManually": "Search manually",
    "media.scanner.retry": "Try again",
    "media.scanner.orSearchManually": "Or search manually",
    "media.scanner.videoAria": "Camera view for scanning a barcode",
    "media.scanner.noBarcodeSearch": "Can't see the barcode? Search manually.",

    // Barcode lookup (F031)
    "media.scanLookup.checking": "Checking the barcode...",
    "media.scanLookup.failed":
      "We couldn't check the barcode. Try again.",
    "media.scanLookup.retry": "Try again",
    "media.scanLookup.searchFood": "Search food",

    // In-app camera capture
    "media.camera.denied":
      "No camera access. Allow the camera in your browser settings, or upload an existing photo.",
    "media.camera.noCamera":
      "We don't see a camera on this device. Upload an existing photo.",
    "media.camera.generic":
      "The camera isn't available right now. Upload an existing photo.",
    "media.camera.opening": "Opening the camera…",
    "media.camera.cancel": "Cancel",
    "media.camera.lens": "Lens",
    "media.camera.uploadExisting": "Upload an existing photo",
    "media.camera.takePhoto": "Take photo",

    // AI-thinking loader
    "media.aiThinking.title": "Estimating…",
    "media.aiThinking.line1": "Analyzing the photos…",
    "media.aiThinking.line2": "Recognizing ingredients…",
    "media.aiThinking.line3": "Calculating macros…",
    "media.aiThinking.line4": "Almost done…",

    // Portion dial
    "media.portion.coverage.quarter": "a quarter",
    "media.portion.coverage.half": "half",
    "media.portion.coverage.threeQuarters": "three\nquarters",
    "media.portion.coverage.wholePlate": "whole\nplate",
    "media.portion.level.bottom": "at the bottom",
    "media.portion.level.half": "half full",
    "media.portion.level.threeQuarters": "three\nquarters",
    "media.portion.level.top": "to the top",
    "media.portion.coverageLabel": "How much of the plate is covered",
    "media.portion.heightQuestion": "How tall is it?",
    "media.portion.fillLabel": "How full is it",
    "media.portion.fewerPieces": "Fewer pieces",
    "media.portion.morePieces": "More pieces",
    "media.portion.plateAria": "Plate with food",
    "media.portion.bowlAria": "Deep bowl with food",
    "media.portion.piecesAria": "{count} pieces",

    // Shot guide
    "media.shotGuide.topAria":
      "Animation: the phone is held flat above the plate and shoots straight down, a fork lying beside the plate",
    "media.shotGuide.angleAria":
      "Animation: the phone drops along an arc and tilts to 45 degrees to shoot the plate from the side",

    // Streak dots
    "media.streakDots.summaryAria":
      "{logged} of the last {total} days with a log",
    "media.streakDots.weekday.sun": "Sun",
    "media.streakDots.weekday.mon": "Mon",
    "media.streakDots.weekday.tue": "Tue",
    "media.streakDots.weekday.wed": "Wed",
    "media.streakDots.weekday.thu": "Thu",
    "media.streakDots.weekday.fri": "Fri",
    "media.streakDots.weekday.sat": "Sat",

    // Streak summary card
    "media.streakCard.hintStart": "Log a meal and start stacking up days.",
    "media.streakCard.hintNext": "{count} more to reach {target} days.",
    "media.streakCard.hintAllDone":
      "You've passed every goal — the streak is still going.",
    "media.streakCard.inARow": "{noun} in a row",
    "media.streakCard.startYourStreak": "Start your streak",
    "media.streakCard.longest": "Longest streak: {count}",
    "media.streakCard.loggedToday": "Logged today — the streak grows. 🔥",
    "media.streakCard.logToContinue":
      "Log at least one meal today to keep the streak going.",
    "media.streakCard.title": "Streak",
    "media.streakCard.daysWithLog": "Days with a log",

    // Streak pill
    "media.streakPill.label": "Streak: {count}",
    "media.streakPill.openAchievements": ". Open achievements.",

    // Achievement tile
    "media.achievement.earnedAria": "{title}: earned, {criteria}",
    "media.achievement.lockedAria":
      "{title}: locked, {value} of {threshold}",

    // Achievements screen
    "media.achievements.back": "Back",
    "media.achievements.title": "Achievements",
    "media.achievements.streak": "Streak",
    "media.achievements.longest": "longest: {count}",
    "media.achievements.badges": "Badges",
    "media.achievements.badgesEarnedAria": "{earned} of {total} badges earned",

    // Dostignuća page (expired session)
    "media.dostignuca.sessionExpired":
      "Your session has expired. Sign in again and try again.",
    "media.dostignuca.login": "Sign in",

    // Reward celebration
    "media.reward.streakAria": "{streak} {noun} in a row",
    "media.reward.dayOne": "day",
    "media.reward.dayMany": "days",
    "media.reward.dayInARowOne": "day in a row",
    "media.reward.dayInARowMany": "days in a row",
    "media.reward.title": "Full day!",
    "media.reward.subtitle": "You logged all three meals. The badge is yours.",
    "media.reward.continue": "Continue",
    "media.reward.viewAnalytics": "View Analytics",
    "media.reward.notYetTitle": "Almost there",
    "media.reward.oneMealLeft":
      "You're one meal short of the full badge for today.",
    "media.reward.mealsLeft":
      "You're {count} meals short of the full badge for today.",
    "media.reward.logMeal": "Log a meal",
    "media.reward.backToToday": "Back to Today",
  },
} as const;
