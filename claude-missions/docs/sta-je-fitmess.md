# FitMess — šta je, kome služi i zašto je ovakav

_Dokument napisan 2026-08-02 čitanjem samog koda (`src/app`, `src/lib`, `supabase/migrations`, `src/lib/i18n`), PRD-a (`missions/20260717-183157/description.md`) i odluka zabeleženih u komentarima. Gde se PRD i kod razlikuju, merodavan je kod — proizvod se od jula znatno pomerio od originalne zamisli._

---

## 1. Jednom rečenicom

**FitMess je aplikacija za praćenje ishrane na srpskom jeziku, napravljena isključivo za telefon, koja meri šta se stvarno dešava sa tvojim telom — umesto da ti propisuje šta da radiš.**

Praktično: slikaš obrok, AI proceni kalorije i makronutrijente, brojevi ulaze u dan; nedelja (ne dan) je okvir po kome se meri uspeh; a jednom nedeljno vaga koriguje sve procene stvarnim merenjem.

---

## 2. Kome služi

| | |
|---|---|
| **Jezik** | srpski (latinica), „ti" forma kroz ceo interfejs; engleski je opcija u Podešavanjima (`fm_locale`), ali podrazumevano je srpski |
| **Uređaj** | isključivo telefon — desktop i tablet se u `middleware.ts` preusmeravaju na `/samo-za-telefon` sa QR kodom |
| **Primarni korisnik** | ljudi u Srbiji na fazi mršavljenja/rekompozicije/dobijanja mase, uglavnom početnici i srednji nivo |
| **Ključni segment** | oni koji su **već probali i odustali** od MyFitnessPal-a i sličnih — zato je ceo dizajn okrenut protiv razloga zbog kojih se odustaje |
| **Cena** | besplatno (`schema.org` `price: 0 RSD` na landingu) |

Podržani ciljevi (`GoalType`): `lose` (mršavljenje), `gain` (dobijanje), `maintain` (održavanje), `tone` (zategnutost / rekompozicija, blagi deficit ~10%).

---

## 3. Problem koji rešava

Kalorijski trackeri ne propadaju zbog netačnosti, nego zbog **psihologije**:

1. **Sve-ili-ništa razmišljanje.** Jedan prekoračen dan izgleda kao neuspeh, pa se ceo pokušaj napušta. Klasičan tracker to pojačava: prikaže crveni broj i ćuti.
2. **Unos košta više nego što hrana vredi.** Krastavac ili šaka semenki se nikad ne upišu jer bi ih trebalo slikati i vagati — dan onda lažno izgleda niži nego što jeste, korisnik prestane da veruje broju i prestane da unosi.
3. **Sudijski ton.** App koji ocenjuje počne da liči na sudiju; najlakši način da prestaneš da se osećaš loše jeste da ga obrišeš.
4. **Plan koji se ne poklapa sa stvarnošću.** TDEE računat iz upitnika greši i preko 300 kcal dnevno (razlika između „lako aktivan" i „umereno aktivan"), pa plan ne radi, a korisnik krivi sebe.

FitMess ima poseban mehanizam za svaki od ova četiri problema — vidi filozofiju ispod.

---

## 4. Filozofija — devet principa koji se vide u kodu

### 4.1 Nedelja je jedinica uspeha, ne dan
Nosivi princip iz PRD-a, i dalje živ u kodu (`src/lib/home/adaptive.ts`, `src/lib/week/summary.ts`). Kad se dan probije, ostatak **te iste nedelje** apsorbuje razliku umesto da dan ostane crven. Landing kopija je doslovno: *„Nedelja je jedinica uspeha. Jedan loš obrok te ne ruši."*

Uz to idu tvrde granice: jedan dan se nikad ne seče više od **25%** (`MAX_DAILY_TRIM_PCT` — isto ograničenje koje važi za sam plan), a ono što se ne može odseći ne nestaje: prelije se u sledeću nedelju kao `carryIn`.

### 4.2 Instrument, ne plan (Whoop model)
Najvažnija strateška odluka, doneta 2026-08-01: **app ne sme da bude nešto od čega se odustaje.** Ako daje plan treninga/ishrane, onda odustajanje od plana = brisanje app-a. Whoop nema od čega da se odustane jer ništa ne propisuje — samo meri.

Test za svaki novi feature: *govori li ovo korisniku nešto o NJEMU, ili mu govori ŠTA DA RADI?* Prvo gradi naviku, drugo gradi krivicu.

Posledice u kodu:
- **Trening se beleži, ali nikad ne dodaje kalorije na budžet** (`src/lib/workout/activities.ts`) — TDEE množilac to već plaća; duplo plaćanje je najčešći način na koji kalorijski app tiho ugoji korisnika.
- Kartica „Plan za danas" je **uklonjena** sa Početne (2026-08-01): plan i dalje pomera brojeve, ali se više ne objašnjava kao zadatak; stanje nedelje živi na vrhu Analitike kao **ocena nedelje**, ne kao nalog.
- U toku je revizija cele kopije iz **imperativa u indikativ** (interna šifra „101"): *„prošetaj još 3.000"* → *„danas si prošetao 4.200, prosek ti je 6.800"*. Prva runda je urađena (Ocena zdravosti, Analitika, Podsetnici).

### 4.3 Odsustvo podatka nije podatak
`src/lib/home/day-trust.ts` — verovatno najoriginalniji deo app-a.

Dan sa jednim zaboravljenim unosom od 122 kcal **nije** dan od 122 kcal. Samoprijavljeni unos je u proseku potcenjen 20–30% (Livingstone & Black, J Nutr 2003). Zato:

> Dan u koji app nije siguran broji se kao dan **PO PLANU** — nikad kao njegov upisani broj, i nikad kao neuspeh.

Detektor je Goldbergov kriterijum iz nutricione epidemiologije (unos ispod BMR-a za ceo dan je sumnjiv). Dvosmislen dan ne odlučuje sam — postavlja **pitanje**, a korisnikov odgovor uvek pobeđuje heuristiku.

Ovo seče na obe strane: štiti korisnika od kazne za zaborav, ali i sprečava da šest neupisanih dana tiho „plate" jedan pravi ispad.

### 4.4 AI piše, kod računa („money-math rule")
Svaka brojka koja utiče na plan računa se u čistim, testiranim funkcijama bez I/O: `budget/engine.ts`, `home/adaptive.ts`, `weight/weekly-trend.ts`, `nutrition/health-score.ts`, `week/summary.ts`.

AI-ju je dozvoljeno da **formuliše**, a zabranjeno da **odlučuje**. I to nije prepušteno promptu: `weekly-message.ts` ima funkciju `numbersAreFaithful` koja ponovo pročita model­ov odgovor i odbaci ga ako se pojavi kalorijski broj koji mu nije dat. Halucinirano „predlažem 2.200 kcal" ne može da stigne na ekran čak i ako model ignoriše instrukciju.

Dodatno, `ai/reconcile.ts` deterministički proverava aritmetiku samog modela: da li stavke sabiraju u navedeni total i da li makroi sabiraju u kalorije (Atwater 4/4/9). Kad se ne slažu — kod bira kojoj cifri da veruje i snižava „sigurnost".

### 4.5 Poštenje umesto lažne preciznosti
- **`null` nije `0`.** Za mikronutrijente „ne znamo" i „nema ga" su različite tvrdnje; upisati samouvereno „0 g soli" učinilo bi karticu netačnom (`meal-estimate.ts`, `boundedNullable`).
- **Pokrivenost se priznaje.** Ako se za dan zna mikronutrijente u manje od pola kalorija, „Ocena zdravosti" pokazuje **N/A**, a ne pogrešan siguran broj.
- **Zaokruživanje bez pretvaranja.** Predlog aktivnosti se zaokružuje na 50 kcal, cilj koraka na 500 — jer preciznije bi bilo glumljenje tačnosti.
- **Klizač „Nisam sve pojeo" je u procentima**, ne u gramima: „otprilike pola" je procena koju čovek može da napravi gledajući tanjir; „210 g" nije.
- Kalorije treninga su izričito označene kao *„dobre za poređenje sa sobom, ne za merenje u kaloriju tačno."*

### 4.6 Bezbednosne granice su tvrde i nepremostive
`budget/engine.ts` postavlja pravila kroz koja ništa ne može da probije:
- deficit najviše **25%** ispod TDEE (`MAX_DEFICIT_PCT`)
- suficit najviše **20%** iznad (`MAX_SURPLUS_PCT`, lean bulk)
- apsolutni pod: **1400 kcal** (muškarci) / **1200 kcal** (žene)
- protein 2,0 g/kg (pod 1,6 g/kg), masti 0,8 g/kg (pod 0,6 g/kg)
- kad pod prelazi TDEE (sitna, starija, sedentarna osoba), plan se **ne pretvara u suficit** — kapira se na održavanje, a deficit se usmerava na aktivnost

Nedeljno merenje poštuje iste granice: *„Merenje sporog metabolizma nije dozvola da se neko izgladnjuje."* Kad kapa nema više prostora, pošten odgovor je aktivnost, ne manje hrane.

### 4.7 Super jednostavan i lep UI
Vlasnikovo eksplicitno pravilo: *„sve mora biti super jednostavno i jako lep UI jer to je poenta naše app."* Diferencijator nije broj opcija nego koliko je lako uneti obrok.

Primenjeno kao: poboljšanja idu u **sadržaj** (bolji tekst, manje pitanja), ne u novu hromu; nema dupliranja informacije; novi element mora da opravda mesto — ako ne menja korisnikovu odluku, ne ide na ekran. Zato su iz `+` menija izbačeni „Pretraži", „Dodaj proizvod", barkod i drugi mikrofon — rute i dalje postoje kao skrivene rezerve, samo se više ne nude.

### 4.8 Nikad prazan ni pokvaren ekran
Svaki server read degradira u miran srpski tekst umesto u error page. Neuspeh čitanja navika vraća praznu istoriju, a ne pad; istekla sesija dobija svoje stanje sa linkom na prijavu; AI koji ne odgovori vraća `null` koji ceo pipeline tretira kao prvorazredno stanje „još ne znamo".

### 4.9 Telefon, i to instaliran
App je PWA i namerno je zaključan za telefon. Upitnik i plan se prolaze **na vebu, pre registracije** (Cal AI obrazac), a poziv za instalaciju dolazi tek na kraju — kad korisnik već ima svoj plan koji ga „čeka na jedan tap". Pravilo iz koda: nikad ne linkuj fajl ili auth stranu iz instalirane app-e — nema dugmeta „nazad", korisnik mora da ubije app.

---

## 5. Putanja korisnika

```
/                landing (hero demo: početna → slikaj obrok → AI procena → prsten se popuni)
   ↓ „Započni"
/upitnik         javni upitnik: pol, godine, visina, težina, nivo aktivnosti,
                 cilj, ciljna težina, tempo (Sporo / Preporučeno / Brzo)
   ↓             → plan se izračuna i prikaže PRE registracije
/registracija    nalog (e-mail + lozinka), potvrda e-maila
   ↓
   ime → izbor teme (svetla/tamna) → plan se upisuje → „instaliraj FitMess"
   ↓
/danas           dnevni ekran; prsten se u jednoj animaciji „preda" iz upitnika
```

Zatim, u ritmu:
- **svakodnevno** — unos obroka, vode, treninga
- **jednom nedeljno** — `/merenje`, vaga koriguje plan
- **po potrebi** — `/analitika` (nedelja, trendovi, istorija), `/profil` (podešavanja)

---

## 6. Šta app radi — ekran po ekran

### 6.1 Početna (`/danas`)
Traka datuma na vrhu (klizanje kroz dane), pa **pager sa tri stranice** koje se prevlače:

1. **Kalorije i makroi** — „slivanje": prsten kalorija u staklenom oblaku, ispod njega makro pločice iz kojih obojene niti teku u prsten. Tu je i dugme **Gric** (najbrži put za sitnicu).
2. **Voda i trening** — unos vode (čaša / flaša / velika flaša, cilj izveden iz kilaže) i kartica treninga sa razlaganjem „mirovanje + trening = ukupno potrošeno".
3. **Nutrijenti** — vlakna, šećer, so, zasićene masti + **Ocena zdravosti (0–10)**.

Ispod: **Obroci danas** — lista kartica sa slikom obroka (slika živi ~1 dan pa je `pg_cron` briše; brojevi ostaju).

Povremeno, i samo kad ima šta da kaže: baner za nedeljno merenje i jedno jedino traženje dozvole za notifikacije (tek pošto je korisnik danas nešto upisao).

### 6.2 Unos (dugme `+`, uvek 2 tapa)
Meni nudi pet puteva, poređanih po tome šta korisniku treba **sad**:

| Metod | Ruta | Za šta je | Oznaka |
|---|---|---|---|
| **Prizma** | `/dodaj/najtacnije` | najtačnija procena | NAJTAČNIJE |
| **Slikaj obrok** | `/dodaj/obrok` | jedna slika i gotovo | NAJBRŽE |
| **Gric** | `/dodaj/gric` | sitnice, izgovorene sve odjednom | |
| **Slikaj deklaraciju** | `/dodaj/deklaracija` | pakovani proizvod | |
| **Trening** | `/dodaj/trening` | kretanje (nije hrana — zato je poslednji) | |

Skriveno, ali živo: pretraga kataloga (`/dodaj/pretraga`), barkod skener (`/dodaj/skener`), glasovni obrok (`/dodaj/glas`), ručno kreiranje proizvoda (`/dodaj/novi-proizvod`).

**Prizma** (v5) je najzanimljiviji od njih. Ideja: *slika ne može da izmeri masu, pa prestani da se pretvaraš da može i pitaj onoga ko zna* — korisnika.
- **ANALIZA** (1 slika): model samo *prepoznaje* — koja hrana, kakav sud, koliko teži jedna jedinica, i u šta nije siguran. Ne procenjuje.
- **KORISNIK**: opisuje oblik (koliko tanjira, koliko pun, koliko komada) i način pripreme.
- **VILJUŠKA kao razmera**: standardizovana na ~19–20 cm širom Evrope — daje isti metrički anker koji bi dao dubinski senzor, besplatno.
- **PITANJA IZ SUMNJE**: model dobija najviše **3** pitanja, i to samo o stavkama u koje nije siguran, rangirano po tome koliko kalorija zavisi od odgovora. Porcija i priprema su izbačene iz tog spiska jer je klizač već odgovorio na njih.
- **FINALIZACIJA**: ista slika + odgovori → aritmetika i raspis po komponentama.

Svesno izbačeno: obavezan drugi ugao pod 45° (sad ga model traži samo kad bi zaista promenio odgovor) i vaga.

**Gric** rešava problem pokrivenosti, ne preciznosti: jedan snimak → *više* stavki („krastavac, malo semenki i dve kajsije" = tri reda). Svaka stavka nosi `varijansa` — krastavac je 15 kcal ± 5, parče torte 350 ± 250. UI staje da pita **samo kod stavki visoke varijanse**; ostale se same sačuvaju.

### 6.3 Posle unosa — tri ispravke na kartici obroka
Ista porodica: *„bilo ga je više", „bilo ga je manje", „nije se desilo"*.

- **Dodaj još** — još jedna porcija, ili samo +2 jajeta iz slikanog obroka, bez ponovnog slikanja. Radi jer `logs.components` čuva AI-jev raspis; za starije unose koji ga nemaju, `split-meal.ts` ga izvede naknadno iz naziva i totala — uz pravilo da **totali su sveti** (raspis sme da menja odnos delova, nikad veličinu obroka).
- **Nisam sve pojeo** — klizač procenta na kartici (namerno *ne* na ekranu slikanja: tada još nisi jeo). `logs.eaten_share` čuva odnos, pa je radnja potpuno reverzibilna — posluženi tanjir je uvek `sačuvano / udeo`.
- **Izmeni / obriši**.

### 6.4 Analitika (`/analitika`)
- **Stanje nedelje** na vrhu („Nedelja ti je u planu")
- **Tvoj BMI** sa zonama
- **Procena težine** — trend izveden iz unosa (7 dana)
- **Dnevni prosek kalorija** — po nedeljama unazad (ova / prošla / pre 2 / pre 3)
- **Merenja** — tačke su ono što je vaga rekla, linija je ono po čemu se plan meri
- **Mikronutrijenti** — 7 dana, prebacivo: vlakna / šećer / so / zasićene
- **Voda** i **Koraci** — nedeljni pregled
- **Svi obroci** — istorija poslednjih 30 dana

Grafici imaju zajednički obrazac `ChartReadout`: dodirneš dan, detalji se pojave u **fiksnom slotu** ispod — nikad u lebdećem balonu (na telefonu ga prst pokrije).

### 6.5 Nedeljno merenje (`/merenje`) — po logici najvredniji deo app-a
Polazna tvrdnja: *„Vaga je jedino što stvarno MERI koliko trošiš. Sve ostalo je procena."*

Svaki kalorijski cilj koji je app ikada napisao je **predviđanje**. BMR pogađa u ~10%, a onda se množi faktorom aktivnosti koji je korisnik izabrao jednom, o samom sebi, iz liste od pet stavki — najveći izvor greške u celom lancu.

Postoji tačno jedan instrument koji odgovor **meri**: telesna težina kroz vreme, čitana naspram onoga što je pojedeno.

```
TDEE = prosečan dnevni unos + (izgubljeni kg × 7700) / broj dana
```

To je „intake-balance" metod (isti princip kojim se samoprijavljen unos validira naspram doubly-labelled water). Ne traži nikakav upitnik, nikakav sat — metabolička adaptacija, NEAT, genetika i kancelarijski posao su već unutra.

**Četiri zakona** koja ograničavaju taj račun (jer je ovo, primenjeno naivno, način na koji nutriciona app počne da šteti ljudima):

1. **Nikad ne reaguj na jedno merenje.** Voda, so i glikogen sami pomeraju 1–2 kg. Pomera se samo trend preko ≥2 (idealno ≥3) merenja.
2. **Nikad ne primenjuj korekciju automatski.** Modul samo *predlaže*; novi `targets` red se upisuje tek kad korisnik tapne „Prihvati". Plan koji se menja ispod nogu je plan kome se prestane verovati.
3. **Nikad ne krivi plan za dnevnik u koji ne verujemo.** Ako je unos nepouzdan → odgovor je „ne znamo šta si jeo", nikad „tvoj plan ne radi".
4. **Svaki predlog poštuje postojeće bezbednosne kape.**

Ton je namerno bez krivice: *„Dve nedelje bez pomaka. To ne znači da nešto radiš pogrešno — znači da je procena potrošnje bila viša od stvarne."* A postoji i izlaz koji ne dira hranu: *„Ili, ako ne želiš da diraš hranu: {steps} koraka više dnevno donosi isto."*

### 6.6 Podešavanja (`/profil`)
Grupisano po iOS obrascu: **Nalog** (e-mail, telefon, lozinka) · **Cilj i telo** (cilj, lični podaci, cilj koraka, dan merenja, navike) · **Aplikacija** (tema, jezik, podsetnici, osveži) · **Admin** (samo za `is_admin`) · **Privatnost** (moji podaci, politika privatnosti, uslovi) · **Podrška** · Odjava · Brisanje naloga.

**Moji podaci** — GDPR izvoz sa **pregledom pre preuzimanja** (JSON + PDF izveštaj). Svako čitanje ide kroz sesijski (RLS) klijent, nikad kroz admin klijent: garancija „samo svoji redovi" leži u Postgres politikama, ne u aplikativnom kodu.

### 6.7 Podsetnici (v3)
Prepravljeni 2026-08-01 pošto se ispostavilo da su prethodni bili tipa koji ljudi utišaju:
- **`meal`** ide po **korisnikovom sopstvenom ritmu jela** i samo kad taj obrok stvarno fali. Podsetnik koji stiže u isti minut bez obzira na to šta si radio nije podsetnik nego sat.
- **`evening`** ide samo kad ima šta da kaže (prazan dan, prekoračenje, dosta neiskorišćenog budžeta, neupisan trening). Notifikacija bez vesti troši kredit koji je sledećoj potreban.
- **`weighin`** — nedeljno.
- **Tvrd plafon: 2 dnevno, ikad** — vlasnikov broj i granica između „korisno" i „app koji sam ugasio".

### 6.8 Ostalo
- **Dostignuća** (`/dostignuca`) — bedževi izvedeni iz stvarnih podataka, nikad zapamćeni; obrisan obrok ne može da ostavi bedž za sobom.
- **Nagrada** (`/nagrada`) — „pun dan" (tri upisana obroka) i niz. Ekran ima **dva stanja**, jer se notifikacija može tapnuti satima kasnije: proslava i „još nije" — ekran koji bezuslovno slavi laže čim se otvori van reda.
- **Deljenje** — share kartice (9:16 story + 1:1 post) renderovane serverski kroz `next/og`.
- **Promeni nalog** — više naloga na istom uređaju, prebacivanje bez lozinke.
- **Admin** (`/admin`) — uređivanje kataloga hrane, red za proveru korisnički poslatih proizvoda, verifikacija, skeniranje barkodova.

---

## 7. Motor: kako nastaju brojevi

```
upitnik → bmr() → tdee() → planForGoal() → targets (dnevni kcal + makroi + nedeljni kcal)
                                              ↓
             logs ← unos (Prizma / obrok / gric / deklaracija / katalog / barkod)
                                              ↓
                    day-trust: kojim danima ove nedelje smemo da verujemo?
                                              ↓
             computeAdaptivePlan → današnji cilj (skrojen po ostatku nedelje)
                                              ↓
             weigh_ins + prosečan unos → weekly-trend → izmereni TDEE → PREDLOG
                                              ↓
                              korisnik tapne „Prihvati" → novi targets red
```

Detalji:

- **BMR**: Mifflin-St Jeor (1990). **TDEE**: BMR × množilac aktivnosti (1,2 – 1,9).
- **Plan po cilju**: `lose` iz ciljne težine i tempa; `gain` sa kapom od 20%; `maintain` na TDEE; `tone` na blagih −10%.
- **Tempo** se ne pita u nedeljama nego kao Sporo (0,25 kg/ned) / Preporučeno (0,5) / Brzo (0,75), pa se iz toga *izvede* broj nedelja.
- **Adaptivni plan** je **svestan cilja**: kod ciljeva rezanja (`lose`, `tone`) jednosmeran je — prekoračenje spušta cilj, ali manje pojedeno ga **ne diže** (manje jelo na dijeti nije dug koji se vraća). Kod ciljeva pogađanja broja (`gain`, `maintain`) simetričan je, uz kapu od +20%.
- **Šetnja je jedina poluga koju plan nudi**, i zato je precizno modelovana: 3,3 neto MET-a skalirano po **kilaži**, ne fiksnih 5 kcal/min za sve. Prethodne fiksne konstante su precenjivale potrošnju 1,5–1,9×; ženi od 55 kg se govorilo „prošetaj 200 kcal" za šetnju koja vredi ~110.
- **Cilj koraka** nije 10.000 za sve. Taj broj nije medicina nego marketing — japanski „manpo-kei" pedometar iz 1965. Istraživanja (JAMA 2019, Lancet Public Health 2022) nalaze da korist strmo raste do ~6.000–8.000 pa se ravna. Cilj se sad izvodi iz nivoa aktivnosti, uz mogućnost ručnog podešavanja.
- **Ocena zdravosti** je deterministička (svesna odluka vlasnika nad AI ocenom): isti dan uvek daje istu ocenu, ne košta ništa po prikazu, i svaki poen je objašnjiv. Meri **gustinu** (količina po pojedenoj kalorijii), ne dnevne apsolutne iznose — inače bi ujutru uvek bila loša, tj. merila bi „koliko si dana upisao", ne kako si jeo. Pet komponenti po 2 poena: protein i vlakna kao ciljevi; šećer, so i zasićene masti kao granice.

---

## 8. Po čemu se razlikuje

**vs. MyFitnessPal / klasični trackeri**
- Dan se ne završava crvenim brojem — nedelja preraspodeli i objasni.
- Neupisan ili polupisan dan ne postaje kazna (`day-trust`).
- Katalog je **srpski**: 350 kuriranih namirnica, od pilećih prsa i pršute do ćevapa, pljeskavice, karađorđeve, sarme, gibanice — sa domaćim jedinicama („parče", „kašika", „šolja").
- Ceo interfejs je izvorni srpski, ne prevod.

**vs. Cal AI i AI-first trackeri**
- Prizma ne glumi da fotografija ume da izmeri masu: kombinuje AI prepoznavanje sa korisnikovom geometrijom i fizičkom referencom (viljuška), pa pita **samo ono u šta nije sigurna**.
- Aritmetika modela se deterministički proverava (`reconcile.ts`) pre nego što uđe u dan.
- **Gric** rešava kategoriju hrane koju nijedan foto-tracker ne uhvati — sitnice čije slikanje košta više nego što hrana vredi.
- „Ne znam" ostaje „ne znam" (`null`), ne postaje samouvereno 0.

**vs. Whoop i mereni instrumenti**
- Ista ambicija (instrument, ne plan), ali sa jednom strukturnom razlikom koju vlasnik otvoreno priznaje: **narukvica meri i kad je zaboraviš, FitMess bez unosa nema šta da pokaže** — a to je tačno period kad ljudi odustaju. Zato je nedeljna vaga (10 sekundi, radi i kad si odustao od svega ostalog) po ovoj logici najvredniji kanal u app-u.

**Jedinstveno, koliko se vidi iz koda**
- Formalizovano pravilo poverenja u dnevnik, sa Goldberg pragom i korisnikovim odgovorom kao konačnim sudom.
- Verifikator koji odbacuje AI poruku ako sadrži kalorijski broj koji joj nije dat.
- Klizač „nisam sve pojeo" kao potpuno reverzibilan multiplikator preko grama, makroa, mikronutrijenata i raspisa.

---

## 9. Tehnika

| Sloj | Izbor |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Stil | Tailwind 4, shadcn primitivi, ručno pisani SVG grafici i ikone |
| Baza / Auth | Supabase (Postgres + Auth + RLS na svakoj tabeli, „samo svoji redovi") |
| AI | Google Gemini (`gemini-3.6-flash`) — vid, audio i tekstualne dopune; svi pozivi kroz server rute, ključ nikad na klijentu |
| Push | Web Push (`web-push`), VAPID |
| PDF / OG | `@react-pdf/renderer`, `next/og` (satori) |
| Testovi | Vitest (~590 TS/TSX fajlova, `__tests__` uz gotovo svaki modul) |
| Hosting | Vercel, auto-deploy na push na `main` → https://fitmess.app |
| Poslovi | `pg_cron` u bazi (brisanje starih logova, brisanje slika obroka, grejanje servera) |

**Tabele** (27 migracija): `profiles`, `targets` (istorijska — svaka rekalkulacija je nov red, nikad update), `foods` (deljeni katalog), `logs`, `weigh_ins`, `meal_photos`, `water_intake`, `step_counts`, `habit_checks`, `push_subscriptions`, `reminder_settings`, `awards`, `runs`, `plan_adjustments`, `workouts`.

**Podaci i privatnost**
- Obroci se **prikazuju** 30 dana, **čuvaju** 3 meseca, pa ih `pg_cron` trajno briše.
- Slike obroka žive ~1 dan (base64 u tabeli, ne u Storage-u).
- Samoposlužni izvoz svih podataka + brisanje naloga; korisnički poslate namirnice se pri brisanju **anonimizuju**, ne brišu — katalog je deljena, ne lična imovina.
- Nova korisnička tabela **mora** ući u `USER_OWNED_TABLES` da bi ušla u izvoz.

**Performanse**
- Identitet se čita lokalnom verifikacijom tokena (`getClaims`), ne mrežnim `getUser()` po navigaciji.
- `fm_gate` kolačić kešira „prošao onboarding + telefon" pa se `profiles` ne čita na svaku navigaciju.
- Krunerske rute i `robots.txt`/`sitemap.xml` zaobilaze telefonsku kapiju (ranije ih je 307 preusmeravao, pa app nije bio indeksiran).

---

## 10. Šta FitMess namerno NIJE

- **Nije planer obroka.** Nema jelovnika koji se raspadne trećeg dana; korisnik jede šta hoće unutar budžeta.
- **Nije planer treninga.** Trening se beleži i prikazuje, ali app ne propisuje šta da radiš — i nikad ne pretvara trening u dodatnu hranu.
- **Nije chat sa AI trenerom.** Originalni PRD je imao „Skrenuo sam" agenta kao hero feature; taj chat **nije implementiran** — preraspodela je postala tiha, deterministička i ugrađena, bez razgovora.
- **Ne koristi vagu za hranu.** Svesno izbačeno iz Prizme: to je korak koji ubija upotrebu.
- **Nije za desktop.** Ni kao „radi i tamo".
- **Ne oslanja se na 3D/LiDAR.** Nemoguće u PWA — otud viljuška kao razmera.
- **Nije napisano za tabelu opcija.** Više puta su feature-i **uklanjani** kad su prestali da nose svoju težinu: kartica „Plan za danas", kartica koraka sa Početne, „Pretraži"/„Dodaj proizvod"/barkod/drugi mikrofon iz `+` menija, Lofi/agent tab iz Analitike.

---

## 11. Otvorena pitanja i priznati rizici

1. **Nizovi (streak), bedževi i `/nagrada`.** Po sopstvenoj filozofiji app-a, niz koji pukne je razlog da se **ne** vratiš. Ceo sistem (`streak-pill`, „Pun dan! 🏆" push, „Uloguj obrok pa kreni da nižeš dane") čeka odluku — velika proizvodna odluka, ne dira se bez dogovora.
2. **Naziv „Ocena zdravosti".** Bendovi su prevedeni iz školskih ocena u opise dana („Sve na broju", „Ponešto fali"), ali sama reč *ocena* i dalje sudi. Broj (0–10) je ostao — broj je merenje, pridev je bio mišljenje.
3. **Zadatak „101"** — ostatak revizije kopije iz imperativa u indikativ (`profil.ts`, `dodaj.ts`, `food.ts`, `onboarding.ts` još nisu prošli).
4. **Strukturni jaz prema Whoop-u** — šta app zna o tebi u nedelji kad ništa nisi upisao? Trenutni odgovor je vaga; da li je dovoljan, otvoreno je.
5. **„92% tačnost" na Prizma redu** je marketinška cifra, ne izmerena — u kodu stoji upozorenje da se ne sme objaviti van tog reda bez pravog benchmarka.
6. **Gemini free tier**: 20 zahteva dnevno **po modelu** — kad svi AI feature-i stanu odjednom, to nije bug nego kvota. Za produkciju treba naplata.
7. **Migracija 0018 (Navike)** čeka ručnu primenu.

---

## 12. Sažetak u tri rečenice

FitMess je srpski, telefon-only tracker ishrane koji je od običnog brojača kalorija napravio **merni instrument**: AI radi ono u čemu je dobar (prepoznaje hranu i piše ljudski), deterministički kod radi svu matematiku koja utiče na plan, a vaga jednom nedeljno ispravlja sve procene stvarnim merenjem.

Njegov diferencijator nije broj funkcija nego **stav prema korisniku**: nedelja umesto dana kao jedinica uspeha, dan u koji app nije siguran broji se kao dan po planu umesto kao neuspeh, „ne znamo" se kaže naglas umesto da se maskira nulom, i sve što bi zvučalo kao sudija se sistematski prevodi u meru.

Rizik koji app sam sebi priznaje je isti onaj koji rešava kod drugih: svaki element koji može da „pukne" — niz, ocena, ispunjeno/neispunjeno — potencijalno je razlog da se korisnik ne vrati.
