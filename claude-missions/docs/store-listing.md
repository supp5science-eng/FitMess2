# Tekstovi i slike za App Store i Google Play

Sve što se ručno kuca u dve konzole. Brojevi u zagradama su ograničenja polja —
oba store-a odbijaju unos preko limita, bez upozorenja unapred.

Stanje: **tekstovi su predlog, čekaju tvoju potvrdu.** Tri polja su prazna jer
zavise od podataka koje samo ti imaš (pravno lice, kontakt email, javni URL-ovi
pravnih stranica koje pravi Agent A).

---

## 0. Odluke koje još nisu donete

| Šta | Stanje |
|---|---|
| Ime u store-u | ✅ **FitMess** (odluka 09.08.2026) |
| Pravno lice (fizičko lice vs firma) | čeka; EU trader pravilo, ime i adresa postaju **javni** u oba store-a |
| Kontakt email | `podrska@fitmess.app` je do sada bio placeholder — treba sanduče koje se stvarno čita |
| Privacy Policy URL | čeka Agenta A (`/privatnost`) |
| Brisanje naloga URL | čeka Agenta A (`/brisanje-naloga`) — Play ga traži kao **javnu** stranicu |

---

## 1. Ime

```
FitMess
```

Odluka vlasnika, 09.08.2026: čisto ime brenda, bez ključnih reči u naslovu.

Posledica koju treba znati unapred: naslov nosi najveću težinu u pretrazi oba
store-a, pa se sav teret nalaženja prebacuje na **Apple keywords** (§2) i na
**Play short description** (§3) — oba su ispod napisana tako da nose reči koje
ljudi zaista kucaju („kalorije", „ishrana", „obrok"). Ako se za nekoliko meseci
pokaže da organska pretraga ne donosi instalacije, prvo mesto za probu je ime:
Apple i Play ga dozvoljavaju da se menja sa svakim novim izdanjem.

„Alat ka boljem životu" ide kao **subtitle** (§2) — tamo govori istu stvar, a ne
troši mesto koje pretraga čita.

Ispod ikonice na telefonu piše samo `FitMess` (`appName` u `capacitor.config.ts`
i `app_name` u `strings.xml`) — to se ne menja bez obzira na ime u listingu.

---

## 2. App Store Connect

Jezik listinga: **English (U.S.) slot sa srpskim tekstom.** Apple nema srpski
među jezicima za metapodatke (ima hrvatski i slovenački, srpski ne), a publika
je 100% Srbija. Recenzent dobija posebnu belešku na engleskom (§5).

### Subtitle (30)

```
Alat ka boljem životu
```
(21 znak. Alternativa ako ime već nosi „bez stresa": `Kalorije iz jedne slike` — 23.)

### Promotional text (170) — menja se bez nove submisije

```
Slikaš tanjir, dobiješ kalorije i makroe. Bez vaganja, bez pretrage po
tabelama. Nedelja je jedinica uspeha — jedan loš obrok ne ruši nedelju.
```
(141 znak.)

### Description (4000)

```
FitMess je brojač kalorija koji ne traži da vagaš hranu i ne tera te da
pretražuješ beskrajne tabele. Slikaš tanjir — naziv, gramaža, kalorije i makroi
stignu sami. Pa proveriš i ispraviš ako treba.

Napravljen je za Srbiju: pljeskavica, sarma, pasulj i burek su u katalogu
onakvi kakvi jesu, a sve u aplikaciji je na srpskom.

PET NAČINA DA UPIŠEŠ OBROK
• Slikaj obrok — jedna slika i gotovo, najbrže
• Prizma — dva ugla i pitanja o obroku kad ti treba najtačnija procena
• Gric — izgovoriš „banana i šaka badema" i sitnice su upisane
• Slikaj deklaraciju — vrednosti sa pakovanja se same očitaju
• Trening — upišeš šta si radio i vidiš koliko si potrošio

TVOJ DAN, NA JEDNOM EKRANU
Koliko ti je ostalo do cilja, koliko si pojeo, i od čega. Proteini, ugljeni
hidrati i masti. Voda i koraci. Prevučeš u stranu i vidiš vlakna, šećer, so i
zasićene masti — jer dan od 2000 kalorija nije uvek isti dan.

NEDELJA JE JEDINICA USPEHA
Jedan preobilan ručak ne ruši nedelju. FitMess preraspodeli prekoračenje na
ostatak nedelje umesto da te tera da „sutra nadoknadiš" — rez je ograničen tako
da plan ostane izvodljiv, a koraci prate isto.

VAGA UMESTO PROCENE
Jednom nedeljno se izmeriš i aplikacija poredi šta se stvarno desilo sa onim
što je predviđala. Ako se ne poklapa, predloži korekciju dnevnog cilja — ti je
prihvatiš jednim dodirom. Formula se ispravlja prema tvom telu, ne obrnuto.

ANALITIKA KOJA NEŠTO ZNAČI
Nedeljni pregled unosa, dnevni prosek, BMI, kvalitet ishrane i istorija svih
obroka. Podsetnici ujutru i uveče, ako ih hoćeš.

TVOJI PODACI SU TVOJI
Sve što si uneo možeš da preuzmeš u jednom fajlu, a nalog i sve uz njega da
obrišeš iz same aplikacije, bez pisanja podrške.

FitMess ne postavlja dijagnoze i ne zamenjuje lekara ni nutricionistu.
Procene kalorija iz fotografije su procene — koriste veštačku inteligenciju i
mogu da promaše. Za medicinska pitanja obrati se lekaru.
```

### Keywords (100, zarezi bez razmaka)

```
ishrana,dijeta,mrsavljenje,makroi,proteini,brojac,obroci,vaga,fitnes,zdravlje,unos,tanjir
```
(88 znakova.) **Ne ponavljaj reči koje su već u imenu** — Apple ih i tako
indeksira, pa bi bile bačen prostor. Ako ime ne bude sadržalo „kalorije",
dodaj `kalorije,` na početak (ostaje 78 + 9 = 97).

### Ostala polja

| Polje | Vrednost |
|---|---|
| Primary category | Health & Fitness |
| Secondary category | Food & Drink |
| Support URL | `https://fitmess.app` (dok ne postoji posebna stranica podrške) |
| Marketing URL | `https://fitmess.app` |
| Privacy Policy URL | ⚠️ čeka Agenta A |
| Copyright | `2026 <pravno lice>` — čeka odluku |
| What's New (v1.0) | `Prva verzija u App Store-u.` |

---

## 3. Google Play

Jezik: **srpski (`sr`)** — Play ga podržava, za razliku od Apple-a.

### Title (30)

Isto ime kao na Apple-u (§1).

### Short description (80)

```
Slikaj obrok — kalorije i makroi stižu sami. Bez vaganja i pretrage.
```
(68 znakova.)

### Full description (4000)

Isti tekst kao Apple description (§2). Play dozvoljava ista formatiranja
(prazan red, `•`), pa se prenosi bez izmena.

### Ostala polja

| Polje | Vrednost |
|---|---|
| App category | Health & Fitness |
| Tags | kalorije, ishrana, praćenje težine |
| Contact email | ⚠️ čeka — vidi §0 |
| Website | `https://fitmess.app` |
| Privacy Policy URL | ⚠️ čeka Agenta A |
| Account deletion URL | ⚠️ čeka Agenta A — Play traži **javnu** stranicu |

---

## 4. Slike

Sve se pravi skriptama, ništa se ne crta ručno.

| Šta | Gde | Kako se pravi |
|---|---|---|
| iOS ikonica 1024² (bez alfe) | `assets/icon-only.png` → binarni fajl | `scripts/gen-store-assets.cjs` + `@capacitor/assets` |
| Play ikonica 512² | `store/play-icon-512.png` | isto |
| Play feature graphic 1024×500 | `store/play-feature-graphic.png` | `scripts/store/gen-feature-graphic.cjs` |
| App Store screenshotovi 1320×2868 | `store/screenshots/appstore-6.9/` | `scripts/store/capture-screens.cjs` pa `compose-screenshots.cjs` |
| Play screenshotovi 1080×1920 | `store/screenshots/play-phone/` | isto |

Redosled slajdova (prvi je jedini koji se vidi u pretrazi):

1. Slikaj obrok. Broj sam stiže.
2. Ceo dan na jednom ekranu.
3. Pet načina da upišeš obrok.
4. Grickao si nešto? Samo reci.
5. Ne samo kalorije.
6. Nedelja, ne jedan dan.

⚠️ **iPad.** `TARGETED_DEVICE_FAMILY` je trenutno `"1,2"`, što znači da je app
deklarisan i za iPad — Apple onda traži i iPad screenshotove (2064×2752) i
recenzent ga testira na iPadu. Ako ostaje samo iPhone, promeniti u `"1"`.

---

## 5. Recenzentima

App Review Notes (Apple) i „Instructions for reviewer" (Play). Na engleskom —
recenzent nije sa ovog tržišta.

```
The app's interface is in Serbian only; the product targets Serbia.

Demo account (already contains several weeks of meals, weigh-ins and steps):
  email: supp5science+fitmess-demo@gmail.com
  password: DemoZaVideo!2026

Sign-in: tap "Prijavi se" on the first screen, enter the credentials above.
No email confirmation is needed for this account.

Notes:
- The app is phone-only by design. Opening it on a tablet or desktop browser
  shows an "open this on your phone" page. The native app is exempt from that
  check, so the build you received behaves normally.
- Photo estimation ("Slikaj obrok") sends the photo to Google Gemini, gets
  calories and macros back, and does not store the photo beyond one day.
- Health data (weight, meals, steps) is stored per user and can be exported or
  deleted from inside the app: Podešavanja → Moji podaci / Obriši nalog.

Device features this app uses (all reachable from the demo account):
- Push notifications. Podešavanja → Podsetnici. The app asks for permission and
  then sends a morning plan, an evening review of the day, and a reward
  notification after three logged meals.
- Camera. The "+" button → "Slikaj obrok" opens the camera to photograph a
  meal; "Prizma" guides the user through two angles for a closer estimate.
- Microphone. The "+" button → "Gric" records a short spoken phrase to log
  small items ("jabuka i šaka badema") without typing.
```

> **Za 4.2, ne za recenzenta.** Gornji odeljak „Device features" je odgovor na
> pravilo 4.2 („minimum functionality" / „a website bundled as an app"). Nabraja
> se ono što se stvarno oslanja na uređaj i što web stranica ne može sama —
> APNs push, kamera, mikrofon. Sve troje je proverljivo iz demo naloga, pa
> tvrdnja ne visi na obećanju.
>
> ⚠️ **Ne slati dok push nije dokazan na pravom telefonu.** Na 15.08.2026. u
> `push_subscriptions` stoje 3 reda i sva tri su `platform='web'`, najnoviji od
> 09.08. Nijedan iOS token. Ako recenzent uključi Podsetnike a ništa ne stigne,
> ovaj argument radi protiv nas jače nego da ga nismo ni napisali.

⚠️ Demo nalog **mora imati sveže podatke** kad recenzent uđe. Zato ga pustiti
ponovo (`node scripts/store/seed-demo-data.cjs`) neposredno pred slanje i još
jednom tokom recenzije — ustaje po kalendaru, ne od nečijeg rada.
**Poslednji put pušten: 15.08.2026** (35 dana, 131 obrok, dnevni prosek 2420
kcal naspram cilja 2450).

---

## 6. Privatnost i Data Safety

Isti odgovori u oba upitnika. Ovo je popis onoga što app stvarno radi; svaka
stavka je proverljiva u kodu.

| Podatak | Prikuplja se | Vezan za korisnika | Za oglašavanje/praćenje |
|---|---|---|---|
| Email adresa | da (registracija) | da | ne |
| Ime | da (upitnik) | da | ne |
| Broj telefona | da (registracija) | da | ne |
| Zdravlje i fitnes (težina, obroci, koraci, treninzi) | da | da | ne |
| Fotografije hrane | da, privremeno (~1 dan) | da | ne |
| Podaci o korišćenju (PostHog) | da | da | ne |
| Dijagnostika grešaka (Sentry) | da | da | ne |

Dodatno, oba store-a traže da se izričito navede:
- podaci se šalju trećoj strani na obradu (**Google Gemini** za procenu iz
  fotografije, **Supabase** za bazu i autentikaciju, **Vercel** za hosting);
- korisnik može da **obriše nalog iz aplikacije** i sa **javne stranice**;
- Play traži i **Health apps declaration** jer app barata zdravstvenim podacima.

Uzrasna ocena: nije 4+/Everyone automatski — upitnici imaju stavku o
zdravstvenim temama i mršavljenju, pa je verovatan ishod 12+ (Apple) odnosno
Teen (Play). Odgovarati iskreno; pogrešna ocena je razlog za skidanje app-a.
