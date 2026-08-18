/**
 * "Odakle brojevi" — the prose around the citations at `/izvori`.
 *
 * Written for the person using the app, not for the reviewer who asked for it:
 * someone who just saw "2.180 kcal · 145 g proteina" and wants to know who
 * decided that. So each section says what the app computes, in one or two
 * sentences of plain Serbian, and then hands over to the source.
 *
 * The bibliography itself is NOT here — it lives untranslated in
 * `src/lib/legal/sources.ts`, because "Am J Clin Nutr. 1990;51(2):241-247"
 * reads the same in both languages and a translated reference list is a
 * reference list with two versions to get wrong.
 *
 * Tone rules from the rest of the app still apply: "ti", calm, zero shame,
 * and never a claim the code cannot back. Where the implementation follows
 * convention rather than one paper (the activity multipliers), the text says
 * exactly that instead of dressing it up.
 */

export const sourcesMessages = {
  sr: {
    "sources.title": "Odakle brojevi",
    "sources.lead":
      "FitMess ti pokazuje kalorije, makronutrijente, BMI i procenu potrošnje na treningu. Nijedan od tih brojeva nije izmišljen — svaki dolazi iz objavljene formule ili preporuke. Ovde piše koje su to, šta tačno radimo sa njima i gde da ih pročitaš u originalu.",

    // The disclaimer leads, ahead of everything else.
    "sources.disclaimer.h": "Prvo ono najvažnije",
    "sources.disclaimer.body":
      "FitMess nije lekar i ne postavlja dijagnoze. Brojevi ovde su procene za zdravu odraslu osobu, izvedene iz populacionih formula — a ti nisi populacija. Ako imaš bilo kakvo zdravstveno stanje, ako si trudna ili dojiš, ako imaš ili si imao/la poremećaj ishrane, ili ako uzimaš terapiju koja utiče na težinu ili apetit, plan iz aplikacije ne primenjuj bez razgovora sa lekarom ili nutricionistom.",
    "sources.disclaimer.age":
      "Aplikacija je namenjena osobama od 18 godina naviše i nije napravljena za decu i tinejdžere, čije se potrebe računaju drugačije.",

    "sources.kcal.h": "Dnevne kalorije",
    "sources.kcal.body":
      "Prvo se računa bazalni metabolizam (BMR) — koliko trošiš u potpunom mirovanju — po Mifflin–St Jeor jednačini iz 1990: za muškarce 10 × kg + 6,25 × cm − 5 × godine + 5, za žene isto to − 161. To je jednačina koja u poređenjima najčešće pogađa izmerenu vrednost unutar 10%.",
    "sources.kcal.activity":
      "BMR se zatim množi faktorom aktivnosti koji si izabrao/la: 1,2 (sedeći) do 1,9 (vrlo aktivan). Ta petostepena tabela je ustaljena praksa u primeni, a ne broj iz jednog rada; ideja iza nje — ukupna potrošnja = BMR × nivo fizičke aktivnosti (PAL) — je ono što FAO/WHO/UNU konsultacija propisuje kao metod. Ovo je i najveći izvor greške u celom lancu: razlika između „lako aktivan“ i „umereno aktivan“ je preko 300 kcal dnevno, a niko sebe ne procenjuje precizno. Zato FitMess kasnije koristi tvoju vagu da tu procenu ispravi.",

    "sources.safety.h": "Bezbednosne granice",
    "sources.safety.body":
      "Deficit nikada nije veći od 25% ispod procenjene potrošnje, a dnevni cilj nikada ne pada ispod 1400 kcal za muškarce i 1200 kcal za žene — koliko god agresivan cilj uneo/la. Te granice prate NIH/NHLBI kliničke smernice, koje niskokalorijsku ishranu definišu na 1000–1200 kcal za žene i 1200–1500 za muškarce, i tempo od pola do jednog kilograma nedeljno kroz deficit od 500–1000 kcal dnevno.",

    "sources.macros.h": "Proteini, masti i ugljeni hidrati",
    "sources.macros.protein":
      "Protein se cilja na 2,0 g po kilogramu telesne mase, a kad budžet ne dozvoljava, spušta se najviše do 1,6 g/kg. Meta-analiza iz 2018. pokazuje da se dobitak na mišićnoj masi zaustavlja oko 1,6 g/kg, sa intervalom poverenja do ~2,2; ISSN preporučuje 1,4–2,0 g/kg za one koji vežbaju, i više u deficitu — što je tačno situacija u kojoj je većina korisnika FitMess-a.",
    "sources.macros.fat":
      "Mast se cilja na 0,8 g/kg i nikad ne pada ispod 0,6 g/kg, jer je mast nosilac vitamina rastvorljivih u mastima i esencijalnih masnih kiselina. Zasićene masti se prate kao meki plafon od 10% dnevnih kalorija, po WHO smernici.",
    "sources.macros.carbs":
      "Ugljeni hidrati su ono što ostane: kalorijski budžet minus protein i mast. Nemaju svoju preporuku jer ih FitMess ne ograničava — ni jedna namirnica u aplikaciji nije „zabranjena“.",

    "sources.pace.h": "Koliko brzo se menja težina",
    "sources.pace.body":
      "Kad zadaš ciljnu težinu i rok, aplikacija računa potreban deficit preko pravila od približno 7700 kcal po kilogramu telesne mase (Wishnofsky, 1958 — poznato i kao „3500 kcal po funti“). To je gruba računica, ne fizika: pravi gubitak usporava kako se telo menja, što je i objavljena kritika tog pravila. Zato je to kod nas samo početna procena tempa — ne obećanje — i uvek prolazi kroz gornje bezbednosne granice.",

    "sources.bmi.h": "BMI",
    "sources.bmi.body":
      "BMI je težina u kilogramima podeljena kvadratom visine u metrima, a zone (ispod 18,5 / 18,5–24,9 / 25–29,9 / 30 i više) su standardna WHO klasifikacija. BMI ne razlikuje mišić od masti i za vrlo mišićavu osobu očitava previsoko — pokazujemo ga kao orijentir, nikad kao ocenu.",

    "sources.workout.h": "Potrošnja na treningu",
    "sources.workout.body":
      "Trening se boduje MET vrednostima iz Compendium of Physical Activities (Ainsworth i sar., 2011), i to NETO — od svake vrednosti se oduzima 1 MET, jer sat treninga vredi onoliko koliko troši IZNAD sata sedenja koji je zamenio. MET vrednosti su populacioni proseci sa širokim rasponom (oko ±20% za pojedinca), pa se kod nas prikazuju kao zapis truda i nikada se ne dodaju na dnevni budžet kao „zarađene kalorije“.",

    "sources.micro.h": "Vlakna, šećer, natrijum, zasićene masti",
    "sources.micro.body":
      "Vlakna se ciljaju na 14 g na svakih 1000 kcal (američke Dietary Guidelines / IOM), šećer se prati kao meki plafon od 10% kalorija (WHO smernica za slobodne šećere), natrijum na 2300 mg dnevno (WHO je stroži — 2000 mg), a zasićene masti na 10% kalorija.",
    "sources.micro.note":
      "Jedna iskrena napomena: sa slike ili sa deklaracije možemo da pročitamo UKUPNE šećere, a WHO preporuka govori o slobodnim šećerima. Naš plafon je zato stroži nego što treba i namerno je mek — dan bogat voćem nije neuspeh i aplikacija ga ne boji crveno.",

    "sources.trust.h": "Kako čitamo tvoj unos i vagu",
    "sources.trust.body":
      "Samoprijavljen unos hrane je u proseku potcenjen 20–30% u studijama koje ga porede sa dvostruko obeleženom vodom. Zato FitMess ne veruje slepo dnevnom zbiru: dan čiji je unos ispod bazalnog metabolizma se označava kao nepotpun (standardni Goldberg kriterijum) i tvoj odgovor uvek pobeđuje heuristiku.",
    "sources.trust.trend":
      "Težina se prikazuje kao sedmodnevni klizni prosek, a ne kao dnevna vrednost, jer dnevne oscilacije uglavnom mere vodu i so. Kada ima dovoljno pouzdanih dana, iz odnosa unosa i promene težine se izračunava tvoja stvarna potrošnja i njome se ispravlja početna procena — merenje umesto pogađanja.",

    "sources.list.h": "Spisak izvora",
    "sources.list.lead":
      "Svi radovi i smernice na koje se aplikacija oslanja, sa linkovima na original.",
    "sources.updated.h": "Kad se ovo menja",
    "sources.updated.body":
      "Ova stranica je deo koda, ne marketinga: ako se formula u aplikaciji promeni, menja se i ovde. Ako misliš da je nešto ovde pogrešno ili zastarelo, piši nam — to je jedina prijava koju uvek proveravamo.",

    // The "where does this number come from?" link that sits next to the
    // numbers themselves.
    "sources.link.short": "Odakle ovaj broj?",
    "sources.link.settings": "Odakle brojevi",
    "sources.link.settingsDesc": "Formule i izvori iza kalorija, makroa i BMI",
  },
  en: {
    "sources.title": "Where the numbers come from",
    "sources.lead":
      "FitMess shows you calories, macronutrients, BMI and an estimate of what a workout burned. None of those numbers are invented — each one comes from a published equation or guideline. This page says which ones, what exactly we do with them, and where to read the original.",

    "sources.disclaimer.h": "First, the important part",
    "sources.disclaimer.body":
      "FitMess is not a doctor and does not diagnose anything. The numbers here are estimates for a healthy adult, derived from population-level equations — and you are not a population. If you have any medical condition, if you are pregnant or breastfeeding, if you have or have had an eating disorder, or if you take medication that affects weight or appetite, do not follow the app's plan without talking to a doctor or dietitian first.",
    "sources.disclaimer.age":
      "The app is intended for people aged 18 and over. It is not built for children or teenagers, whose requirements are calculated differently.",

    "sources.kcal.h": "Your daily calories",
    "sources.kcal.body":
      "First we compute basal metabolic rate (BMR) — what you burn at complete rest — with the 1990 Mifflin–St Jeor equation: for men 10 × kg + 6.25 × cm − 5 × age + 5, for women the same − 161. In comparisons it is the equation most likely to land within 10% of a measured value.",
    "sources.kcal.activity":
      "BMR is then multiplied by the activity factor you picked: 1.2 (sedentary) through 1.9 (very active). That five-step table is applied convention rather than a figure from a single paper; the idea behind it — total expenditure = BMR × physical activity level (PAL) — is the method the FAO/WHO/UNU consultation prescribes. It is also the largest source of error in the whole chain: the gap between \"lightly active\" and \"moderately active\" is over 300 kcal a day, and nobody rates themselves accurately. That is why FitMess later uses your scale to correct the estimate.",

    "sources.safety.h": "Safety limits",
    "sources.safety.body":
      "The deficit is never more than 25% below estimated expenditure, and the daily target never drops below 1400 kcal for men or 1200 kcal for women, however aggressive a goal you enter. Those limits follow the NIH/NHLBI clinical guidelines, which define a low-calorie diet as 1000–1200 kcal for women and 1200–1500 for men, and a pace of about 0.5–1 kg a week from a 500–1000 kcal daily deficit.",

    "sources.macros.h": "Protein, fat and carbohydrate",
    "sources.macros.protein":
      "Protein is targeted at 2.0 g per kilogram of body mass, and when the budget cannot fit that, it is walked down no further than 1.6 g/kg. A 2018 meta-analysis puts the plateau for muscle gain at about 1.6 g/kg with a confidence interval reaching ~2.2; the ISSN position stand recommends 1.4–2.0 g/kg for people who train, and more during a deficit — which is exactly where most FitMess users are.",
    "sources.macros.fat":
      "Fat is targeted at 0.8 g/kg and never falls below 0.6 g/kg, because fat carries the fat-soluble vitamins and the essential fatty acids. Saturated fat is tracked as a soft ceiling of 10% of daily calories, per the WHO guideline.",
    "sources.macros.carbs":
      "Carbohydrate is what is left: the calorie budget minus protein and fat. It has no recommendation of its own because FitMess does not restrict it — no food in the app is \"forbidden\".",

    "sources.pace.h": "How fast weight changes",
    "sources.pace.body":
      "When you set a target weight and a timeframe, the app derives the required deficit from the rule of roughly 7700 kcal per kilogram of body mass (Wishnofsky, 1958 — better known as \"3500 kcal per pound\"). That is arithmetic, not physiology: real loss slows as the body changes, which is the published criticism of the rule. So we use it only as a starting estimate of pace — never as a promise — and it always passes through the safety limits above.",

    "sources.bmi.h": "BMI",
    "sources.bmi.body":
      "BMI is weight in kilograms divided by height in metres squared, and the zones (under 18.5 / 18.5–24.9 / 25–29.9 / 30 and above) are the standard WHO classification. BMI cannot tell muscle from fat and reads high for a very muscular person — we show it as a bearing, never as a verdict.",

    "sources.workout.h": "What a workout burns",
    "sources.workout.body":
      "Workouts are scored with MET values from the Compendium of Physical Activities (Ainsworth et al., 2011), kept NET — 1 MET is subtracted from each value, because an hour of training is worth what it burns ABOVE the hour of sitting it replaced. MET values are population averages with wide individual spread (about ±20% for one person), so in FitMess they are a record of effort and are never added back to the daily budget as \"earned calories\".",

    "sources.micro.h": "Fibre, sugar, sodium, saturated fat",
    "sources.micro.body":
      "Fibre is targeted at 14 g per 1000 kcal (US Dietary Guidelines / IOM), sugar is tracked as a soft ceiling of 10% of calories (the WHO free-sugars guideline), sodium at 2300 mg a day (WHO is stricter, at 2000 mg), and saturated fat at 10% of calories.",
    "sources.micro.note":
      "One honest caveat: what we can read from a photo or a label is TOTAL sugars, while the WHO recommendation is about free sugars. Our ceiling is therefore stricter than it needs to be, and deliberately soft — a fruit-heavy day is not a failure and the app never colours it red.",

    "sources.trust.h": "How we read your log and your scale",
    "sources.trust.body":
      "Self-reported food intake is under-reported by 20–30% on average in studies that compare it against doubly labelled water. So FitMess does not take the daily total on faith: a day whose intake falls below basal metabolic rate is flagged as incomplete (the standard Goldberg cut-off), and your own answer always beats the heuristic.",
    "sources.trust.trend":
      "Weight is shown as a seven-day rolling average rather than a daily figure, because daily swings mostly measure water and salt. Once there are enough trusted days, your actual expenditure is computed from intake versus weight change and used to correct the original estimate — measuring instead of guessing.",

    "sources.list.h": "Reference list",
    "sources.list.lead":
      "Every paper and guideline the app relies on, with links to the originals.",
    "sources.updated.h": "When this changes",
    "sources.updated.body":
      "This page is part of the code, not the marketing: if an equation in the app changes, this changes with it. If you think something here is wrong or out of date, write to us — that is the one report we always check.",

    "sources.link.short": "Where does this number come from?",
    "sources.link.settings": "Where the numbers come from",
    "sources.link.settingsDesc": "The equations and sources behind calories, macros and BMI",
  },
} as const;
