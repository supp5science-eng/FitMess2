# Arena — tržišta predviđanja (klađenje bez keša)

Stanje na dan **02.09.2026**. Ovaj dokument zaključuje razgovor koji je počeo
01.09. u `ARENA-izazovi-kladjenje-RAZRADA.md` (tri zida, tri račve) i nastavljen
02.09. Cilj mu je isti kao kod `naplata.md`: da se za mesec dana ne raspravlja
ponovo o stvarima koje su već odlučene.

Prethodni dokument ostaje na snazi kao analiza. Ovaj nosi **odluke**.

---

## Model u jednoj rečenici

Neko javno kaže da će nešto uraditi, ulaže **internu valutu** na sebe, protivnik
ulaže protiv njega, **publika ulaže na obojicu**, procenat se pomera uživo kao na
Polymarket-u, snimak presuđuje, fond se deli — i **valuta nikad ne izlazi u keš**.

Presedan je **Manifold Markets**: Polymarket klon sa igračkom valutom. Radi
godinama, ima više aktivnih tržišta od Polymarket-a, i nema licencu jer nema šta
da se isplati.

---

## Odgovori na tri račve iz razrade od 01.09.

| Račva | Odgovor |
|---|---|
| 1. Šta se meri u v1 | **(c) oba, ali `confidence` odlučuje šta sme na javno tržište.** Bez novca, samoprijava više nije katastrofa — samo ne sme da nosi publiku. |
| 2. Koja mehanika | **Duel je motor, tržište je proizvod.** Duel 1v1 radi na N=2; publika se kači na isti objekat. Ne grade se dva sistema, nego jedan sa publikom i bez nje. |
| 3. Novac | **(a) bez pravog novca. Ledger currency-agnostic od prvog dana.** |

Zid 1 i zid 2 iz razrade time padaju — ne zato što smo ih rešili, nego zato što
smo izašli iz njihovog domašaja. Zid 3 (likvidnost) se **obrće**: vidi niže.

---

## ⚠️ Zamka koja preživi „nema keša" — pročitati pre bilo čega

U razgovoru je pao predlog: **valuta se dokupljuje pravim novcem** („to je tvoj
prihod"), a **mesečni top 10 predviđača dobija paket suplemenata**.

**Te dve stvari zajedno vraćaju tačno ono što izbegavamo.** Definicija igre na
sreću svuda glasi isto: *ulog* + *ishod van tvoje potpune kontrole* + *dobitak
koji ima vrednost*. Ako se valuta kupuje, ulog je plaćen. Ako se dobija roba,
dobitak ima vrednost. Nema veze što valuta ne izlazi u keš — vrednost je ušla na
jednu stranu i izašla na drugu. Nagradna igra u robi je u Srbiji poseban režim
(prijava/odobrenje Ministarstvu finansija) i uslov joj je da učešće **ne košta**.

Ovo nije pravni savet i tačan režim se pre prve nagrade proverava sa nekim ko to
radi. Ali granica je dovoljno jasna da se po njoj gradi:

**Sme jedna noga, ne obe.**

- **Noga A — valuta se NE prodaje, nagrade su moguće.** Valuta se samo zarađuje
  (početni budžet, dnevni priliv, dobici). Učešće je besplatno, pa nagrada u robi
  ostaje nagradna igra, ne klađenje.
- **Noga B — valuta se prodaje, dobitak nema nikakvu vrednost.** Prihod od
  prodaje valute, ali dobija se isključivo status: rang, bedž, kartica za story.
  Ništa što se može zameniti za robu, vaučer, pretplatu ni popust.

**Preporuka za v1: noga A.** Tri razloga:

1. Prihod već postoji i ne zavisi od ovoga — pretplata iz `naplata.md`
   (besplatno zauvek uz 5 AI procena dnevno, pretplata za više). Prodaja valute
   bi bila drugi naplatni tok pre nego što prvi ima ijednog pretplatnika.
2. Prodaja valute za klađenje menja kako app izgleda u store review-u. Sa
   kupovinom, ovo je *simulated gambling* i ide u stariju uzrasnu kategoriju;
   bez kupovine, ovo je društvena igra predviđanja. Imamo dva prolaza kroz review
   (Apple 23.08.) koje ne isplati rizikovati zbog nedokazanog toka prihoda.
3. Plan rasta cilja mlađu publiku ([[fitmess-avatari-mating]]). Prodaja žetona
   za klađenje toj publici je posao koji ne želimo da branimo.

Prekidač između nogu je jedan red u konfiguraciji, ne prepisivanje. Kod se piše
tako da prodaja valute može da se uključi — ali tada nagrade u robi gase istog
dana.

**Ono što ne ide nikad:** izlaz valute u keš, u vaučer koji se prodaje, u
pretplatu, u popust kod nas ili kod sponzora, „sweepstakes" konstrukcija sa
drugom valutom, i prenos valute među korisnicima (P2P prenos = siva berza, i
mrtav je čim postoji).

---

## Likvidnost — zid 3 se obrće

U razradi je pisalo da P2P tržište na dan 1 nema protivponudu. To važi za pravi
novac. Igračka valuta radi obrnuto:

Pravi novac ubija likvidnost na 200 korisnika. Da bi neko uložio 500 dinara na
Nikolu iz teretane, mora da uplati, verifikuje ličnu kartu i razmisli. Igračkom
valutom: klik, uložio si, tri sekunde. **Volumen pravi frikcija, ne vrednost
uloga.** Zato tržište sa strane, koje je u razradi bilo Faza 3, ovde ulazi u v1.

---

## Mehanika tržišta

**Parimutuel (zajednički fond), ne fiksne kvote.** Platforma nikad ne drži
poziciju i ne može da izgubi.

1. **Seed.** Marko uloži 1000 na NE, Nikola 1000 na DA. Start je 50%. Iskren
   početak, nema veštački postavljene kvote.
2. **Publika ulazi** na DA ili NE. Procenat = udeo DA fonda u ukupnom fondu i
   pomera se sa svakom uplatom. To je broj koji ide na karticu i crta se kao
   grafik kroz vreme.
3. **Strane su zaključane.** Ko je ušao na DA ne može posle na NE. Nema
   hedžovanja i nema izlaska iz pozicije — ovo nije berza, nego opklada.
4. **Prozor se zatvara kad subjekt pritisne „Krećem".** Od tog trenutka ima
   fiksni rok (30 min) da okači snimak. Niko ne ulaže pošto je video ishod.
5. **Presuda** → pobednička strana deli **ceo** fond srazmerno ulogu, minus fee.

Publika zarađuje kad je bolje kalibrisana od gomile — i kad poznaje Nikolu.
Informaciona prednost drugara iz teretane je feature, ne bug.

---

## Ekonomija valute

Ovo je deo koji igračke ekonomije obično sruši, pa ide u dokument sa brojevima.

**Radni naziv valute:** `gram`. „Uložio 500 grama." Alternative: `bod`, `žeton`.
Odluka o imenu je otvorena; kod u ledgeru koristi kod valute `FM`.

| Poluga | Polazna vrednost | Uloga |
|---|---|---|
| Početni budžet | 1.000 | da prvo tržište može odmah |
| Dnevni priliv | 50/dan, **ne akumulira se** | oskudica: propušten dan je propušten |
| Minimalni ulog | 10 | |
| Fee sa fonda | 5% → **spaljuje se** | jedini odliv iz sistema |
| Kapa publike po tržištu | 5× zbir uloga učesnika | vidi „Manipulacija" |
| Bankrot | ispod 50 → dopuna do 50, **javno u dosijeu** | niko ne ispada iz igre, ali svi vide |

**Fee bez keša nije prihod — fee je odliv.** To je jedina razlika u odnosu na
pravu kladionicu i mora da bude jasna svakome ko dira ovaj kod. Parimutuel je
među korisnicima nulta suma; jedini priliv je dnevni priliv, jedini odliv je fee.
Ako priliv nadmaši spaljeno, valuta se obezvređuje i ulog prestaje da peče.

**Pravilo za podešavanje:** prati se odnos `izdato/spaljeno` po nedelji. Kad
inflacija raste, **smanjuje se dnevni priliv**, ne diže fee. Fee koji peče gasi
volumen; manji priliv samo pojačava oskudicu, što je i poenta.

**Zašto uopšte peče kad nije novac.** Ne peče iznos, peče: oskudica (ne možeš da
dokupiš), javnost (gubitak vidi ceo profil) i nepovratnost (nema poništavanja
pozicije). Rang koji se deli kao „#3 predviđač u Srbiji ovog meseca" je status —
340 dinara dobitka nije.

---

## Rang se ne meri parama nego kalibracijom

Ako lista najboljih rangira po stanju računa, pobeđuje onaj ko ima najviše naloga
i najviše slobodnog vremena. Zato se **rangira po tačnosti**:

- **Kalibracija** (Brier score) preko rešenih tržišta — koliko si bio u pravu kad
  si tvrdio da si siguran.
- **Prinos po uloženom**, ne apsolutni dobitak.
- **Prag:** minimum 20 rešenih tržišta da bi se ušlo na listu.
- Lista se **resetuje mesečno**; dosije (istorija) ostaje trajno.

Time otpada i najveći deo motiva za lažne naloge: alt nalog donosi 50 grama
dnevno i nula rejtinga.

---

## Verifikacija i presuda

Bez novca presuda može da bude jeftinija — ali ne sme da bude neuverljiva, jer
broj na kartici vredi tačno onoliko koliko vredi presuda iza njega.

**Snimak po instrukcijama, uvek:**
- **kod tržišta se izgovori na početku snimka** (sprečava stari snimak),
- jedan kadar, bez reza; tegovi/brojač vidljivi u kadru,
- upload **u app**, ne link na tuđi servis.

**Tok:** AI pre-pregled (kontinuitet, ima li rez, čita li se kod, poklapa li se sa
zadatim parametrom) → ako je čisto i niko ne ospori u roku od 6h, **rešava se
automatski** → osporeno ili sumnjivo ide u red za ljudsku presudu → `void` je
uvek dozvoljen izlaz i svima vraća ulog.

`VerificationAdapter.confidence` iz razrade ostaje, ali sad odlučuje drugu stvar:

| confidence | izvor | sme duel | sme javno tržište |
|---|---|---|---|
| `hard` | HealthKit / Health Connect (koraci, trening) | da | da |
| `video` | snimak + presuda | da | da |
| `soft` | samoprijava (kalorije, unos hrane) | da | **ne** |

Kalorije time ostaju u igri kao duel među poznanicima — socijalna cena laganja
pred drugarom je stvarna — ali ne mogu da nose fond publike. To je razlika koju
zid 1 iz razrade traži, a da se metrik ne izbacuje.

---

## Manipulacija — šta otpada, šta ostaje

Otpada gotovo sve: nema šta da se ukrade, pa nema KYC-a, kape zbog pranja, provere
obrasca uplata, ni tima za 12h pregled.

Ostaje **jedna** stvar: subjekt kontroliše ishod i može namerno da padne da bi
njegovi drugari na NE pokupili rang. Zato:

- **Subjekt uvek gubi svoj ulog kad padne** — nema konstrukcije u kojoj profitira
  od pada.
- **Kapa publike = 5× zbir uloga učesnika.** Hoćeš veliki fond na sebi, uloži
  više svojih. Nameštanje košta.
- **Dosije pamti `upset`** — pao kad je 80% verovalo. Dva puta → nalog više ne
  može da bude subjekt javnog tržišta (duel može).

Ovo nije zaštita novca nego zaštita **broja**. Procenat na kartici je proizvod;
ako je namešten, kartica ne vredi ništa.

---

## Model podataka

Nadovezuje se na razradu (`ARENA-izazovi-kladjenje-RAZRADA.md`, sekcija 4). Isto
ostaje: `challenge_templates`, `challenges`, `participants`, `verifications`,
`resolutions`, `user_stats`. Dodaje se tržište:

```
markets            challenge_id, question, status, opens_at, closes_at,
                   resolve_deadline, outcome (yes|no|void),
                   fee_bps, audience_cap_ratio, seed_yes, seed_no

positions          market_id, user_id, side (yes|no), amount_minor,
                   placed_at, price_at_entry   -- procenat u trenutku ulaska
                   UNIQUE (market_id, user_id) -- jedna strana po čoveku

market_snapshots   market_id, at, yes_pool, no_pool, implied_pct
                   -- red po uplati; ovo je grafik, ne računa se naknadno

evidence           challenge_id, user_id, storage_ref, spoken_code,
                   ai_review (json), uploaded_at

judgments          challenge_id, judged_by (ai|user|admin), verdict, note, at

wallets            user_id, currency, balance_minor   -- IZVEDENO iz ledgera
ledger_entries     account, counter_account, amount_minor, currency,
                   ref_type, ref_id, idempotency_key
                   accounts: user:<id> | pool:<market_id> | burn:fee | mint:faucet

faucet_grants      user_id, day, amount_minor, kind (daily|initial|bankrupt)
                   UNIQUE (user_id, day, kind)  -- dnevni priliv se ne duplira
```

**Tri pravila koja se posle ne ušivaju:**

1. **Novac se ne pomera direktno.** Nema `balance = balance - 10`. Sve kroz
   double-entry ledger sa idempotency ključem. `mint:faucet` i `burn:fee` su
   nalozi kao i svaki drugi — zato je ukupna emisija u svakom trenutku jedan
   upit, a ne procena.
2. **`amount_minor` + `currency`.** Currency je `FM`. Ako sutra partner sa
   licencom hoće ovo kao svoj proizvod, menja se kod valute i dodaje payment
   adapter — logika ostaje.
3. **`params` izazova se snapshot-uje.** Template se sutra menja, stara tržišta se
   ne smeju pomeriti.

**Podrazumevano: `positions` su javne** (ko je uložio na koju stranu). To je
gorivo cele stvari, ne curenje podataka. Iznos uloga je vidljiv, stanje računa
nije.

---

## Statusi

Automat iz razrade ostaje za izazov. Tržište ima svoj, vezan za isti objekat:

```
market:  open  →  locked        (subjekt pritisnuo „Krećem", prozor zatvoren)
               →  awaiting      (rok za snimak, npr. 30 min)
               →  judging       (AI pre-pregled + rok za osporavanje)
               →  resolved      (ishod poznat)
               →  settled       (ledger proveden)

bočno:  void   (istekao rok bez snimka, osporeno uspešno, admin) → refund svima
```

Prelazi su **poslovi na serveru vođeni vremenom**. Klijent nikad ne kaže
„ispunio sam" ni „zatvori tržište".

---

## Ekrani (v1)

1. **Arena** — lista živih tržišta, svako sa procentom i vremenom do zatvaranja.
2. **Tržište** — pitanje, grafik procenta kroz vreme, obe strane sa imenima i
   ulozima, dugme „Uloži". **Ovo je ceo proizvod.**
3. **Kreiranje** — izazov (template + parametar), rok, seed ulog, protivnik.
4. **Ulaganje** — strana, iznos, prikaz „ako ovo prođe, dobijaš ~X" (procena po
   trenutnom fondu, sa jasnim „procena, fond se još pomera").
5. **Krećem / snimak** — instrukcije, kod koji se izgovara, snimanje u app-u.
6. **Presuda** — ishod, isplata, share kartica sa procentom pre i posle.
7. **Dosije** — istorija, niz, kalibracija, `upset` markeri.
8. **Novčanik** — stanje, izvod iz ledgera čitljivo, dnevni priliv.

---

## Dva sudara sa ranijim odlukama

**Sa tezom proizvoda** ([[fitmess-poslovni-cilj]]): dogovoreno je da je FitMess
*instrument, ne plan* — test je „govori li o korisniku ili mu govori šta da
radi". Arena mu eksplicitno govori šta da radi. To je svestan zaokret, ne
propust. Formulacija koja miri: **tracker je instrument, Arena je mesto gde ono
što instrument izmeri nešto znači.** Ako Arena postane glavna, tracker postaje
infrastruktura za nju — i to je onda nov proizvod, ne feature. Odluka o tome nije
doneta.

**Sa planom rasta** ([[fitmess-avatari-mating]]): mlađa publika i klađenje pravim
novcem se ne spajaju. Sa igračkom valutom se spajaju — pod uslovom da valuta
ostane neprodajna (noga A gore). To je još jedan razlog zašto je noga A izabrana.

---

## Šta ovo ne rešava

- **Prazna Arena.** Tržište sa dva učesnika i bez publike izgleda mrtvo. Prvih 50
  tržišta mora neko ručno da napravi i ugura, kao kod svakog marketplace-a.
- **Presuda i dalje košta čoveka.** AI pre-pregled smanjuje red, ne gasi ga.
- **Tekst u UI-u.** Reč „klađenje" ne ide u UI ni u store listing — interno je to
  klađenje, korisniku i recenzentu je „predviđanje" i „Arena".
- **Gde ovo živi.** Native app (`fitmess-app`, Expo). Web app ne dobija Arenu.

---

## Prekidač ka pravom novcu

Ne gradi se, ali mu se ostavlja mesto. Ako se jednog dana ide sa partnerom koji
ima licencu (Mozzart/Meridian tipa: oni licencu, KYC i isplate — mi app, sudiju i
publiku), menja se ovo i ništa više:

- `currency` u ledgeru,
- payment adapter za uplatu/isplatu na ivici sistema,
- vraća se sve što je nogom A ukinuto: KYC, provera obrasca uplata, ljudski
  pregled pre isplate, limit po tržištu.

Pregovara se iz pozicije „imamo 10.000 ljudi koji ovo već rade", ne iz ideje. Do
tada — nijedan dinar ne ulazi ni ne izlazi iz Arene.
