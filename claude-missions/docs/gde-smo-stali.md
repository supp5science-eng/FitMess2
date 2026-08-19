# Gde smo stali — 19.08.2026, 21:50 · ✅ POSLATO NA RECENZIJU

Drugo odbijanje od Apple-a (17.08.2026, submission
`4f3c776d-297d-4899-a184-265ccf27be15`, iPad Pro 11") po tačkama **4.8 Login
Services** i **1.4.1 Physical Harm**.

**Sav kod je gotov, komitovan i živ na produkciji.** Ostala su dva ručna koraka
pa se šalje na recenziju.

---

## ⏭️ Šta se radi kad se nastavi

### 1. Provera na uređaju — TestFlight build **1.0 (6)** ✅ PROŠLO

Sve tri stvari potvrđene na uređaju 19.08.:

- **„Preskoči"** na `/telefon` radi (bio pokvaren; sad je link, ne Server Action)
- **Sign in with Apple** radi, u aplikaciji
- **„Nastavi sa Google"** radi, u aplikaciji, kroz sistemski list sa nalozima

Put do Google-a je opisan u `docs/prijava-sa-google.md`; dva mesta na kojima je
puklo i koja bi se ponovila pri svakoj sličnoj integraciji: Google-ov iOS SDK
**sam pravi nonce** kad mu ga ne daš (pa Supabase odbije token koji nema sa čim
da uporedi), i plugin **obnovi staru sesiju** umesto da traži novu ako mu ne
kažeš `forcePrompt: true` (pa od drugog tapa vrati token sa tuđim nonce-om).

### 2. Osveži demo nalog — na dan slanja, u toku dana ✅ URAĐENO 19.08. u 21:20

```bash
node scripts/store/seed-demo-data.cjs
```

⚠️ **Ne noću.** Skripta namerno ne pravi obroke u budućnosti, pa puštena u 00:38
ostavlja današnji dan na 0 kcal. Gore od toga: podaci se pune do *dana kad je
puštena*, pa recenzent koji otvori app za dan-dva vidi prazne poslednje dane i
Početnu koja izgleda pokvareno. **Pusti je i još jednom dok recenzija traje.**

Puštena 19.08. u 21:20: 35 dana, 135 obroka, današnji dan 2390 kcal. Lozinka je
u `docs/store-listing.md`. **Pusti je još jednom dok recenzija traje**, da
recenzent koji otvori app za dan-dva ne vidi prazne poslednje dane.

### 3. App Store Connect ✅ URAĐENO 19.08. u 21:50

Treća submisija je poslata. Status: **Waiting for Review**.

- Verzija 1.0, build **`1.0 (6)`** (Codemagic #9, commit `41f133d`)
- Odgovor recenzentu poslat kroz App Review → Messages (peta poruka u niti),
  sa linkom na snimak ekrana sa uređaja
- Submission ID ostaje `4f3c776d-297d-4899-a184-265ccf27be15`

⚠️ **Dok recenzija traje:** pusti `node scripts/store/seed-demo-data.cjs` još
jednom za dan-dva. Skripta puni podatke do dana kad je puštena, pa bi recenzent
inače video prazne poslednje dane.

---

## ✅ Šta je urađeno i provereno

| Tačka | Stanje |
|---|---|
| **4.8** Sign in with Apple | radi **u aplikaciji**, potvrđeno na uređaju; dugme prvo na `/prijava` i `/registracija` |
| **4.8** ista istaknutost | ista klasa `auth-btn` (`width:100%`, isti padding/radius/font); razlikuje se samo boja |
| **5.1.1(v)** telefon | opcion, `/telefon` ima „Preskoči", broj se briše iz Podešavanja |
| **1.4.1** citati | `/izvori`, `/en/sources`, alias `/sources`, u appu `/profil/izvori` — 15 izvora, javno, u sitemap-u |
| **2.1** ljuska | `allowNavigation` dokazan na uređaju |
| Pravne stranice | `/privatnost`, `/uslovi`, `/brisanje-naloga` — sve 200 sa desktopa |
| Demo nalog | osvežen, prijava radi |

Radno stablo čisto, sve puširano na `main`.

---

## 🔑 Podaci koji su trebali (ne ponavljati traženje)

| Šta | Vrednost |
|---|---|
| Team ID | `CA5SN5H95V` |
| Sign in with Apple Key ID | `BYNBW6DMAL` (`C:\FitMess2\AuthKey_BYNBW6DMAL.p8`) |
| Services ID (Client ID) | `app.fitmess.web` |
| Supabase Client IDs polje | `app.fitmess.web,app.fitmess` |
| Codemagic appId | `6a7e2809f248596b960795ac`, workflow `ios-testflight` |
| Codemagic token | `~/.secrets/codemagic-token.txt` |

⏰ **Apple client secret ističe 17.02.2027.** Podsetnik u kalendar za
**18.01.2027**. Kad istekne, prijava umire **bez ijedne greške u logu**, i app
tog dana prestaje da ispunjava 4.8. Obnavljanje:

```bash
node scripts/apple-client-jwt.cjs --team-id CA5SN5H95V --key-id BYNBW6DMAL \
  --client-id app.fitmess.web --p8 C:/FitMess2/AuthKey_BYNBW6DMAL.p8
```

---

## ⚠️ Četiri stvari naučene na teži način

**1. Prijava je išla u Safari iako je `allowNavigation` postojao.** Lista je
imala `appleid.apple.com` i `accounts.google.com`, ali ne i Supabase host. App
nikad ne ide pravo na providera: `signInWithOAuth` šalje webview na
`femrzpfslejzqnvfsfoe.supabase.co/auth/v1/authorize`, koji tek onda 302-uje
dalje — pa je Capacitor otkazao navigaciju na **prvom** koraku. Taj host se
prelazi i drugi put, kad provider vraća odgovor. Koštalo je jednog builda.

**2. Google u ljusci ne radi, i to se ne vidi spolja.** Mereno je sa četiri UA-a
(iPhone Safari, + `FitMessApp/1.0`, Android Chrome, Android WebView sa `; wv)`)
— sva četiri dobiju običnu stranicu za prijavu. Ali tapnut u TestFlight buildu,
Google ne nudi sačuvane naloge i traži dodatnu verifikaciju. **Politiku
sprovodi unutar toka, ne odbijanjem prvog zahteva. `curl` to ne može da
dokaže — samo uređaj.** Dugme je zato van ljuske; na vebu su sva tri.

**3. `.gitignore` ima pravilo `*secret*`.** Skripta `apple-client-secret.cjs` je
bila napisana i **tiho progutana** — uputstvo je mesecima pokazivalo na fajl
koji ne postoji. Zove se `apple-client-jwt.cjs`.

**4. Poništeni provisioning profil se sam popravio.** Čekiranje „Sign In with
Apple" menja App ID i poništava profil, ali Codemagic je na automatskom
potpisivanju (`distribution_type: app_store`) i regenerisao ga je sam — build je
prošao iz prve, *Fetch profiles* nije trebao.

---

## 📌 Ostalo otvoreno (namerno, nije za ovaj krug)

**Google prijava unutar aplikacije.** Pravo rešenje je
`ASWebAuthenticationSession` (iOS) / Custom Tabs (Android) kroz Capacitor plugin
i deep link nazad — to su sistemske površine, ne ugrađeni webview, pa ih Google
prihvata. Native posao sa svojim buildom. `capacitor.config.ts` već pušta
Google-ove hostove, pa se dugme vraća samo izmenom na vebu kad plugin stigne.

**Hidraciona greška na `/danas`.** Svako *tvrdo* učitavanje `/danas` (cold start
ljuske, reload, dolazak preko linka) baca React #418 (server HTML != klijent) i
odmah za njim `TypeError: Cannot read properties of null (reading 'parentNode')`.
Ne javlja se pri mekoj navigaciji unutar app-a, pa se lako previdi. Postojalo je
i pre „Preskoči" ispravke — mereno na čistom učitavanju bez ijednog tapa.
Ne blokira slanje (ekran se iscrta), ali je prava rupa i traži svoj krug.

**Google prijava u ljusci — URAĐENO 19.08.**, na korisnikov izričit zahtev, i
zbog toga se slanje čekalo da bi otišao jedan build umesto dva. Ljuska više ne
šalje web view na Google nego otvara sistemski izbor naloga
(`@capgo/capacitor-social-login`) i predaje ID token Supabase-u. Android namerno
čeka svoje Google Cloud upise. Ceo postupak: `docs/prijava-sa-google.md`.

**Grana `wip/local-partial-citati`** — nedovršen paralelni pokušaj istog posla
(drugi imenovani fajlovi, bez capacitor-a/middleware-a/telefona). Sačuvan da
ništa ne propadne; može se obrisati.
