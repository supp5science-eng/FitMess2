export const profilMessages = {
  sr: {
    // Shared across /profil sub-pages
    "profil.sessionExpired": "Sesija je istekla. Prijavi se ponovo.",
    "profil.back": "← Nazad",
    "profil.saving": "Čuvam…",
    "profil.saved": "Sačuvano.",
    "profil.saveGoal": "Sačuvaj cilj",
    "profil.error.generic": "Nešto nije uspelo. Pokušaj ponovo.",

    // Cilj i plan (/profil/cilj)
    "profil.goal.completeFirst":
      "Prvo popuni lične podatke pa ćeš moći da postaviš cilj.",
    "profil.goal.currentWeight": "Trenutna težina: {weight} kg",
    "profil.goal.lose.label": "Smršaj",
    "profil.goal.lose.desc": "Kontrolisan kalorijski deficit.",
    "profil.goal.tone.label": "Zategni se",
    "profil.goal.tone.desc": "Blagi deficit za čvrstu liniju.",
    "profil.goal.gain.label": "Nabaci mišiće",
    "profil.goal.gain.desc": "Kalorijski višak za čistu masu.",
    "profil.goal.maintain.label": "Održavanje",
    "profil.goal.maintain.desc": "Zadrži trenutnu težinu.",
    "profil.goal.fieldLabel": "Cilj",
    "profil.goal.targetWeight": "Ciljna težina (kg)",
    "profil.goal.egGain": "npr. 85",
    "profil.goal.egLose": "npr. 75",
    "profil.goal.timeframe": "Rok (nedelja)",
    "profil.goal.timeframePlaceholder": "npr. 12",
    "profil.goal.newPlan": "Novi dnevni plan",
    "profil.goal.macroLine": "P {protein} · UH {carbs} · M {fat} g",
    "profil.goal.previewHint": "Unesi ciljnu težinu i rok da vidiš novi plan.",
    "profil.goal.saved": "Cilj je sačuvan. Plan je preračunat.",

    // Izgled (/profil/izgled)
    "profil.appearance.desc": "Izaberi svetlu ili tamnu temu. Primenjuje se odmah.",
    "profil.appearance.theme": "Tema",

    // Cilj koraka (/profil/koraci)
    "profil.steps.subtitle": "Koliko koraka dnevno ti brojimo kao pun dan.",
    "profil.steps.originTitle": "Odakle uopšte 10.000 koraka?",
    "profil.steps.originP1":
      "Iz reklame, ne iz medicine — 1965. u Japanu je prodavan pedometar pod imenom „manpo-kei“, što znači „merač od 10.000 koraka“, i broj se zalepio. Novija istraživanja pokazuju da korist naglo raste otprilike do 6.000–8.000 koraka dnevno, a posle toga se izravnava.",
    "profil.steps.originP2":
      "Zato ti mi predlažemo cilj prema tvom nivou aktivnosti, a ne isti broj svima. Cilj koji promašiš svaki dan nije cilj — samo razlog da prestaneš da gledaš karticu.",
    "profil.steps.auto": "Automatski",
    "profil.steps.autoSubtitle": "Prema tvom nivou aktivnosti",
    "profil.steps.custom": "Sam biram",
    "profil.steps.customSubtitle": "Postavi broj koji tebi ima smisla",
    "profil.steps.selectAria": "Dnevni cilj koraka",
    "profil.steps.optionLabel": "{steps} koraka",
    "profil.steps.avgLabel": "Tvoj prosek ({days} {dayWord} sa unosom) je",
    "profil.steps.day": "dan",
    "profil.steps.days": "dana",
    "profil.steps.suggestLabel": ". Predlog:",
    "profil.steps.saved": "Cilj koraka je sačuvan.",

    // Promeni lozinku (/profil/lozinka)
    "profil.password.new": "Nova lozinka",
    "profil.password.hide": "Sakrij lozinku",
    "profil.password.show": "Prikaži lozinku",
    "profil.password.minChars": "Bar 8 karaktera.",
    "profil.password.confirm": "Ponovi novu lozinku",
    "profil.password.saved": "Lozinka je promenjena.",
    "profil.password.submit": "Sačuvaj novu lozinku",

    // Moji podaci (/profil/moji-podaci)
    "profil.mydata.subtitle": "Ovo je sve što čuvamo o tebi.",
    "profil.mydata.account": "Nalog",
    "profil.mydata.memberSince": "Sa nama od",
    "profil.mydata.pdfLabel": "Preuzmi PDF",
    "profil.mydata.pdfReady": "Sačuvaj PDF",
    "profil.mydata.pdfDone": "PDF je sačuvan.",
    "profil.mydata.pdfNote":
      "Uredan izveštaj koji možeš otvoriti na telefonu, odštampati ili proslediti lekaru/treneru. Same slike obroka nisu u njemu — brišu se automatski otprilike dan po unosu, a kalorije i makroi tog obroka ostaju u tabeli unosa.",
    "profil.mydata.jsonLabel": "Preuzmi i .json (za prenos u drugu aplikaciju)",
    "profil.mydata.jsonReady": "Sačuvaj .json",
    "profil.mydata.jsonDone": ".json je sačuvan.",
    "profil.mydata.deleteNote":
      "Ako želiš da sve ovo nestane, u Podešavanjima postoji „Obriši nalog“ — briše nalog i sve podatke iz tabele iznad.",

    // Lični podaci (/profil/podaci)
    "profil.data.sessionExpired":
      "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    "profil.data.loadError":
      "Nismo uspeli da učitamo tvoje podatke. Pokušaj ponovo.",
    "profil.data.subtitle":
      "Kad promeniš težinu ili aktivnost, tvoj dnevni cilj se automatski preračunava.",
    "profil.data.backToSettings": "Nazad na podešavanja",
    "profil.data.female": "Žensko",
    "profil.data.male": "Muško",
    "profil.data.name": "Ime",
    "profil.data.namePlaceholder": "Tvoje ime",
    "profil.data.sex": "Pol",
    "profil.data.age": "Godine",
    "profil.data.height": "Visina",
    "profil.data.weight": "Težina",
    "profil.data.activity": "Nivo aktivnosti",
    "profil.data.submit": "Sačuvaj izmene",
    "profil.data.choose": "Izaberi",

    // Podsetnici (/profil/podsetnici)
    "profil.reminders.subtitle":
      "Najviše dve notifikacije dnevno, i samo kad stvarno ima šta da se kaže. Najvažnije je nedeljno merenje — bez njega plan nema po čemu da se pomeri.",
    "profil.reminders.errorGeneric": "Nešto je pošlo naopako.",
    "profil.reminders.testError": "Nismo uspeli da pošaljemo probnu notifikaciju.",
    "profil.reminders.mealTitle": "Obrok koji fali",
    "profil.reminders.mealDesc":
      "Javimo ti kad prođe tvoje uobičajeno vreme obroka, a nisi ga upisao. Najviše jednom dnevno.",
    "profil.reminders.eveningTitle": "Zatvaranje dana",
    "profil.reminders.eveningDesc":
      "Uveče, ali samo kad ima šta da se kaže — prazan dan, prekoračenje ili neupisan trening.",
    "profil.reminders.awardTitle": "Nagrada za pun dan",
    "profil.reminders.awardDesc": "Javi mi kad upišem treći obrok.",
    "profil.reminders.weighInTitle": "Nedeljno merenje",
    "profil.reminders.weighInChange": "Promeni dan i vreme",
    "profil.reminders.unsupported": "Ovaj pregledač ne podržava notifikacije.",
    "profil.reminders.needsInstall":
      "Na iPhone-u notifikacije rade samo kad je FitMess dodat na početni ekran. Otvori Podeli → „Dodaj na početni ekran”, pa uključi podsetnike iz instalirane aplikacije.",
    "profil.reminders.blocked":
      "Notifikacije su blokirane za FitMess. Uključi ih u podešavanjima telefona (Notifikacije → FitMess) pa se vrati ovde.",
    "profil.reminders.missingKey": "Notifikacije još nisu podešene na serveru.",
    "profil.reminders.sending": "Šaljem...",
    "profil.reminders.sendTest": "Pošalji probnu notifikaciju",
    "profil.reminders.testSent": "Poslato — trebalo bi da stigne za koji sekund.",
    "profil.reminders.time": "Vreme",

    // Navike error states (/profil/pravila)
    "profil.habits.loadError":
      "Nismo uspeli da učitamo tvoje navike. Proveri konekciju i pokušaj ponovo.",
    "profil.habits.retry": "Pokušaj ponovo",

    // Politika privatnosti (/profil/privatnost)
    "profil.privacy.p1":
      "FitMess čuva samo podatke koji su potrebni da aplikacija radi: tvoj nalog (email, broj telefona), podatke iz upitnika (pol, godine, visina, težina, aktivnost, cilj) i unete obroke. Ove podatke koristimo isključivo da bismo ti računali plan i pratili napredak.",
    "profil.privacy.p2":
      "Uneti obroci se u aplikaciji prikazuju 30 dana, a u bazi se čuvaju do 3 meseca pa se automatski brišu. U svakom trenutku možeš da preuzmeš svoje podatke ili obrišeš nalog iz Podešavanja.",
    "profil.privacy.p3":
      "Kompletan, pravno pregledan tekst politike privatnosti je u pripremi i biće objavljen ovde uskoro.",

    // Uslovi korišćenja (/profil/uslovi)
    "profil.terms.p1":
      "FitMess je alat za praćenje ishrane i pomoć pri postizanju tvog cilja. Procene kalorija i makronutrijenata su informativne prirode i ne predstavljaju medicinski savet. Za zdravstvene odluke posavetuj se sa lekarom ili nutricionistom.",
    "profil.terms.p2":
      "Odgovoran si za tačnost podataka koje unosiš. Trudimo se da baza namirnica bude tačna, ali ne garantujemo da je svaka vrednost bez greške.",
    "profil.terms.p3":
      "Kompletni, pravno pregledani uslovi korišćenja su u pripremi i biće objavljeni ovde uskoro.",

    // Broj telefona (/profil/telefon)
    "profil.phone.noNumber": "Još nemamo tvoj broj — možeš ga dodati ovde.",
    "profil.phone.dialAria": "Pozivni broj države",
    "profil.phone.willSave": "Sačuvaćemo",
    "profil.phone.note":
      "Koristimo ga samo za kontakt — nikad za prijavu i ne šaljemo ti SMS.",
    "profil.phone.saved": "Broj telefona je sačuvan.",
    "profil.phone.submit": "Sačuvaj broj",
  },
  en: {
    "profil.sessionExpired": "Your session expired. Sign in again.",
    "profil.back": "← Back",
    "profil.saving": "Saving…",
    "profil.saved": "Saved.",
    "profil.saveGoal": "Save goal",
    "profil.error.generic": "Something went wrong. Try again.",

    "profil.goal.completeFirst":
      "Fill in your personal details first, then you can set a goal.",
    "profil.goal.currentWeight": "Current weight: {weight} kg",
    "profil.goal.lose.label": "Lose weight",
    "profil.goal.lose.desc": "A controlled calorie deficit.",
    "profil.goal.tone.label": "Tone up",
    "profil.goal.tone.desc": "A gentle deficit for a firmer shape.",
    "profil.goal.gain.label": "Build muscle",
    "profil.goal.gain.desc": "A calorie surplus for lean mass.",
    "profil.goal.maintain.label": "Maintain",
    "profil.goal.maintain.desc": "Keep your current weight.",
    "profil.goal.fieldLabel": "Goal",
    "profil.goal.targetWeight": "Target weight (kg)",
    "profil.goal.egGain": "e.g. 85",
    "profil.goal.egLose": "e.g. 75",
    "profil.goal.timeframe": "Timeframe (weeks)",
    "profil.goal.timeframePlaceholder": "e.g. 12",
    "profil.goal.newPlan": "New daily plan",
    "profil.goal.macroLine": "P {protein} · C {carbs} · F {fat} g",
    "profil.goal.previewHint": "Enter a target weight and timeframe to see your new plan.",
    "profil.goal.saved": "Goal saved. Your plan has been recalculated.",

    "profil.appearance.desc": "Pick a light or dark theme. It applies right away.",
    "profil.appearance.theme": "Theme",

    "profil.steps.subtitle": "How many steps a day count as a full day for you.",
    "profil.steps.originTitle": "Where did 10,000 steps even come from?",
    "profil.steps.originP1":
      "From advertising, not medicine — in 1965 a pedometer was sold in Japan under the name “manpo-kei,” which means “10,000-step meter,” and the number stuck. Newer research shows the benefit rises sharply up to about 6,000–8,000 steps a day, and levels off after that.",
    "profil.steps.originP2":
      "That's why we suggest a goal based on your activity level, not the same number for everyone. A goal you miss every single day isn't a goal — just a reason to stop looking at the card.",
    "profil.steps.auto": "Automatic",
    "profil.steps.autoSubtitle": "Based on your activity level",
    "profil.steps.custom": "I'll choose",
    "profil.steps.customSubtitle": "Set a number that makes sense to you",
    "profil.steps.selectAria": "Daily step goal",
    "profil.steps.optionLabel": "{steps} steps",
    "profil.steps.avgLabel": "Your average ({days} {dayWord} with entries) is",
    "profil.steps.day": "day",
    "profil.steps.days": "days",
    "profil.steps.suggestLabel": ". Suggestion:",
    "profil.steps.saved": "Step goal saved.",

    "profil.password.new": "New password",
    "profil.password.hide": "Hide password",
    "profil.password.show": "Show password",
    "profil.password.minChars": "At least 8 characters.",
    "profil.password.confirm": "Repeat new password",
    "profil.password.saved": "Password changed.",
    "profil.password.submit": "Save new password",

    "profil.mydata.subtitle": "This is everything we store about you.",
    "profil.mydata.account": "Account",
    "profil.mydata.memberSince": "With us since",
    "profil.mydata.pdfLabel": "Download PDF",
    "profil.mydata.pdfReady": "Save PDF",
    "profil.mydata.pdfDone": "PDF saved.",
    "profil.mydata.pdfNote":
      "A tidy report you can open on your phone, print, or send to your doctor or trainer. The meal photos themselves aren't in it — they're deleted automatically about a day after logging, while the calories and macros for that meal stay in your entries.",
    "profil.mydata.jsonLabel": "Also download .json (to move to another app)",
    "profil.mydata.jsonReady": "Save .json",
    "profil.mydata.jsonDone": ".json saved.",
    "profil.mydata.deleteNote":
      "If you want all of this gone, there's a “Delete account” option in Settings — it deletes your account and all the data in the table above.",

    "profil.data.sessionExpired":
      "Your session expired. Sign in again and try once more.",
    "profil.data.loadError": "We couldn't load your data. Try again.",
    "profil.data.subtitle":
      "When you change your weight or activity, your daily goal recalculates automatically.",
    "profil.data.backToSettings": "Back to settings",
    "profil.data.female": "Female",
    "profil.data.male": "Male",
    "profil.data.name": "Name",
    "profil.data.namePlaceholder": "Your name",
    "profil.data.sex": "Sex",
    "profil.data.age": "Age",
    "profil.data.height": "Height",
    "profil.data.weight": "Weight",
    "profil.data.activity": "Activity level",
    "profil.data.submit": "Save changes",
    "profil.data.choose": "Choose",

    "profil.reminders.subtitle":
      "Two notifications a day at most, and only when there's really something to say. The weekly weigh-in matters most — without it your plan has nothing to adjust to.",
    "profil.reminders.errorGeneric": "Something went wrong.",
    "profil.reminders.testError": "We couldn't send the test notification.",
    "profil.reminders.mealTitle": "The meal you missed",
    "profil.reminders.mealDesc":
      "We ping you when your usual meal time has passed and it isn't logged. Once a day at most.",
    "profil.reminders.eveningTitle": "Closing the day",
    "profil.reminders.eveningDesc":
      "In the evening, but only when there's something to say — an empty day, an overshoot, or an unlogged workout.",
    "profil.reminders.awardTitle": "Full-day reward",
    "profil.reminders.awardDesc": "Let me know when I log my third meal.",
    "profil.reminders.weighInTitle": "Weekly weigh-in",
    "profil.reminders.weighInChange": "Change day and time",
    "profil.reminders.unsupported": "This browser doesn't support notifications.",
    "profil.reminders.needsInstall":
      "On iPhone, notifications only work when FitMess is added to your home screen. Open Share → “Add to Home Screen,” then turn on reminders from the installed app.",
    "profil.reminders.blocked":
      "Notifications are blocked for FitMess. Turn them on in your phone's settings (Notifications → FitMess), then come back here.",
    "profil.reminders.missingKey": "Notifications aren't set up on the server yet.",
    "profil.reminders.sending": "Sending...",
    "profil.reminders.sendTest": "Send a test notification",
    "profil.reminders.testSent": "Sent — it should arrive in a few seconds.",
    "profil.reminders.time": "Time",

    "profil.habits.loadError":
      "We couldn't load your habits. Check your connection and try again.",
    "profil.habits.retry": "Try again",

    "profil.privacy.p1":
      "FitMess stores only the data needed for the app to work: your account (email, phone number), the details from the questionnaire (sex, age, height, weight, activity, goal), and the meals you log. We use this data solely to calculate your plan and track your progress.",
    "profil.privacy.p2":
      "Logged meals are shown in the app for 30 days, and kept in the database for up to 3 months before being deleted automatically. You can download your data or delete your account from Settings at any time.",
    "profil.privacy.p3":
      "The complete, legally reviewed privacy policy is in preparation and will be published here soon.",

    "profil.terms.p1":
      "FitMess is a tool for tracking your nutrition and helping you reach your goal. Calorie and macronutrient estimates are informational and are not medical advice. For health decisions, consult a doctor or nutritionist.",
    "profil.terms.p2":
      "You are responsible for the accuracy of the data you enter. We work to keep the food database accurate, but we don't guarantee that every value is error-free.",
    "profil.terms.p3":
      "The complete, legally reviewed terms of use are in preparation and will be published here soon.",

    "profil.phone.noNumber": "We don't have your number yet — you can add it here.",
    "profil.phone.dialAria": "Country dialing code",
    "profil.phone.willSave": "We'll save",
    "profil.phone.note":
      "We use it only to reach you — never to sign in, and we won't text you.",
    "profil.phone.saved": "Phone number saved.",
    "profil.phone.submit": "Save number",
  },
} as const;
