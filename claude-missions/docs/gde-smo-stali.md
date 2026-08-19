# Gde smo stali — 19.08.2026, 01:00

Drugo odbijanje od Apple-a (17.08.2026, submission
`4f3c776d-297d-4899-a184-265ccf27be15`, iPad Pro 11") po tačkama **4.8 Login
Services** i **1.4.1 Physical Harm**.

**Sav kod je gotov, komitovan i živ na produkciji.** Ostala su dva ručna koraka
pa se šalje na recenziju.

---

## ⏭️ Šta se radi kad se nastavi

### 1. Tapni „Preskoči" na telefonu — POPRAVLJENO 19.08., traži ponovnu proveru

Provereno na uređaju 19.08.: **dugme nije radilo.** „Sačuvaj i nastavi" pored
njega jeste (i propušta dalje sa praznim poljem — to je namerno, prazno polje je
isti odgovor kao „Preskoči"), ali sam „Preskoči" nije radio ništa. Ekran čiji je
jedini vidljiv izlaz mrtav je odbijanje po **5.1.1(v)**.

Uzrok se nije dao izmeriti sa strane: oba dugmeta su bila `<form>` sa Server
Action-om, POST-uju na isti URL i izvršavaju iste tri linije. Zato ispravka ne
pogađa uzrok nego ga uklanja — **„Preskoči" je sada običan link** na
`/telefon/preskoci` (route handler: postavi `fm_tel` cookie, redirect na
`/danas`). Nema hidracije, nema Server Action id-a koji mora da preživi deploy,
nema POST-a koji service worker preskače, nema 303 koji web view mora da isprati.
Izlaz iz ekrana sada visi o manje mehanike nego sam ekran.

Commit `6343359`, živo na produkciji, potvrđeno kroz pravi browser (demo nalog,
iPhone UA): link postoji i vodi na `/danas`. **Ostaje tap na uređaju** — ista
provera kao ranije, jer je uređaj jedini koji je ovo i uhvatio.

### 2. Osveži demo nalog — na dan slanja, u toku dana

```bash
node scripts/store/seed-demo-data.cjs
```

⚠️ **Ne noću.** Skripta namerno ne pravi obroke u budućnosti, pa puštena u 00:38
ostavlja današnji dan na 0 kcal. Gore od toga: podaci se pune do *dana kad je
puštena*, pa recenzent koji otvori app za dan-dva vidi prazne poslednje dane i
Početnu koja izgleda pokvareno. **Pusti je i još jednom dok recenzija traje.**

Provereno 19.08. u 00:55: demo nalog `supp5science+fitmess-demo@gmail.com` se
prijavljuje normalno, mejl potvrđen. Lozinka je u `docs/store-listing.md`.

### 3. App Store Connect

1. Zakači na verziju 1.0 build koji je testiran (poslednji u TestFlight-u —
   sadrži ispravku `allowNavigation`)
2. Pošalji tekst iz **`docs/odgovor-app-review.md`** kroz **App Review →
   Messages**
3. **Uz** resubmisiju, ne umesto nje

Ugovor (Apple Developer Program License Agreement) je potpisan 18.08. za tim
`CA5SN5H95V` — ne blokira slanje.

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

**Google prijava u ljusci.** Korisnik je 19.08. na uređaju prijavio da mu smeta
što u app-u postoji samo Sign in with Apple. Stanje nije previd nego odluka od
19.08. (vidi „Šta je naučeno", tačka 2). Vraćanje traži native posao —
`ASWebAuthenticationSession` / Custom Tabs kroz Capacitor plugin + deep link —
i svoj build. Nije za ovaj krug: Apple po 4.8 ne traži Google, a dugme koje se
u webview-u ponaša loše je gore od dugmeta kojeg nema.

**Grana `wip/local-partial-citati`** — nedovršen paralelni pokušaj istog posla
(drugi imenovani fajlovi, bez capacitor-a/middleware-a/telefona). Sačuvan da
ništa ne propadne; može se obrisati.
