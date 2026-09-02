# Barometar — prediction market za Srbiju (MVP plan)

Stanje na dan **02.09.2026**. Radno ime „Barometar" — ime nije odlučeno.
Ovo je **novi proizvod, ne FitMess feature**: druga publika, drugo ime,
drugi domen. Deli stack, ekipu i delove koda (auth, telefon, share kartice).

Dokument postoji da se za dve nedelje ne raspravlja ponovo o onome što je
već odlučeno, i da se zna ZAŠTO je odlučeno.

---

## Šta je ovo, u tri rečenice

Polymarket za Srbiju, bez pravog novca. Svako prvog u mesecu dobije
**minimalac** u igračkoj valuti i trguje na pitanja tipa „Pravni fakultet u
blokadi 15. septembra?" — cena je procenat, procenat je sadržaj. Ko je bio u
pravu, vidi se; ko je pričao — takođe.

Slogan-kandidat: **„Stavi minimalac tamo gde su ti usta."**

## Zašto ovo, a ne nešto drugo

Put do ovde je bio dug (fitnes izazovi → klađenje na drugare → teretana
1v1 → ovo). Tri stvari su presudile:

1. **Tržište je sadržaj.** Ljudi ne otvaraju Polymarket da ulože, otvaraju ga
   da vide šta drugi misle. Broj „78% kaže da" je naslov koji se sam deli.
2. **Blizina je jedina prednost nad Polymarketom.** Oni imaju svet i
   likvidnost; mi imamo pitanja koja Polymarket nikad neće postaviti, i
   insajdere na svakom fakultetu i u svakoj redakciji.
3. **Tajming.** Protesti i blokade su proizveli stotine neizvesnih, lokalnih,
   emotivnih događaja sa raspoređenim znanjem. To je gorivo za ovakvo tržište.

## Pravila koja se ne pregovaraju

- **Nema pravog novca.** Valuta se **ne kupuje** i **ne isplaćuje**. Ni vaučer,
  ni „sweepstakes", ni prodaja na strani. Čim postoji ulaz ili izlaz keša,
  ovo je priređivanje igara na sreću bez odobrenja — krivično, ne prekršajno,
  i to u kontekstu gde je država koja izdaje licence strana u događajima na
  koja se trguje. Ovo pravilo nema izuzetak.
- **Nagrade (kasnije) samo kroz rang-listu, iz sponzorstva**, kao „nagradna
  igra" (prijava, ne licenca) — igrač može da DOBIJE, nikad ne može da IZGUBI.
  Nije u MVP-u.
- **UI nikad ne sme da liči na kladionicu sa pravim novcem.** Valuta ima
  svoje ime i znak, i jasno piše da se ne isplaćuje. Ne zove se „demo" (ta
  reč znači „nije bitno"), ali ne sme ni da se pomeša sa dinarom.
- **Nema tržišta koja daju motiv da se nešto izazove.** Vidi „Uređivačka
  politika" — kratka lista zabrana, sve ostalo dozvoljeno.

## Valuta: minimalac

- **Plata prvog u mesecu:** svako dobije iznos = neto minimalac po važećoj
  odluci Vlade (konfiguracija, ne hardkod; menja se jednom godišnje).
- **Dnevnica:** mali dnevni priliv (~1% minimalca) da niko nije mrtav 25 dana
  ako prospe sve trećeg. Rang meri **neto vrednost** (keš + pozicije po
  trenutnoj ceni), pa prosipanje i dalje boli.
- **Mesec = sezona.** Rang se resetuje prvog, all-time rekord i dosije ostaju.
  Metafora se sama zatvara: „do plate ti je ostalo 4.200".
- **Jedan telefon = jedan nalog.** Inače se farmuju minimalci. FitMess već
  ima verifikaciju telefona (`profiles.phone`, `(auth)/telefon`) — prenosi se.
- **Fee 1% na svaku trgovinu** — ne zbog prihoda (valuta je naša), nego kao
  ponor koji drži inflaciju pod kontrolom kad svako svakog meseca dobije novu
  platu.

## Tržišta

### Ko ih pravi

**Korisnici predlažu, mi odobravamo.** Polymarket nema deset fiksnih pitanja —
ima stotine ludih, i zato je zanimljiv. Ali svako pitanje bez pravila presude
je budući spor, pa ide kroz red:

- Predlog sadrži: pitanje, **pravilo presude** (vidi niže), izvor, vreme
  zatvaranja trgovine, vreme presude, kategoriju, početnu verovatnoću.
- Odobrenje u roku od nekoliko sati (mi, ručno, u MVP-u). Odbijeno → razlog.
- **Kreator dobija 1% volumena** svog tržišta. To je motiv da ljudi pišu
  dobra pitanja, a ne mi. Manifold ovim drži hiljade tržišta mesečno.
- Posle par nedelja: **pouzdani kreatori** (N odobrenih, 0 poništenih)
  objavljuju bez reda.

### Šta MVP podržava

Samo **DA/NE** tržišta. Više ishoda (ko će biti X od 5 kandidata) je v2 —
AMM je drugačiji, UI je drugačiji, rezolucija je teža.

### Pravilo presude — obavezno, pre otvaranja

Ovo je jedina stvar koja Polymarketu pravi probleme i sa milionskim timom
(tržište „hoće li Zelenski nositi odelo", 200M$, tuča oko definicije odela).
Zato svako tržište ima četiri polja, i bez njih se ne otvara:

```
Definicija:  šta tačno znači DA. („nastava po zvaničnom rasporedu se ne
             održava u glavnoj zgradi")
Izvor:       hijerarhija. („saopštenje fakulteta; ako ga nema, dva od tri:
             N1, RTS, Nova")
Trenutak:    datum i sat po Beogradu. („15.09. u 12:00")
Ako nejasno: PONIŠTAVA SE, svima se vraća po ceni ulaska.
```

„Poništeno" je ventil koji nam čuva glavu. Bez njega svaka nejasna presuda
je optužba za nameštanje.

### Životni ciklus

```
predlog → (odobreno | odbijeno)
odobreno = otvoreno  → trguje se
zatvoreno            → trgovina stala, čeka presudu
presuđeno (DA | NE)  → 24h prozor za prigovor
konačno              → isplata pozicija
poništeno            → refund po ceni ulaska (iz bilo kog stanja posle otvoreno)
```

## Trgovanje: AMM, ne parimutuel

Parimutuel je „uloži i čekaj". Polymarket-osećaj je **portfolio**: cena se
pomera dok kupuješ, poziciju možeš da prodaš pre presude, neto vrednost ti se
menja dok gledaš. Sa pravim novcem bi ovo bilo prekomplikovano za MVP; sa
našom valutom nema razloga da ne ide odmah.

**CPMM** (Manifoldov „Maniswap"): svako tržište ima bazen DA i NE deonica,
`DA^p · NE^(1-p) = k`, gde `p` nosi početnu verovatnoću koju je kreator
zadao. Cena DA = verovatnoća. Kupovina DA za iznos `m`: `m` uđe u oba
bazena, pa se izvuče onoliko DA deonica koliko `k` dozvoljava. Prodaja je
inverz. Platforma seedne svako tržište likvidnošću (recimo pola minimalca)
— valuta je naša, seed je besplatan.

Cela matematika je **čista funkcija sa testovima** u `lib/market/amm.ts`
(FitMess „money-math" pravilo: ništa što UI prikazuje se ne računa u
komponenti). Deonica po presudi vredi 1 ako je pogodila, 0 ako nije.

Nema limita pozicije u MVP-u. Neko ko stavi ceo minimalac na jedno tržište
je sadržaj („Nemanja all-in na blokadu"), ne problem.

## Rezolucija: mi smo source of truth, i to se vidi

- **Presuđujemo mi** (jedan-dva naloga sa `is_resolver`), po pravilu koje
  piše na tržištu. Ne po osećaju.
- **Log presude je javan:** ko je presudio, kad, koji izvor je citiran (link).
- **24h prozor za prigovor:** bilo ko može da označi presudu sa obrazloženjem.
  Prigovor ne blokira, ali ga vidimo pre nego što postane konačno.
- **Poništavanje je normalno**, ne sramota. Bolje 5% poništenih nego jedno
  nameštanje.
- Kasnije: savet pouzdanih rezolvera (top predviđači sa ulogom reputacije),
  UMA-lite. Ne u MVP-u.

## Uređivačka politika (kratka, namerno)

Dozvoljeno je sve što je **ishod u svetu koji se može proveriti** — politika,
protesti, estrada, rijaliti, sport, kurs, vreme, Evrovizija, javne ličnosti u
javnoj ulozi (ostavka, kandidatura, izjava, presuda suda). Uključujući akcije
država, vojski i policije, ma koliko nasilne: „SAD udaraju Iran do 1.10.",
„policija raščistila blokadu Filološkog do 1.10." — ide. Država ne odlučuje
zbog nečije pozicije na našem tržištu; tržište je posmatrač.

Pitanje nije *da li ishod uključuje nasilje*, nego dvoje: **može li ga
učesnik izazvati** i **da li je meta konkretna osoba**. Zabranjeno, bez
izuzetka:

1. **Povreda, smrt, hapšenje imenovane osobe.** „Ministar X podneo ostavku"
   da (institucionalni ishod, Polymarket ima „Hamnei van vlasti"); „ministar
   X uhapšen / povređen" ne (tržište na patnju osobe).
2. **Ishodi koje jedan učesnik može sam, jeftino, da izazove** — incident na
   konkretnom skupu, grafit na zidu, prekid događaja. Tržište bi plaćalo
   nekome da ga napravi. Ovo je Polymarketov najružniji problem
   („assassination markets") i naša najčešća siva zona: *„policija interveniše
   na protestu u petak"* ne ide (provokator ga isprovocira za sat), a
   *„policija raščistila blokadu do 1. oktobra"* ide (odluka koja se donosi
   nedeljama).
3. **Privatne osobe.** Javna ličnost u javnoj ulozi da; komšija ne.

Sve ostalo — uključujući „luda" pitanja — je dozvoljeno. To je tačka.

## Profil, rang, flex

Za korisnika sa X-a i Reddita koji se svađa o politici, ovo je mesto gde se
**pamti ko je bio u pravu**. To je flex.

- **Neto vrednost** ovog meseca i **all-time P&L** — glavna dva broja.
- **Dosije:** lista tržišta, strana, cena ulaska, ishod. Javno.
- **Rang meseca** (neto vrednost) i **all-time**.
- **Niz** pogodaka. **Bedževi** koji se ne kupuju: „rekao 3. septembra"
  (rana pozicija koja se ispostavila tačna), „protiv struje" (pogodio kad je
  bio ispod 20%), „kreator" (N tržišta sa volumenom).
- **Kalibracija** (Brier) — v2, štreberski ali vredan broj.

## Distribucija: kartica je proizvod

Nema app store-a u MVP-u. **Web, PWA, link.** Ulazna vrata su X i Reddit, a
tamo ulazi *slika sa procentom*, ne app.

- **OG kartica za svako tržište:** pitanje, procenat, mini-grafik, „šta ti
  misliš?". Link zalepljen na X/Reddit renderuje broj. Bez ovog ništa ostalo
  ne radi. FitMess već ima share-card infrastrukturu (`src/lib/share/`) —
  prenosi se.
- **X bot sa pomeranjima:** „Blokada Pravnog: 62% → 81% u poslednja 2h."
  Polymarket živi od ovih screenshotova. Bot ih pravi sam.
- **Pozivnica sa bonusom:** ko dovede prijatelja, oboje dobiju pola dnevnice
  × 30. Jeftino, a pravi lanac.
- **Nedeljni thread na r/serbia**: „Šta Srbija predviđa ove nedelje" — top 5
  tržišta i najveća pomeranja. Ručno prve nedelje.
- **Embed za medije:** iframe sa živim procentom. Novinar koji ubaci
  „78% na Barometru" nam radi distribuciju.
- **Kartica profila:** „udvostručio minimalac u septembru" — deli se posle
  svake sezone.

## Ekrani

| ruta | šta |
|---|---|
| `/` | feed tržišta: *popularno* (volumen 24h), *novo*, *uskoro se zatvara*, *najveća pomeranja*; kategorije |
| `/t/[slug]` | tržište: pitanje, procenat velikim, grafik, kupi DA / kupi NE, tvoja pozicija, pravilo presude, komentari, log presude |
| `/novo` | predlog tržišta: 4 polja pravila presude su obavezna, ne fusnota |
| `/portfolio` | keš, pozicije po tržištu sa trenutnom vrednošću, P&L |
| `/rang` | mesec / all-time |
| `/@handle` | javni profil: brojevi, dosije, bedževi |
| `/admin/red` | red za odobrenje i presudu (za nas) |

Komentari na tržištu su u MVP-u — jednostavni, hronološki. Polymarket bez
komentara je berza; sa komentarima je forum sa ulogom. Nama treba forum.

## Tabele

| tabela | šta drži |
|---|---|
| `profiles` | `handle` (jedinstven), `phone`, `is_resolver`, `is_trusted_creator` |
| `markets` | pitanje, `slug`, `category`, `rule_definition`, `rule_source`, `resolve_at`, `close_at`, `status`, `created_by`, `initial_p`, `outcome`, `resolved_by`, `resolved_at`, `resolution_note` |
| `market_pools` | AMM stanje: `yes_shares`, `no_shares`, `p`, `k` — jedan red po tržištu, ažurira se u transakciji sa `trades` |
| `trades` | ko, tržište, strana, iznos, deonice, cena pre/posle, fee, `created_at` — append-only |
| `positions` | ko, tržište, `yes_shares`, `no_shares`, prosečna cena — izvedeno iz `trades`, materijalizovano radi brzine |
| `ledger_entries` | **double-entry, append-only**: `user_id`, `amount_minor`, `kind` ('plata','dnevnica','trade_in','trade_out','payout','refund','fee','creator_cut','referral'), `ref_market_id`, `ref_trade_id`. Stanje se **računa**, nikad ne stoji kao kolona koja može da odluta |
| `resolutions` | tržište, ishod, ko, kad, citirani izvor — javno |
| `disputes` | tržište, ko, obrazloženje, status |
| `comments` | tržište, ko, tekst |
| `price_points` | tržište, `p`, `t` — istorija za grafik i za „najveća pomeranja" |
| `referrals` | ko koga, kad, isplaćeno |

RLS kao u FitMess-u: sve što je user-owned ima own-row politike; `markets`,
`price_points`, `resolutions`, `comments` su javno čitljivi; pisanje u
`market_pools` samo kroz RPC koja radi trade u transakciji.

## Šta namerno NIJE u MVP-u

- Više ishoda po tržištu (samo DA/NE)
- Nagrade u robi / sponzori (prvo brojke, pa razgovor sa sponzorom)
- Nativna aplikacija (web + PWA; store review nam ne treba za link sa X-a)
- Savet rezolvera (mi presuđujemo)
- Limit pozicije, margina, „lending"
- Kalibracija / Brier
- Engleski

## Prvih 20 tržišta (da vidimo da li umemo da napišemo pravilo)

Kategorije i primeri — svako pre otvaranja dobija četiri polja pravila:

**Blokade i fakulteti**
- Pravni fakultet u Beogradu u blokadi 15.09. u 12:00? *(izvor: saopštenje
  fakulteta → 2 od 3 medija)*
- Bar jedan fakultet BU u blokadi 01.10.?
- Sednica Senata BU održana do 30.09.?

**Politika i institucije**
- Izbori raspisani (bilo koji nivo) do 31.12.?
- Skupština održala sednicu sa tačkom X do datuma Y?
- Ostavka ministra Z do kraja meseca? *(javna ličnost, javna uloga — dozvoljeno)*

**Protesti**
- Protest sa preko N ljudi po proceni Arhiva javnih skupova do datuma? *(izvor
  je definisan, procena je njihova, ne naša)*
- Blokada auto-puta duža od 6h u nedelji X?

**Sport**
- Zvezda prolazi grupu LŠ? / Partizan ispred Zvezde na tabeli 01.11.?
- Srbija — kvalifikacije, plasman?

**Estrada i TV**
- Pobednik rijalitija X je Y? *(DA/NE po osobi; više ishoda je v2)*
- Srbija u finalu Evrovizije 2027?

**Ekonomija i svakodnevica**
- Cena evrodizela na NIS pumpama iznad X din 01.10.? *(izvor: zvanični
  cenovnik)*
- Sneg u Beogradu (RHMZ, merna stanica Vračar, >1cm) do 01.12.?
- Inflacija (RZS, godišnja) iznad X% za septembar?

**Tehnologija i internet**
- Aplikacija X uklonjena iz srpskog App Store-a do datuma?

Ako za neko od ovih ne umemo da napišemo četiri polja tako da se ne spore —
ne otvaramo ga. To je test, ne lista želja.

## Tehnički pravac

- **Novi repo, isti stack:** Next.js + Supabase + Tailwind, kao FitMess. Novi
  Supabase projekat (čisto razdvajanje). Kopira se: auth flow, verifikacija
  telefona, share-card generator, push infrastruktura, `dates.ts` (Beograd).
- **Sav novac-math u `lib/`, testiran:** AMM, ledger, neto vrednost, rang.
- **Trade = jedna RPC u transakciji:** proveri saldo → ažuriraj pool → upiši
  trade → upiši ledger → upiši price_point. Nikad iz više poziva.
- **Cron:** plata prvog u 00:00, dnevnica svakog dana, zatvaranje tržišta po
  `close_at`, obračun „najveća pomeranja", X bot.
- **Dizajn:** nije Gravira. Tamno, gusto, brojevi krupno — berza, ne
  dnevnik. Nova tema, novi brend.

## Redosled izrade

1. **Motor** (nedelja 1): AMM + ledger + tabele + RPC za trade, sve sa
   testovima. Nema UI. Ako matematika nije tačna, ništa iznad nema smisla.
2. **Tržište i feed** (nedelja 2): `/`, `/t/[slug]`, kupi/prodaj, grafik,
   OG kartica. Prvih 20 tržišta ručno u bazu.
3. **Nalog i portfolio** (nedelja 3): telefon, handle, plata/dnevnica,
   `/portfolio`, `/@handle`, `/rang`.
4. **Predlog i presuda** (nedelja 4): `/novo`, `/admin/red`, prigovor,
   poništavanje, log presude.
5. **Distribucija** (nedelja 4–5): X bot, pozivnica, r/serbia thread, embed.

Lansiranje: zatvoreno, 50 ljudi sa X-a i Reddita koje znamo, jedan mesec
sezone. Ako posle prve plate ljudi dođu po drugu — otvaramo.

## Otvorena pitanja

- **Ime i domen.** Barometar je placeholder.
- **Iznos seeda po tržištu** — pola minimalca je pretpostavka; premalo = cena
  skače na svaku kupovinu, previše = cena se ne miče i dosadno je. Proba.
- **Da li kreator sme da trguje na svom tržištu.** Polymarket: da. Manifold:
  da. Rizik je mali kad nema keša; verovatno da, ali označeno.
- **Anonimnost.** Handle bez pravog imena je verovatno nužan za politiku u
  Srbiji. Telefon ostaje kod nas, ne na profilu.
