# Naplata

Stanje na dan **23.08.2026**. Ovaj dokument je tu da se za mesec dana ne
raspravlja ponovo o stvarima koje su već odlučene, i da se ne ponove dve greške
koje su nas skoro odvele u pogrešnom pravcu.

---

## Model

**Besplatan nivo ostaje besplatan — zauvek.** Do **5 AI procena dnevno**
(slikanje obroka, deklaracije, glas, grič, Prizma, novi proizvod). Unos hrane
pretragom, voda, koraci, analitika, navike — **neograničeno, uvek**.

Pretplata je za onoga ko hoće više od pet procena dnevno.

**Ovo nije probni period.** Uslovi korišćenja su do 23.08.2026 obećavali „7 dana
besplatnog korišćenja pre naplate" — probni period o kome nikad nije doneta
odluka. To je ispravljeno; vidi „Obećanja koja se ne smeju razići" niže.

---

## Zabluda koju treba razrešiti odmah

> „Ako naplaćujemo na sajtu, prodavnice će nas banovati."

**Netačno, ali sa važnim „ali".**

Prodaja pretplate na sopstvenom sajtu **nije** razlog za ban. Apple i Google
nemaju nadležnost nad `fitmess.app` u pregledaču, a Apple guideline 3.1.3(b)
(„Multiplatform Services") izričito dozvoljava da aplikacija **prizna pretplatu
kupljenu drugde**, pod uslovom da je ista dostupna i kao IAP. Spotify, Netflix i
Notion rade tačno to.

Zabranjeno je uže:

1. Naplata tuđim procesorom **unutar** aplikacije (guideline 3.1.1 / Play Billing).
2. **Navođenje** iz aplikacije ka svom checkout-u — dugme, link, čak i rečenica
   „jeftinije je na sajtu".

**A sad „ali", i ono je ozbiljno.** FitMess je *remote* Capacitor ljuska:
`server.url` je `https://fitmess.app`, pa je **ceo URL prostor sajta unutar
aplikacije**. Recenzent može da stigne na bilo koju rutu — ne mora da prati
link. Kod obične aplikacije su web i binarni fajl dva odvojena kodna stabla i to
je fizički nemoguće.

### Ako se web naplata ikad bude radila

Odbrana **ne sme** da bude „sakrij link do `/pretplata`". Mora biti **negativna i
globalna**:

- U `src/middleware.ts` (već računa `isNativeShell`): nativni UA → ruta sa
  Stripe-om **ne postoji**. Rewrite na IAP paywall, za svaku putanju, *fail-closed*
  — svaka sumnja ide na nativnu granu.
- Recenzent **ne može da promeni UA** (postavlja ga WKWebView), pa gate drži.
  Rizik nije njegova dosetka nego **naš bug**.
- ⚠️ `limitsNavigationsToAppBoundDomains: false` znači da link van `fitmess.app`
  otvara sistemski pregledač i time **zaobilazi middleware**. Nijedan link u
  nativnom renderu ne sme da vodi ka checkout-u.
- ⚠️ `public/sw.js` je već jednom keširao pogrešnu stranicu. Paywall ruta mora
  biti `no-store`.

---

## Odluka: v1 = samo IAP

Ne zato što je web zabranjen, nego zato što se **ne zna da li treba**, a porez na
pažnju se plaća odmah i zauvek. Samo IAP znači: nema `if`-a koji može da pukne,
nema rute koju treba kriti.

Provizija od 15–30% je jeftinija od jednog odbijanja i jednog ciklusa review-a.
Web korisnik nije odsečen — entitlement živi u Supabase-u, pa ko plati u
aplikaciji ima pristup i u pregledaču.

**RevenueCat** kao jedini sloj: Apple + Google (+ kasnije Stripe) pišu u **isti**
`entitlements` red preko webhook-a. Nikad se ne pita Apple na hot path-u — pita
se svoja baza, isti princip kao `fm_gate` cookie.

---

## Faza 0 — urađena

Commit `0718476`, migracija `0032_entitlements.sql` (**primenjena** na
produkciji 23.08.2026; verifikovano zasebnim upitom, jer „Success. No rows
returned" je izgled uspeha, a ne dokaz).

### Šta postoji

| | |
|---|---|
| `entitlements` | Ko ima plaćen pristup. **Nema reda = besplatan korisnik**, pa se ništa ne popunjava pri registraciji. |
| `ai_usage` | Brojač po korisniku po **beogradskom** danu. |
| `consume_ai_quota()` | Naplaćuje jednu procenu, vraća `(used, entitled)`. |
| `src/lib/ai/quota.ts` | Odluka: proći, ili odbiti. |
| `src/lib/ai/limits.ts` | Sama konstanta `FREE_DAILY_AI`, bez serverskih uvoza. |

### Tri stvari koje su lako pogrešne, pa su namerno ovakve

**1. Nijedna tabela nema pravo pisanja za `authenticated`.**
Sa uobičajenom „svoj red smeš da menjaš" politikom, korisnik bi kroz REST API
sebi **resetovao brojač** ili **upisao pretplatu**. Brojač se pomera isključivo
kroz `consume_ai_quota`, koja je `SECURITY DEFINER` i koja `auth.uid()` **čita
sama** umesto da ga prima kao argument — pa pozivalac ne može da pomeri tuđi red
ma šta poslao. Uvećanje je jedna `INSERT .. ON CONFLICT` naredba, tako da dva
brza tapa ne mogu oba da pročitaju `3` i oba upišu `4`.

**2. Brava je na nivou KORISNIČKE RADNJE, ne HTTP poziva.**
Prvobitni plan je bio da gate stoji u `src/lib/ai/gemini.ts`, kao jedina tačka
kroz koju sve prolazi. **To je bilo pogrešno.** Prizma šalje modelu **dve**
poruke za **jedan** obrok (`analyzeMealAction`, pa `finalizeMealAction`, koje
dele `readImages`). Naplata po HTTP pozivu bi taj obrok naplatila dvaput i „5
dnevno" bi značilo dva i po. Zato `chargeAiEstimate` stoji u svih šest tokova
pojedinačno, a Prizma se naplaćuje **samo na koraku 1**.
Cena tog izbora: nova AI akcija može da zaboravi da pita. Zato test čita te
fajlove i pada ako `chargeAiEstimate` nedostaje.

**3. `ENFORCE_AI_LIMIT = false` je odluka, ne nedovršen posao.**
Zid bez vrata. Izmereni problem ove aplikacije je što se ljudi **ne vraćaju
posle plana**; presecanje šestog slikanja nekome ko se još trudi da unosi
pogoršava baš to, a ne zarađuje ništa dok sa druge strane zida stoji samo
izvinjenje. Postoji test koji **pada ako neko upali presecanje** — paywall mora
u isti commit.

### Zašto faza ide pre paywall-a

Kad korisnik probije petu procenu, `funnel_events` beleži `ai_limit_hit` sa
**površinom**: `native_ios` / `native_android` / `browser`.

To je broj koji odlučuje da li web naplata ikad vredi svog rizika. Ako se za dve
nedelje pokaže da skoro svi koji udaraju u limit ionako sede u store aplikaciji,
cela rasprava iz prvog poglavlja je zatvorena — bez ijedne linije rizičnog koda.

### Pada otvoreno

Ako RPC pukne (recimo, migracija nije primenjena), korisnik **dobije svoju
procenu**, a greška ode u log. Brojač je knjigovodstvo; odbiti analizu nečijeg
ručka zato što je knjigovodstvo štucnulo je pokvarena aplikacija.

---

## Obećanja koja se ne smeju razići

Uslovi korišćenja su **već jednom bili netačni** — obećavali su probnih 7 dana
dok je proizvod odlučio nešto drugo. Netačna izjava u dokumentu koji čitaju i
recenzent i regulator nije stilska greška.

Zato se broj u `legal.terms.price.body` **interpolira iz `FREE_DAILY_AI`**, a ne
prepisuje rukom, i test pada ako se tekst i konstanta raziđu.

⚠️ Konstanta je zbog toga u `@/lib/ai/limits`, a ne u `quota.ts`: `quota.ts`
poseže za `next/headers` i time je server-only, a stranica sa uslovima nema
razloga da bude vezana za server samo da bi izgovorila jedan broj.

---

## Šta čeka

1. **Paid Apps ugovor + banka/porezi** (App Store Connect) i **merchant nalog**
   (Play Console). **Najduži rok** — bez toga se ne može napraviti ni
   test-proizvod. Ide pre koda.
   ⚠️ Vlasnik naloga je **fizičko lice, ne firma**. Prodavnice to primaju, ali
   ime i adresa postaju **javno vidljivi** (EU trader status).
2. **RevenueCat + paywall.** Traži **novi binarni build** za obe prodavnice i
   **novi Apple review**. Ne može da počne dok tačka 1 ne prođe: plugin bez
   proizvoda u prodavnici nema šta da prikaže.
3. **Uključivanje limita** — jedna reč, u istom commitu sa paywall-om.
4. Apple gleda paywall strogo (3.1.2): „Restore purchases", cena pre kupovine,
   link na uslove.
