/**
 * The three legal documents: privacy policy, terms of use, account deletion.
 *
 * This copy is written to be *read*, not to be survived. Every other screen in
 * FitMess talks to the user plainly, and a document that switches into
 * "hereinafter referred to as" the moment the topic gets serious teaches the
 * user that the serious parts are not for them. So: same voice, same "ti",
 * short sentences — while still naming the controller, the legal bases, the
 * processors, the retention periods and the rights, because those are what
 * make it a policy rather than a reassurance.
 *
 * Facts here are read out of the code, not invented. Retention numbers come
 * from `supabase/migrations/0010_logs_retention.sql` (logs) and the meal-photo
 * cleanup job; the processor list is exactly what the app actually calls
 * (Supabase, Vercel, Google Gemini, Resend — nothing else, no analytics, no ad
 * SDK); the deletion description mirrors `src/lib/account/delete-account.ts`
 * and `src/lib/export/user-data.ts`. When any of those change, this changes.
 *
 * `{name}`, `{email}`, `{date}` and `{age}` are interpolated from
 * `src/lib/legal/controller.ts`. There is deliberately no `{address}` — see the
 * note at the bottom of that file for where the postal address does belong.
 */

export const legalMessages = {
  sr: {
    // -- Shared chrome -----------------------------------------------------
    "legal.effective": "Važi od {date}",
    "legal.backToApp": "Nazad u aplikaciju",
    "legal.backLink": "Nazad",
    "legal.backToSettings": "Podešavanja",
    "legal.otherDocs": "Ostali dokumenti",

    // -- Politika privatnosti ---------------------------------------------
    "legal.privacy.title": "Politika privatnosti",
    "legal.privacy.lead":
      "Ovde piše šta FitMess zna o tebi, zašto to zna, ko još to vidi i kako da to obrišeš. Bez sitnih slova — ako nešto ovde ne piše, ne radimo to.",

    "legal.privacy.controller.h": "Ko obrađuje tvoje podatke",
    "legal.privacy.controller.body":
      "FitMess vodi {name}, kao fizičko lice iz Srbije. Rukovalac podacima u smislu Zakona o zaštiti podataka o ličnosti i Opšte uredbe o zaštiti podataka (GDPR) je to isto lice. Za svako pitanje o podacima piši na {email} — javljamo se u roku od 30 dana, obično isti dan. Punu poslovnu adresu možeš videti i na stranici aplikacije u App Store-u i na Google Play-u.",

    "legal.privacy.collect.h": "Šta prikupljamo",
    "legal.privacy.collect.lead":
      "Samo ono što aplikacija stvarno koristi. Ništa se ne prikuplja „za svaki slučaj“.",
    "legal.privacy.collect.account.h": "Nalog",
    "legal.privacy.collect.account.body":
      "Email adresa i broj telefona koje upišeš pri registraciji, i lozinka — nju nikad ne vidimo, čuva se kao kriptografski otisak kod Supabase Auth. Ako se prijaviš preko Google naloga, od Google-a dobijamo samo tvoju email adresu.",
    "legal.privacy.collect.health.h": "Podaci o telu i ishrani",
    "legal.privacy.collect.health.body":
      "Iz upitnika: pol, godine, visina, težina, nivo aktivnosti i cilj. Iz svakodnevnog korišćenja: obroci koje upišeš (naziv, količina, kalorije, makronutrijenti), voda, koraci, treninzi, merenja težine, čekirane navike i tvoji odgovori na pitanja o danu. To su podaci o zdravlju i tretiramo ih strože od ostalih — vidi odeljak niže.",
    "legal.privacy.collect.media.h": "Fotografije i glas",
    "legal.privacy.collect.media.body":
      "Kad slikaš obrok, deklaraciju ili izgovoriš šta si jeo, ta slika odnosno snimak ide na obradu veštačkoj inteligenciji da bi se procenile kalorije. Snimci glasa se ne čuvaju — obrade se i odbace. Fotografija obroka se privremeno čuva uz taj unos (oko jedan dan) da bismo mogli da ti prikažemo karticu obroka, pa se automatski briše.",
    "legal.privacy.collect.tech.h": "Tehnički podaci",
    "legal.privacy.collect.tech.body":
      "Kolačići neophodni za rad (prijava, izabrani jezik, tema), i zabeleška kada si prvi put stigao do pojedinih koraka u aplikaciji — to koristimo da vidimo gde ljudi zapinju. Ako uključiš podsetnike, čuvamo i oznaku tvog uređaja da bismo mogli da pošaljemo notifikaciju. Nemamo Google Analytics, Facebook piksel, ni bilo koji reklamni ili analitički SDK trećih lica.",

    "legal.privacy.why.h": "Zašto i po kom osnovu",
    "legal.privacy.why.contract":
      "Da bi aplikacija radila — nalog, računanje dnevnog budžeta, prikaz napretka. Pravni osnov: izvršenje ugovora koji si zaključio prihvatanjem uslova korišćenja.",
    "legal.privacy.why.consent":
      "Za podatke o telu i ishrani, za obradu fotografija i glasa veštačkom inteligencijom, i za slanje notifikacija. Pravni osnov: tvoj izričit pristanak, koji daješ time što te podatke uneseš odnosno uključiš tu opciju. Pristanak možeš da povučeš u svakom trenutku — prestaneš da unosiš, isključiš podsetnike, ili obrišeš nalog.",
    "legal.privacy.why.legitimate":
      "Za bezbednost servisa i sprečavanje zloupotrebe naloga. Pravni osnov: legitimni interes.",
    "legal.privacy.why.note":
      "Ne donosimo odluke o tebi automatski na način koji proizvodi pravne posledice, i ne pravimo profil za reklamiranje. Plan koji ti aplikacija računa je matematika po opštim formulama, ne procena tvoje ličnosti.",

    "legal.privacy.health.h": "Podaci o zdravlju",
    "legal.privacy.health.body":
      "Težina, unos hrane i cilj mršavljenja ili dobijanja spadaju u posebnu vrstu podataka o ličnosti — podatke o zdravlju. Zato ih obrađujemo isključivo na osnovu tvog izričitog pristanka, koristimo ih samo da bismo ti računali i prikazivali plan, i nikada ih ne prodajemo, ne ustupamo osiguravajućim društvima, poslodavcima ni bilo kome drugom. Ako povučeš pristanak, brisanjem naloga ti podaci nestaju.",

    "legal.privacy.share.h": "Ko još vidi tvoje podatke",
    "legal.privacy.share.lead":
      "Četiri firme, svaka za tačno jedan posao, sve po ugovoru o obradi podataka. Niko od njih ne sme da koristi tvoje podatke za sebe.",
    "legal.privacy.share.supabase":
      "Supabase — baza podataka i prijava na nalog. Tvoji podaci fizički leže na serverima u Irskoj (Evropska unija).",
    "legal.privacy.share.vercel":
      "Vercel — server koji isporučuje aplikaciju.",
    "legal.privacy.share.google":
      "Google (Gemini API) — procena kalorija sa fotografije, deklaracije i glasa. Slika odnosno snimak ne ide sa tvog telefona pravo Google-u: prvo stiže na naš server, i on je prosleđuje Gemini-ju uz samu sliku i pitanje — bez tvog imena, email adrese ili oznake naloga, tako da Google ne zna čija je. Koristimo plaćeni nivo usluge, kod koga se poslati sadržaj ne koristi za obučavanje Google-ovih modela. Google obradi sliku i vrati procenu; kod sebe je ne zadržava kao tvoj sadržaj niti je pravi trajnu kopiju za nas. Jedina kopija koja negde ostane je ona kod nas — mala sličica uz taj obrok, oko jedan dan (vidi „Koliko dugo čuvamo“). Snimak glasa ne ostaje ni kod nas ni kod njih.",
    "legal.privacy.share.resend":
      "Resend — slanje email poruka (potvrda naloga, promena lozinke).",
    "legal.privacy.share.never":
      "To je ceo spisak. Ne prodajemo podatke, ne razmenjujemo ih i ne prosleđujemo reklamnim mrežama. Podatke bismo dali državnom organu samo ako nas na to obaveže zakon.",

    "legal.privacy.transfer.h": "Iznošenje van Evrope",
    "legal.privacy.transfer.body":
      "Baza je u Irskoj. Vercel i Google mogu obrađivati podatke i na serverima van Evropskog ekonomskog prostora; u tom slučaju prenos je pokriven standardnim ugovornim klauzulama Evropske komisije, koje su za to predviđen pravni instrument.",

    "legal.privacy.keep.h": "Koliko dugo čuvamo",
    "legal.privacy.keep.account":
      "Nalog, profil i tvoj plan — dok god imaš nalog.",
    "legal.privacy.keep.logs":
      "Uneti obroci — u aplikaciji vidiš poslednjih 30 dana, a u bazi se čuvaju 3 meseca pa ih automatski briše zakazani posao.",
    "legal.privacy.keep.photos":
      "Fotografije obroka — oko jedan dan, pa se brišu automatski.",
    "legal.privacy.keep.voice": "Snimci glasa — ne čuvaju se uopšte.",
    "legal.privacy.keep.delete":
      "Kad obrišeš nalog — sve nestaje odmah. U rezervnim kopijama baze podaci mogu da ostanu najviše 30 dana, dok se te kopije ne prepišu.",

    "legal.privacy.rights.h": "Tvoja prava",
    "legal.privacy.rights.lead":
      "Po zakonu imaš pravo da: dobiješ uvid u svoje podatke, ispraviš netačne, obrišeš ih, dobiješ ih u prenosivom obliku, ograničiš ili osporiš obradu i povučeš pristanak.",
    "legal.privacy.rights.inApp":
      "Većinu toga uradiš sam, odmah, bez pisanja ikome: u Podešavanjima „Moji podaci“ ti pokaže sve što čuvamo i preuzme kopiju kao datoteku, „Lični podaci“ i „Cilj i plan“ menjaju podatke, a „Obriši nalog“ briše sve.",
    "legal.privacy.rights.email":
      "Za sve ostalo piši na {email}.",
    "legal.privacy.rights.complaint":
      "Ako misliš da radimo nešto pogrešno, imaš pravo da se žališ nadzornom organu: u Srbiji je to Poverenik za informacije od javnog značaja i zaštitu podataka o ličnosti, a ako živiš u Evropskoj uniji, nadzorni organ svoje države.",

    "legal.privacy.age.h": "Uzrast",
    "legal.privacy.age.body":
      "FitMess je namenjen osobama od {age} godina naviše. Nalog ne pravimo namerno mlađima; ako saznamo da je nalog napravilo mlađe lice, brišemo ga. Ako si roditelj i misliš da tvoje dete ima nalog, javi se na {email}.",

    "legal.privacy.cookies.h": "Kolačići",
    "legal.privacy.cookies.body":
      "Koristimo samo one bez kojih aplikacija ne radi: kolačić prijave, izabrani jezik, izabranu temu i oznaku da si prošao početno podešavanje. Nema kolačića za praćenje i zato nema ni banera koji te za njih pita.",

    "legal.privacy.security.h": "Bezbednost",
    "legal.privacy.security.body":
      "Sav saobraćaj ide preko HTTPS-a. Lozinke se čuvaju kao kriptografski otisak. U bazi je uključena zaštita na nivou reda, što znači da upit jednog korisnika tehnički ne može da dohvati red drugog korisnika — nije stvar pažnje pri pisanju koda, nego pravila u samoj bazi.",

    "legal.privacy.changes.h": "Izmene",
    "legal.privacy.changes.body":
      "Ako se ovo promeni, promenićemo datum na vrhu. Ako promena bude značajna — nova vrsta podataka, nov obrađivač — javićemo ti u aplikaciji pre nego što počne da važi.",

    "legal.privacy.contact.h": "Kontakt",
    "legal.privacy.contact.body":
      "{name}, Srbija. Email: {email}.",

    // -- Uslovi korišćenja -------------------------------------------------
    "legal.terms.title": "Uslovi korišćenja",
    "legal.terms.lead":
      "FitMess je alat za praćenje ishrane: upisuješ šta jedeš, a mi računamo dnevni budžet kalorija i makronutrijenata i pratimo kako se krećeš ka svom cilju. Korišćenjem aplikacije prihvataš ove uslove.",

    "legal.terms.provider.h": "Ko pruža uslugu",
    "legal.terms.provider.body":
      "FitMess pruža {name}, kao fizičko lice iz Srbije. Kontakt: {email}. Puni podaci o pružaocu usluge stoje uz aplikaciju u App Store-u i na Google Play-u.",

    "legal.terms.medical.h": "Nije medicinski savet",
    "legal.terms.medical.body":
      "FitMess nije medicinsko sredstvo i ne daje medicinski, dijagnostički ni terapijski savet. Brojevi koje vidiš — dnevni budžet, makronutrijenti, procena potrošnje, predlozi za korekciju plana — su informativne procene po opštim formulama, a ne nalaz o tvom zdravlju. Ne postavljamo dijagnozu, ne lečimo i ne zamenjujemo lekara ni nutricionistu. Ništa u aplikaciji nije razlog da odložiš odlazak lekaru ili da menjaš terapiju koju ti je lekar propisao.",

    "legal.terms.doctor.h": "Kad se obavezno javi lekaru",
    "legal.terms.doctor.lead":
      "Pre nego što počneš da menjaš ishranu po planu iz aplikacije, posavetuj se sa lekarom ako se prepoznaješ u nečemu od ovoga:",
    "legal.terms.doctor.li1": "trudna si ili dojiš",
    "legal.terms.doctor.li2":
      "imaš dijabetes ili piješ terapiju koja zavisi od unosa hrane (insulin, varfarin i slično)",
    "legal.terms.doctor.li3": "imaš bolest srca, bubrega, jetre ili štitne žlezde",
    "legal.terms.doctor.li4": "imaš poremećaj ishrane ili si ga imao/la ranije",
    "legal.terms.doctor.li5": "mlađi/a si od 18 godina",
    "legal.terms.doctor.li6":
      "oporavljaš se od operacije, povrede ili teže bolesti",
    "legal.terms.doctor.note":
      "Ako ti se dok pratiš plan jave vrtoglavica, nesvestica, izrazit umor, ubrzan rad srca ili bilo koji simptom koji te brine — stani i obrati se lekaru.",

    "legal.terms.account.h": "Nalog",
    "legal.terms.account.body":
      "Za korišćenje ti treba nalog i najmanje {age} godina. Nalog je tvoj lični — čuvaj lozinku i ne deli pristup. Podaci koje upišeš treba da budu tačni, jer se ceo plan računa iz njih. Nalog možeš obrisati sam, u svakom trenutku, iz Podešavanja.",

    "legal.terms.price.h": "Cena",
    "legal.terms.price.body":
      "Trenutno je aplikacija besplatna. Ubuduće planiramo pretplatu, sa 7 dana besplatnog korišćenja za nove korisnike pre naplate. Ako do toga dođe, cenu i uslove ćemo jasno prikazati pre nego što bilo šta platiš — nikad se ništa ne naplaćuje bez potvrde. Naplata ide preko App Store-a odnosno Google Play-a, po njihovim pravilima; tamo pretplatu i otkazuješ i tamo tražiš povraćaj novca.",

    "legal.terms.accuracy.h": "Tačnost brojeva i AI procena",
    "legal.terms.accuracy.body":
      "Trudimo se da baza namirnica bude tačna, ali ne garantujemo da je svaka vrednost bez greške. Procene sa slike, glasa i deklaracije radi veštačka inteligencija — to je procena, ne merenje, i ume da promaši. Proveri je i ispravi kad ti nešto ne deluje tačno.",

    "legal.terms.responsibility.h": "Tvoja odgovornost",
    "legal.terms.responsibility.body":
      "Odgovoran/na si za podatke koje unosiš i za odluke koje donosiš na osnovu onoga što ti aplikacija pokaže. FitMess je namenjen zdravim odraslim osobama koje žele da prate ishranu.",

    "legal.terms.availability.h": "Dostupnost i prekid",
    "legal.terms.availability.body":
      "Trudimo se da aplikacija radi, ali ne obećavamo da neće biti prekida — održavanje, kvar kod nekog od servisa na koje se oslanjamo, ili greška u kodu. Zadržavamo pravo da nalog ukinemo ako se aplikacija koristi na način koji šteti drugim korisnicima ili servisu. Pre nego što ukinemo nalog, javljamo ti na email, osim ako to zakon ne zabranjuje.",

    "legal.terms.ip.h": "Sadržaj i vlasništvo",
    "legal.terms.ip.body":
      "Aplikacija, njen izgled, ime i logo su naši. Ono što ti uneseš — tvoji obroci, merenja, beleške — ostaje tvoje; nama treba samo koliko je potrebno da ti prikažemo aplikaciju i sačuvamo tvoje podatke.",

    "legal.terms.liability.h": "Granica odgovornosti",
    "legal.terms.liability.body":
      "Aplikacija se koristi takva kakva jeste. U granicama koje zakon dozvoljava, ne odgovaramo za štetu nastalu oslanjanjem na procene i brojeve iz aplikacije, niti za prekide u radu servisa. Ovim se ne isključuje odgovornost koja se po zakonu ne može isključiti, niti tvoja prava kao potrošača.",

    "legal.terms.changes.h": "Izmene uslova",
    "legal.terms.changes.body":
      "Uslove možemo da menjamo. Datum na vrhu pokazuje kad je poslednja verzija stupila na snagu, a značajnu promenu javljamo u aplikaciji pre nego što počne da važi. Ako ti nova verzija ne odgovara, možeš da prestaneš da koristiš aplikaciju i obrišeš nalog.",

    "legal.terms.law.h": "Merodavno pravo",
    "legal.terms.law.body":
      "Na ove uslove primenjuje se pravo Republike Srbije. Ako si potrošač iz Evropske unije, ovo ti ne oduzima zaštitu koju ti daju propisi tvoje države. Sporove prvo pokušavamo da rešimo dogovorom — piši na {email}.",

    // -- Brisanje naloga ---------------------------------------------------
    "legal.delete.title": "Brisanje FitMess naloga",
    "legal.delete.lead":
      "Nalog možeš da obrišeš sam, iz aplikacije, bez pisanja ikome i bez čekanja. Ovde piše kako, šta tačno nestaje i šta se dešava posle.",

    "legal.delete.inApp.h": "Iz aplikacije",
    "legal.delete.inApp.s1": "Otvori FitMess i prijavi se.",
    "legal.delete.inApp.s2": "Idi na Podešavanja (poslednji tab dole).",
    "legal.delete.inApp.s3": "Skroluj do dna i tapni „Obriši nalog“.",
    "legal.delete.inApp.s4":
      "Upiši {phrase} da potvrdiš — to je zaštita od slučajnog dodira.",
    "legal.delete.inApp.note":
      "Brisanje je trenutno i nepovratno. Nema perioda čekanja i nema oporavka — ako ti podaci trebaju, prvo ih preuzmi preko „Moji podaci“ u Podešavanjima.",

    "legal.delete.email.h": "Ako ne možeš da uđeš u nalog",
    "legal.delete.email.body":
      "Piši na {email} sa email adrese kojom si se registrovao i napiši da hoćeš da obrišeš nalog. Brišemo ga u roku od 30 dana, obično isti dan. Tražimo samo da poruka stigne sa te adrese — tako znamo da je nalog tvoj.",

    "legal.delete.what.h": "Šta se briše",
    "legal.delete.what.lead":
      "Sve što je vezano za tvoj nalog, u istom trenutku:",
    "legal.delete.what.li1":
      "nalog i pristupni podaci — email, broj telefona, lozinka",
    "legal.delete.what.li2":
      "profil — ime, pol, godine, visina, težina, nivo aktivnosti, cilj",
    "legal.delete.what.li3":
      "svi uneti obroci i istorija tvojih dnevnih ciljeva",
    "legal.delete.what.li4":
      "merenja težine, voda, koraci, treninzi, navike i osvojene značke",
    "legal.delete.what.li5":
      "podešavanja podsetnika i oznake uređaja za notifikacije",
    "legal.delete.what.li6":
      "tvoji odgovori o danima i predlozi korekcije plana",

    "legal.delete.stays.h": "Šta ostaje",
    "legal.delete.stays.body":
      "Ako si dodao namirnicu u zajednički katalog hrane, ona ostaje — ali bez ikakve veze sa tobom, jer se podatak o tome ko ju je dodao briše zajedno sa nalogom. Katalog je zajednički za sve korisnike i nije tvoj lični podatak. U rezervnim kopijama baze tvoji podaci mogu da postoje najviše 30 dana, dok se te kopije ne prepišu.",

    "legal.delete.after.h": "Posle brisanja",
    "legal.delete.after.body":
      "Prijava sa starim podacima više ne radi. Možeš da napraviš nov nalog sa istom email adresom, ali on kreće od nule — stari podaci se ne vraćaju.",

    // -- Landing / app links ----------------------------------------------
    "legal.link.privacy": "Politika privatnosti",
    "legal.link.terms": "Uslovi korišćenja",
    "legal.link.delete": "Brisanje naloga",
    "legal.link.sources": "Odakle brojevi",
  },

  en: {
    // -- Shared chrome -----------------------------------------------------
    "legal.effective": "In effect from {date}",
    "legal.backToApp": "Back to the app",
    "legal.backLink": "Back",
    "legal.backToSettings": "Settings",
    "legal.otherDocs": "Other documents",

    // -- Privacy policy ----------------------------------------------------
    "legal.privacy.title": "Privacy policy",
    "legal.privacy.lead":
      "This is what FitMess knows about you, why it knows it, who else sees it and how you erase it. No fine print — if it is not written here, we do not do it.",

    "legal.privacy.controller.h": "Who processes your data",
    "legal.privacy.controller.body":
      "FitMess is run by {name}, a natural person in Serbia. That same person is the data controller under the Serbian Data Protection Act and the General Data Protection Regulation (GDPR). For anything to do with your data, write to {email} — we answer within 30 days, usually the same day. The full business address is shown on the app's App Store and Google Play listings.",

    "legal.privacy.collect.h": "What we collect",
    "legal.privacy.collect.lead":
      "Only what the app actually uses. Nothing is collected “just in case”.",
    "legal.privacy.collect.account.h": "Account",
    "legal.privacy.collect.account.body":
      "The email address and phone number you enter when signing up, and your password — which we never see, as it is stored as a cryptographic hash by Supabase Auth. If you sign in with Google, all we receive from Google is your email address.",
    "legal.privacy.collect.health.h": "Body and nutrition data",
    "legal.privacy.collect.health.body":
      "From the questionnaire: sex, age, height, weight, activity level and goal. From everyday use: the meals you log (name, amount, calories, macronutrients), water, steps, workouts, weigh-ins, checked habits and your answers about your day. This is health data and we treat it more strictly than the rest — see the section below.",
    "legal.privacy.collect.media.h": "Photos and voice",
    "legal.privacy.collect.media.body":
      "When you photograph a meal or a label, or say out loud what you ate, that image or recording is sent for AI processing to estimate the calories. Voice recordings are not kept — they are processed and discarded. A meal photo is kept briefly alongside that entry (about one day) so we can show you its card, then deleted automatically.",
    "legal.privacy.collect.tech.h": "Technical data",
    "legal.privacy.collect.tech.body":
      "Cookies the app cannot work without (sign-in, chosen language, chosen theme), and a record of when you first reached certain steps in the app — which we use to see where people get stuck. If you turn on reminders, we also store a device token so we can send the notification. We have no Google Analytics, no Facebook pixel, and no third-party advertising or analytics SDK of any kind.",

    "legal.privacy.why.h": "Why, and on what legal basis",
    "legal.privacy.why.contract":
      "To make the app work — your account, your daily budget, your progress. Legal basis: performance of the contract you entered into by accepting the terms of use.",
    "legal.privacy.why.consent":
      "For body and nutrition data, for AI processing of photos and voice, and for sending notifications. Legal basis: your explicit consent, given by entering that data or switching that option on. You can withdraw it at any time — stop logging, turn reminders off, or delete your account.",
    "legal.privacy.why.legitimate":
      "For the security of the service and to prevent account abuse. Legal basis: legitimate interest.",
    "legal.privacy.why.note":
      "We make no automated decisions about you that produce legal effects, and we build no advertising profile. The plan the app calculates is arithmetic from general formulas, not an assessment of who you are.",

    "legal.privacy.health.h": "Health data",
    "legal.privacy.health.body":
      "Your weight, your food intake and a goal of losing or gaining are a special category of personal data — health data. So we process them solely on the basis of your explicit consent, use them only to calculate and show you your plan, and never sell them or hand them to insurers, employers or anyone else. Withdraw consent by deleting your account, and the data goes with it.",

    "legal.privacy.share.h": "Who else sees your data",
    "legal.privacy.share.lead":
      "Four companies, each for exactly one job, all under a data-processing agreement. None of them may use your data for themselves.",
    "legal.privacy.share.supabase":
      "Supabase — the database and account sign-in. Your data physically sits on servers in Ireland (European Union).",
    "legal.privacy.share.vercel": "Vercel — the server that delivers the app.",
    "legal.privacy.share.google":
      "Google (Gemini API) — calorie estimation from photos, labels and voice. The image or recording does not go from your phone straight to Google: it reaches our server first, and our server forwards it to Gemini together with the question — with no name, email address or account identifier attached, so Google cannot tell whose it is. We use the paid tier, on which submitted content is not used to train Google's models. Google processes the image and returns an estimate; it does not keep it as your content afterwards, and makes no lasting copy on our behalf. The only copy that stays anywhere is ours — a small thumbnail beside that meal, for about a day (see “How long we keep things”). Voice recordings stay neither with us nor with them.",
    "legal.privacy.share.resend":
      "Resend — sending email (account confirmation, password reset).",
    "legal.privacy.share.never":
      "That is the whole list. We do not sell data, trade it, or pass it to ad networks. We would give data to a state authority only where the law obliges us to.",

    "legal.privacy.transfer.h": "Transfers outside Europe",
    "legal.privacy.transfer.body":
      "The database is in Ireland. Vercel and Google may also process data on servers outside the European Economic Area; where they do, the transfer is covered by the European Commission's standard contractual clauses, the instrument provided for exactly this.",

    "legal.privacy.keep.h": "How long we keep it",
    "legal.privacy.keep.account":
      "Account, profile and your plan — for as long as you have an account.",
    "legal.privacy.keep.logs":
      "Logged meals — the app shows you the last 30 days, and the database keeps them for 3 months before a scheduled job deletes them automatically.",
    "legal.privacy.keep.photos":
      "Meal photos — about one day, then deleted automatically.",
    "legal.privacy.keep.voice": "Voice recordings — not stored at all.",
    "legal.privacy.keep.delete":
      "When you delete your account — everything goes immediately. Data may survive in database backups for at most 30 days, until those backups are overwritten.",

    "legal.privacy.rights.h": "Your rights",
    "legal.privacy.rights.lead":
      "By law you have the right to: see your data, correct what is wrong, erase it, receive it in a portable form, restrict or object to processing, and withdraw consent.",
    "legal.privacy.rights.inApp":
      "You can do most of that yourself, immediately, without writing to anyone: in Settings, “My data” shows everything we store and downloads a copy as a file, “Personal details” and “Goal & plan” change your data, and “Delete account” erases all of it.",
    "legal.privacy.rights.email": "For anything else, write to {email}.",
    "legal.privacy.rights.complaint":
      "If you think we are getting something wrong, you have the right to complain to a supervisory authority: in Serbia that is the Commissioner for Information of Public Importance and Personal Data Protection, and if you live in the European Union, the authority in your own country.",

    "legal.privacy.age.h": "Age",
    "legal.privacy.age.body":
      "FitMess is meant for people aged {age} and over. We do not knowingly create accounts for anyone younger; if we learn that an account belongs to a younger person, we delete it. If you are a parent and believe your child has an account, write to {email}.",

    "legal.privacy.cookies.h": "Cookies",
    "legal.privacy.cookies.body":
      "We use only the ones the app cannot work without: the sign-in cookie, your chosen language, your chosen theme, and a marker that you have finished initial setup. There are no tracking cookies, which is why there is no banner asking you about them.",

    "legal.privacy.security.h": "Security",
    "legal.privacy.security.body":
      "All traffic goes over HTTPS. Passwords are stored as cryptographic hashes. The database has row-level security enabled, which means one user's query technically cannot reach another user's row — it is a rule in the database itself, not a matter of care when writing code.",

    "legal.privacy.changes.h": "Changes",
    "legal.privacy.changes.body":
      "If this changes, we change the date at the top. If a change is significant — a new kind of data, a new processor — we will tell you in the app before it takes effect.",

    "legal.privacy.contact.h": "Contact",
    "legal.privacy.contact.body": "{name}, Serbia. Email: {email}.",

    // -- Terms of use ------------------------------------------------------
    "legal.terms.title": "Terms of use",
    "legal.terms.lead":
      "FitMess is a food-tracking tool: you log what you eat, and we calculate a daily calorie and macronutrient budget and track how you are moving toward your goal. By using the app you accept these terms.",

    "legal.terms.provider.h": "Who provides the service",
    "legal.terms.provider.body":
      "FitMess is provided by {name}, a natural person in Serbia. Contact: {email}. Full provider details are shown alongside the app on the App Store and Google Play.",

    "legal.terms.medical.h": "Not medical advice",
    "legal.terms.medical.body":
      "FitMess is not a medical device and gives no medical, diagnostic or therapeutic advice. The numbers you see — daily budget, macronutrients, estimated expenditure, suggested plan corrections — are informational estimates from general formulas, not findings about your health. We do not diagnose, we do not treat, and we do not replace a doctor or a dietitian. Nothing in the app is a reason to put off seeing a doctor or to change a treatment your doctor prescribed.",

    "legal.terms.doctor.h": "When you must talk to a doctor",
    "legal.terms.doctor.lead":
      "Before you start changing how you eat based on the app's plan, talk to a doctor if any of this describes you:",
    "legal.terms.doctor.li1": "you are pregnant or breastfeeding",
    "legal.terms.doctor.li2":
      "you have diabetes, or take medication that depends on food intake (insulin, warfarin and the like)",
    "legal.terms.doctor.li3":
      "you have heart, kidney, liver or thyroid disease",
    "legal.terms.doctor.li4":
      "you have an eating disorder, or have had one in the past",
    "legal.terms.doctor.li5": "you are under 18",
    "legal.terms.doctor.li6":
      "you are recovering from surgery, an injury or a serious illness",
    "legal.terms.doctor.note":
      "If while following the plan you get dizziness, faintness, unusual fatigue, a racing heart or any symptom that worries you — stop and see a doctor.",

    "legal.terms.account.h": "Your account",
    "legal.terms.account.body":
      "You need an account and must be at least {age} years old. The account is personal — keep your password safe and do not share access. The data you enter should be accurate, because the entire plan is calculated from it. You can delete your account yourself, at any time, from Settings.",

    "legal.terms.price.h": "Price",
    "legal.terms.price.body":
      "The app is currently free. We plan to introduce a subscription, with 7 days free for new users before any charge. If that happens, we will show the price and terms clearly before you pay anything — nothing is ever charged without confirmation. Payment runs through the App Store or Google Play under their rules; that is also where you cancel a subscription and request a refund.",

    "legal.terms.accuracy.h": "Accuracy of numbers and AI estimates",
    "legal.terms.accuracy.body":
      "We work to keep the food database accurate, but we do not guarantee every value is error-free. Estimates from photos, voice and labels are made by artificial intelligence — that is an estimate, not a measurement, and it can be wrong. Check it and correct it whenever something looks off.",

    "legal.terms.responsibility.h": "Your responsibility",
    "legal.terms.responsibility.body":
      "You are responsible for the data you enter and for the decisions you make based on what the app shows you. FitMess is intended for healthy adults who want to track what they eat.",

    "legal.terms.availability.h": "Availability and termination",
    "legal.terms.availability.body":
      "We work to keep the app running, but we do not promise there will be no interruptions — maintenance, a failure at one of the services we rely on, or a bug. We reserve the right to close an account if the app is used in a way that harms other users or the service. Before closing an account we will email you, unless the law forbids it.",

    "legal.terms.ip.h": "Content and ownership",
    "legal.terms.ip.body":
      "The app, its design, its name and its logo are ours. What you enter — your meals, weigh-ins, notes — stays yours; we need only as much as it takes to show you the app and store your data.",

    "legal.terms.liability.h": "Limits of liability",
    "legal.terms.liability.body":
      "The app is used as it is. To the extent the law allows, we are not liable for damage arising from reliance on the estimates and numbers in the app, nor for interruptions of service. This does not exclude liability that cannot be excluded by law, nor your rights as a consumer.",

    "legal.terms.changes.h": "Changes to these terms",
    "legal.terms.changes.body":
      "We may change these terms. The date at the top shows when the current version took effect, and we announce any significant change in the app before it applies. If a new version does not suit you, you can stop using the app and delete your account.",

    "legal.terms.law.h": "Governing law",
    "legal.terms.law.body":
      "These terms are governed by the law of the Republic of Serbia. If you are a consumer in the European Union, this does not remove the protection your own country's rules give you. We try to settle any dispute by agreement first — write to {email}.",

    // -- Account deletion --------------------------------------------------
    "legal.delete.title": "Deleting your FitMess account",
    "legal.delete.lead":
      "You can delete your account yourself, from the app, without writing to anyone and without waiting. Here is how, exactly what disappears, and what happens afterwards.",

    "legal.delete.inApp.h": "From the app",
    "legal.delete.inApp.s1": "Open FitMess and sign in.",
    "legal.delete.inApp.s2": "Go to Settings (the last tab at the bottom).",
    "legal.delete.inApp.s3": "Scroll to the bottom and tap “Delete account”.",
    "legal.delete.inApp.s4":
      "Type {phrase} to confirm — that is the guard against an accidental tap.",
    "legal.delete.inApp.note":
      "Deletion is immediate and permanent. There is no waiting period and no recovery — if you want your data, download it first via “My data” in Settings.",

    "legal.delete.email.h": "If you cannot sign in",
    "legal.delete.email.body":
      "Write to {email} from the address you registered with and say you want your account deleted. We delete it within 30 days, usually the same day. All we ask is that the message comes from that address — that is how we know the account is yours.",

    "legal.delete.what.h": "What gets deleted",
    "legal.delete.what.lead":
      "Everything tied to your account, all at once:",
    "legal.delete.what.li1":
      "the account and sign-in details — email, phone number, password",
    "legal.delete.what.li2":
      "your profile — name, sex, age, height, weight, activity level, goal",
    "legal.delete.what.li3":
      "every logged meal and the history of your daily targets",
    "legal.delete.what.li4":
      "weigh-ins, water, steps, workouts, habits and earned badges",
    "legal.delete.what.li5":
      "reminder settings and device tokens for notifications",
    "legal.delete.what.li6":
      "your answers about your days and any suggested plan corrections",

    "legal.delete.stays.h": "What stays",
    "legal.delete.stays.body":
      "If you added a food to the shared food catalogue, it stays — but with no link to you, because the record of who added it is deleted along with the account. The catalogue is shared by all users and is not your personal data. Your data may exist in database backups for at most 30 days, until those backups are overwritten.",

    "legal.delete.after.h": "After deletion",
    "legal.delete.after.body":
      "Signing in with the old details no longer works. You can create a new account with the same email address, but it starts from zero — the old data does not come back.",

    // -- Landing / app links ----------------------------------------------
    "legal.link.privacy": "Privacy policy",
    "legal.link.terms": "Terms of use",
    "legal.link.delete": "Delete your account",
    "legal.link.sources": "Where the numbers come from",
  },
} as const;
