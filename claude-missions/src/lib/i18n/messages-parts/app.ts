export const appMessages = {
  sr: {
    // Landing hero (/)
    "app.landing.hero.title": "Prati kalorije bez muke",
    "app.landing.hero.start": "Započni",
    "app.landing.hero.haveAccount": "Već imaš nalog?",
    "app.landing.hero.signIn": "Prijavi se",
    "app.landing.hero.peek": "Zaviri",
    "app.landing.hero.badge": "Prelaunch · web verzija",

    // Landing "where you can get it" status. Deliberately makes NO promise
    // about a date -- "u pripremi" is the honest state, and a missed date on a
    // landing page costs more trust than the wait itself.
    "app.landing.stores.heading": "Gde možeš da ga preuzmeš",
    "app.landing.stores.body":
      "Na iPhone-u ga skineš sa App Store-a. Za Android je Google Play u pripremi, pa dotle ide kao web aplikacija: otvoriš na telefonu, dodaš na početni ekran i dobiješ svoju ikonicu, podsetnike i pun ekran, bez pretraživača okolo.",
    "app.landing.stores.web": "Web aplikacija",
    "app.landing.stores.nowNote": "Dostupno sada",
    "app.landing.stores.appStore": "App Store",
    "app.landing.stores.play": "Google Play",
    "app.landing.stores.soonNote": "U pripremi",
    "app.landing.stores.foot":
      "Isti nalog, isti podaci — svejedno odakle ga otvoriš. Ništa što uneseš sada se ne gubi.",

    // Landing feature showcase
    "app.landing.features.heading": "Šta te čeka unutra",
    "app.landing.feature.plan.title": "Dnevni cilj skrojen za tebe",
    "app.landing.feature.plan.body": "Kalorije i makroi na osnovu par pitanja o tebi.",
    "app.landing.feature.log.title": "Unos obroka za par sekundi",
    "app.landing.feature.log.body": "Pretraga hrane, porcije i tvoji proizvodi.",
    "app.landing.feature.ring.title": "Prsten kalorija i makro trake",
    "app.landing.feature.ring.body": "Potrošeno ↔ preostalo, na prvi pogled.",
    "app.landing.feature.week.title": "Nedeljni pregled i trend težine",
    "app.landing.feature.week.body": "Gledaš nedelju, ne pojedinačan dan.",

    // Landing closing CTA
    "app.landing.close.title": "Nedelja je jedinica uspeha.",
    "app.landing.close.body": "Jedan loš obrok te ne ruši — samo miran, održiv tempo.",
    "app.landing.close.cta": "Kreni besplatno",

    // Access-denied page (/nemas-pristup)
    "app.noAccess.title": "Nemaš pristup",
    "app.noAccess.body": "Nemaš dozvolu da vidiš ovu stranicu.",
    "app.noAccess.back": "Nazad na Danas",

    // Common
    "app.common.close": "Zatvori",

    // Simulated OS / browser UI labels (install walkthroughs)
    "app.os.newTab": "Nova kartica",
    "app.os.installApp": "Instaliraj aplikaciju",
    "app.os.history": "Istorija",

    // Install overlay (in-app nudge)
    "app.pwi.ariaLabel": "Preuzmi FitMess",
    "app.pwi.title.a": "Tvoj plan te čeka",
    "app.pwi.title.hi": "na jedan tap",
    "app.pwi.sub": "Dodaj FitMess na početni ekran — otvara se kao prava aplikacija, bez kucanja adrese.",
    "app.pwi.store.sub": "Preuzmi FitMess i otvara se kao prava aplikacija — sa svojom ikonicom, podsetnicima i punim ekranom.",
    "app.pwi.store.ios": "Preuzmi sa App Store-a",
    "app.pwi.store.android": "Preuzmi sa Google Play-a",
    "app.pwi.skip": "Nastavi u pregledaču",
    "app.pwi.done.title": "Instalirano! 🎉",
    "app.pwi.done.a": "Potraži",
    "app.pwi.done.b": "FitMess",
    "app.pwi.done.c": "na početnom ekranu — tu te čeka tvoj plan.",
    "app.pwi.step.android.menu.a": "Tapni meni",
    "app.pwi.step.android.menu.c": "gore desno",
    "app.pwi.step.android.install.a": "Izaberi",
    "app.pwi.step.android.install.b": "Instaliraj aplikaciju",
    "app.pwi.step.done.a": "I",
    "app.pwi.step.done.b": "FitMess",
    "app.pwi.step.done.c": "je na tvom ekranu 🎉",

    // Launch splash
    "app.splash.aria": "FitMess se učitava",

    // Desktop / phone-only gate (/samo-za-telefon)
    "app.desktop.title": "FitMess radi samo na telefonu.",
    "app.desktop.body": "Napravljen je isključivo za mobilnu upotrebu. Skeniraj QR kod kamerom telefona i kreni.",
    "app.desktop.qrAria": "QR kod za {url}",
    "app.desktop.openInBrowser": "Ili u pregledaču na telefonu otvori:",

    // Data export button (/profil/moji-podaci)
    "app.export.preparing": "Pripremam…",
    "app.export.ready": "Fajl je spreman — dodirni još jednom da izabereš gde da ga sačuvaš.",

    // Offline strip (app-wide). Deliberately states the fact and nothing more:
    // the app cannot save anything without a connection, and pretending
    // otherwise would be worse than saying so.
    "app.offline.banner": "Nema veze sa internetom — unos se ne čuva.",

    // Refresh app button (Settings)
    "app.refresh.busy": "Osvežavam…",
    "app.refresh.label": "Osveži aplikaciju",
    "app.refresh.desc": "Učitaj najnoviju verziju",

    // Account switcher (Settings)
    "app.account.title": "Promeni nalog",
    "app.account.subtitle": "Prebaci se na drugi nalog",
    "app.account.done": "Gotovo",
    "app.account.edit": "Uredi",
    "app.account.current": "Trenutni nalog",
    "app.account.tapToSwitch": "Tapni da se prebaciš",
    "app.account.remove": "Ukloni",
    "app.account.addAnother": "Dodaj drugi nalog",
    "app.account.note": "Nalozi se pamte samo na ovom uređaju. „Ukloni\" ne briše nalog, samo ga sklanja sa ovog telefona.",

    // Day-structure guidance (/profil/pravila)
    "app.day.aria": "Predlog rasporeda obroka -- nije obavezujuće",
    "app.day.heading": "Predlog rasporeda obroka",
    "app.day.body": "Ovo je samo orijentacija, ne obaveza -- rasporedi kalorije kako tebi odgovara.",
    "app.day.breakfast": "Doručak",
    "app.day.lunch": "Ručak",
    "app.day.snack": "Užina",
    "app.day.dinner": "Večera",
  },
  en: {
    // Landing hero (/)
    "app.landing.hero.title": "Track calories the easy way",
    "app.landing.hero.start": "Get started",
    "app.landing.hero.haveAccount": "Already have an account?",
    "app.landing.hero.signIn": "Sign in",
    "app.landing.hero.peek": "Take a peek",
    "app.landing.hero.badge": "Prelaunch · web version",

    // Landing "where you can get it" status
    "app.landing.stores.heading": "Where you can get it",
    "app.landing.stores.body":
      "On iPhone you download it from the App Store. For Android, Google Play is still in progress, so until then it runs as a web app: open it on your phone, add it to your home screen, and you get your own icon, reminders and a full screen, with no browser around it.",
    "app.landing.stores.web": "Web app",
    "app.landing.stores.nowNote": "Available now",
    "app.landing.stores.appStore": "App Store",
    "app.landing.stores.play": "Google Play",
    "app.landing.stores.soonNote": "In progress",
    "app.landing.stores.foot":
      "Same account, same data — wherever you open it from. Nothing you log now is lost.",

    // Landing feature showcase
    "app.landing.features.heading": "What's waiting inside",
    "app.landing.feature.plan.title": "A daily goal tailored to you",
    "app.landing.feature.plan.body": "Calories and macros from a few questions about you.",
    "app.landing.feature.log.title": "Log a meal in seconds",
    "app.landing.feature.log.body": "Food search, portions, and your own products.",
    "app.landing.feature.ring.title": "Calorie ring and macro bars",
    "app.landing.feature.ring.body": "Consumed ↔ remaining, at a glance.",
    "app.landing.feature.week.title": "Weekly overview and weight trend",
    "app.landing.feature.week.body": "You watch the week, not a single day.",

    // Landing closing CTA
    "app.landing.close.title": "The week is the unit of success.",
    "app.landing.close.body": "One bad meal won't derail you — just a calm, sustainable pace.",
    "app.landing.close.cta": "Start for free",

    // Access-denied page (/nemas-pristup)
    "app.noAccess.title": "No access",
    "app.noAccess.body": "You don't have permission to view this page.",
    "app.noAccess.back": "Back to Today",

    // Common
    "app.common.close": "Close",

    // Simulated OS / browser UI labels (install walkthroughs)
    "app.os.newTab": "New tab",
    "app.os.installApp": "Install app",
    "app.os.history": "History",

    // Install overlay (in-app nudge)
    "app.pwi.ariaLabel": "Get FitMess",
    "app.pwi.title.a": "Your plan is",
    "app.pwi.title.hi": "one tap away",
    "app.pwi.sub": "Add FitMess to your home screen — it opens like a real app, no typing the address.",
    "app.pwi.store.sub": "Get FitMess and it opens like a real app — its own icon, reminders and a full screen.",
    "app.pwi.store.ios": "Get it on the App Store",
    "app.pwi.store.android": "Get it on Google Play",
    "app.pwi.skip": "Keep using the browser",
    "app.pwi.done.title": "Installed! 🎉",
    "app.pwi.done.a": "Look for",
    "app.pwi.done.b": "FitMess",
    "app.pwi.done.c": "on your home screen — your plan is waiting there.",
    "app.pwi.step.android.menu.a": "Tap the",
    "app.pwi.step.android.menu.c": "menu top-right",
    "app.pwi.step.android.install.a": "Choose",
    "app.pwi.step.android.install.b": "Install app",
    "app.pwi.step.done.a": "And",
    "app.pwi.step.done.b": "FitMess",
    "app.pwi.step.done.c": "is on your screen 🎉",

    // Launch splash
    "app.splash.aria": "FitMess is loading",

    // Desktop / phone-only gate (/samo-za-telefon)
    "app.desktop.title": "FitMess works on your phone only.",
    "app.desktop.body": "It's built exclusively for mobile use. Scan the QR code with your phone's camera and get going.",
    "app.desktop.qrAria": "QR code for {url}",
    "app.desktop.openInBrowser": "Or open this in your phone's browser:",

    // Data export button (/profil/moji-podaci)
    "app.export.preparing": "Preparing…",
    "app.export.ready": "Your file is ready — tap once more to choose where to save it.",

    // Offline strip (app-wide).
    "app.offline.banner": "No internet connection — nothing is being saved.",

    // Refresh app button (Settings)
    "app.refresh.busy": "Refreshing…",
    "app.refresh.label": "Refresh app",
    "app.refresh.desc": "Load the latest version",

    // Account switcher (Settings)
    "app.account.title": "Switch account",
    "app.account.subtitle": "Switch to another account",
    "app.account.done": "Done",
    "app.account.edit": "Edit",
    "app.account.current": "Current account",
    "app.account.tapToSwitch": "Tap to switch",
    "app.account.remove": "Remove",
    "app.account.addAnother": "Add another account",
    "app.account.note": "Accounts are remembered only on this device. “Remove” doesn't delete the account, it just takes it off this phone.",

    // Day-structure guidance (/profil/pravila)
    "app.day.aria": "Suggested meal schedule -- not binding",
    "app.day.heading": "Suggested meal schedule",
    "app.day.body": "This is just a rough guide, not an obligation -- split your calories however works for you.",
    "app.day.breakfast": "Breakfast",
    "app.day.lunch": "Lunch",
    "app.day.snack": "Snack",
    "app.day.dinner": "Dinner",
  },
} as const;
