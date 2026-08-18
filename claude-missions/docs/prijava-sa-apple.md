# Prijava sa Apple nalogom — šta treba uraditi rukom

Nastalo iz **drugog odbijanja, 17.08.2026** (submission
`4f3c776d-297d-4899-a184-265ccf27be15`), tačka **Guideline 4.8 — Design: Login
Services**.

Kod je gotov i u repou. Ovo je jedini deo koji se ne može uraditi iz koda:
Apple ne izlaže Services ID-jeve ni Sign in with Apple ključeve kroz App Store
Connect API, pa se prave u pretraživaču. Traje ~20 minuta, radi se jednom.

---

## 0. Zašto uopšte

Guideline 4.8 kaže: čim app nudi **bilo koji** third-party login servis, mora
ponuditi i ravnopravnu alternativu koja skuplja samo ime i mejl, dozvoljava
korisniku da sakrije mejl, i ne skuplja interakcije za reklame bez pristanka.

FitMess nudi „Nastavi sa Google". Registracija mejlom i lozinkom **ne računa
se** kao odgovor — Apple traži *login service*, ne sopstveni nalog. Zato je i
prvo objašnjenje („pa imamo registraciju mejlom") uzaludno; jedini praktičan
odgovor je Sign in with Apple.

> **Nemoj rešavati izbacivanjem Google dugmeta sa sajta.** Time 4.8 prestaje da
> važi, ali svi koji su nalog napravili Google nalogom ostaju zaključani. Google
> dugme ostaje na vebu; u ljusci se ne prikazuje jer
> tamo ne radi — vidi `src/app/(auth)/social-sign-in.tsx`.

---

## 1. developer.apple.com — App ID

**Certificates, Identifiers & Profiles → Identifiers → App IDs → `app.fitmess`**

1. U listi Capabilities čekiraj **Sign In with Apple**.
2. Klikni **Configure** pored njega → **Enable as primary App ID** → Save.
3. Gore desno **Save**. Potvrdi upozorenje o izmeni App ID-ja.

> ⚠️ **Izmena App ID-ja poništava postojeći provisioning profil.** Posle ovog
> koraka build pada na potpisivanju dok se profil ne osveži — vidi tačku 6.
> Ovo je tačno ona vrsta greške koja je već jednom oborila build za 0,8 sekundi
> bez ijednog koraka (`docs/izlazak-u-store.md`, „Potpisivanje ima TRI karike").

## 2. developer.apple.com — Services ID (to je `client_id` za web tok)

**Identifiers → `+` → Services IDs → Continue**

| Polje | Vrednost |
|---|---|
| Description | `FitMess Web` |
| Identifier | `app.fitmess.web` |

Identifikator **mora biti različit** od bundle ID-ja `app.fitmess`. Register.

Zatim otvori taj isti Services ID iz liste:

1. Čekiraj **Sign In with Apple** → **Configure**.
2. **Primary App ID:** `app.fitmess`.
3. **Domains and Subdomains:** `<project-ref>.supabase.co` — domen callback-a,
   **bez** `https://` i bez putanje. Dodaj i `fitmess.app` u istom polju.
4. **Return URLs:** `https://<project-ref>.supabase.co/auth/v1/callback` — ovaj
   **sa** `https://`.
5. Next → Done → Continue → Save.

> `<project-ref>` je poddomen Supabase projekta, isti onaj iz
> `NEXT_PUBLIC_SUPABASE_URL`.

> Najčešća greška ovde: upisan `https://fitmess.app/auth/callback` kao Return
> URL. Apple ne zna za našu rutu — kod exchange radi Supabase, pa Apple mora da
> se vrati Supabase-u. Naš `/auth/callback` je sledeći korak u lancu i već radi
> (isti handler koji Google koristi, `src/app/auth/callback/route.ts`).

## 3. developer.apple.com — ključ za potpisivanje

**Keys → `+`**

1. Key Name: `FitMess Sign in with Apple`.
2. Čekiraj **Sign in with Apple** → **Configure** → Primary App ID
   `app.fitmess` → Save.
3. Continue → Register → **Download**.

⚠️ **`.p8` se preuzima samo jednom.** Snimi ga kao
`~/.secrets/AuthKey_<KEYID>.p8`, isto mesto gde već stoje Codemagic token i
upload keystore. Zapiši i **Key ID** (na istoj stranici) i **Team ID** (gore
desno u portalu).

## 4. Supabase — uključivanje providera

**Dashboard → Authentication → Providers → Apple → Enable**

- **Client IDs:** `app.fitmess.web`
  Dodaj i `app.fitmess` (odvojeno zarezom). Danas se ne koristi, ali je to
  `aud` koji bi stigao ako se jednom doda pravi native Sign in with Apple
  dijalog — a tada je ovo jedina izmena koja bi falila.
- **Secret Key (for OAuth):** panel traži **jedan gotov „Secret Key“** — JWT
  koji potpisujemo sami `.p8` ključem (provereno u Supabase dokumentaciji,
  18.08.2026). Nije lozinka koju Apple izdaje — Sign in with Apple nema
  dugotrajnu deljenu tajnu:

    ```bash
    node scripts/apple-client-jwt.cjs \
      --team-id   <TEAM_ID> \
      --key-id    <KEY_ID> \
      --client-id app.fitmess.web \
      --p8        ~/.secrets/AuthKey_<KEYID>.p8
    ```

    Skripta ispiše token i, na `stderr`, datum isteka.

    > ⚠️ Skripta se zove `apple-client-jwt.cjs`, a ne `...-secret...`, zato što
    > `.gitignore` ima pravilo `*secret*`. Prvi put je napisana pod imenom sa
    > „secret“ i git ju je **tiho ignorisao** — uputstvo je upućivalo na fajl
    > koji u repou nije postojao. Pravilo je korisno; ime se sklonilo.

> ⏰ **Apple ograničava taj JWT na ~6 meseci.** Kad istekne, Sign in with Apple
> prestane da radi — bez greške u našem logu, bez deploya, na dan kad niko
> ništa nije menjao. To je istovremeno i dan kad app prestaje da ispunjava 4.8.
> **Stavi podsetnik u kalendar mesec dana pre datuma koji skripta ispiše.**

Još u Supabase-u, **Authentication → URL Configuration**: `https://fitmess.app/**`
mora biti u *Redirect URLs* listi. Već jeste (Google ga koristi) — proveri, ne
pretpostavljaj.

## 5. Provera na vebu (pre svakog builda)

1. Otvori `https://fitmess.app/prijava` u pretraživaču na telefonu.
2. Dugme **„Nastavi sa Apple nalogom"** stoji **iznad** Google dugmeta.
3. Tap → Apple-ov ekran → izaberi **Hide My Email**.
4. Vraćaš se u app ulogovan/a. U Supabase-u (Authentication → Users) novi
   korisnik ima adresu `…@privaterelay.appleid.com` — **to je ispravno**, ne
   greška.
5. Pojavi se ekran „Broj telefona?" sa **„Preskoči"**. Preskoči ga. Moraš proći
   dalje bez broja — ako te bilo šta zaustavi, to je odbijanje po 5.1.1(v)
   (vidi `src/lib/auth/phone-prompt.ts`).

Ako dugme vrati tihu srpsku grešku umesto Apple ekrana, provider u Supabase-u
nije uključen ili je secret pogrešan — app namerno nikad ne pokazuje sirov
tekst greške (`src/lib/auth/errors.ts`).

## 6. Novi iOS build

Web deo (dugme, izvori, opcioni telefon) stiže do svih telefona **običnim
`git push`-om** — sadržaj store aplikacije jeste `fitmess.app`. Novi binarni
paket treba samo zbog jedne izmene:

`capacitor.config.ts` je dobio `server.allowNavigation: ["appleid.apple.com", …]`.
Bez toga Capacitor otkaže navigaciju ka Apple-u i preda je **sistemskom
Safari-ju** — korisnik se uloguje u Safari-ju, a app ostane na login ekranu.
Recenzent to nađe na prvi tap (guideline 2.1).

Redom:

1. **Osveži provisioning profil** — App ID je izmenjen u tački 1:
   - Codemagic → Settings → Code signing identities → iOS provisioning profiles
     → **Fetch profiles**.
   - Ako profil ne dođe, napravi novi (`POST /v1/profiles`, `IOS_APP_STORE`,
     veze na bundleId + certificate) pa opet Fetch. Postupak i zamke su u
     `docs/izlazak-u-store.md`.
2. **Pokreni build** (verzija 1.0, build **4**):
   ```
   POST https://api.codemagic.io/builds     (header x-auth-token)
   { "appId": "6a7e2809f248596b960795ac",
     "workflowId": "ios-testflight",
     "branch": "main" }
   ```
3. Kad build stigne u TestFlight, instaliraj ga na telefon i **ponovi tačku 5
   unutar aplikacije**, ne u pretraživaču. Ovo je jedina provera koja stvarno
   dokazuje `allowNavigation`: Apple ekran mora da se otvori **u aplikaciji**,
   bez prelaska u Safari.

## 7. Šta reći recenzentu

Nacrt odgovora na engleskom je u `docs/odgovor-app-review.md`. Pošalji ga kao
poruku uz resubmisiju, ne umesto nje.

I: **pusti demo nalog ponovo** (`node scripts/store/seed-demo-data.cjs`)
neposredno pred slanje i jednom tokom recenzije — nalog se prazni po kalendaru,
a recenzent koji otvori praznu Početnu ne može da razlikuje „ništa nije uneto"
od „pokvareno".

---

## Ostalo otvoreno (namerno, nije za ovu submisiju)

**Google login u ljusci — provereno, ne radi.** Priča ima tri koraka i vredi je
pamtiti, jer očigledna provera daje pogrešan odgovor:

1. Prvo je dugme bilo sakriveno, uz obrazloženje da Google odbija OAuth iz
   ugrađenog webview-a (`disallowed_useragent`) — napisano po sećanju.
2. 18.08.2026. je mereno spolja: authorize URL zatražen sa četiri UA-a (iPhone
   Safari, iPhone Safari + `FitMessApp/1.0`, Android Chrome, Android WebView sa
   `; wv)`) — sva četiri su dobila običnu stranicu `Sign in - Google Accounts`.
   Ništa nije blokirano, pa je dugme vraćeno.
3. 19.08.2026. je tapnuto u TestFlight buildu: Google ne nudi sačuvane naloge i
   umesto prijave traži dodatnu verifikaciju.

⚠️ Pouka: **Google politiku ne sprovodi odbijanjem prvog zahteva**, nego unutar
toka. `curl` to ne može da vidi — samo pravi uređaj. Dugme je zato ponovo van
ljuske; na vebu su sva tri.

Pravo, trajno rešenje ostaje `ASWebAuthenticationSession` (iOS) / Custom Tabs
(Android) kroz Capacitor plugin i deep link nazad u app — native posao sa
svojim buildom, nezavisan od ovog kruga.
