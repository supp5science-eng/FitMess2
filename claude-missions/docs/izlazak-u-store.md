# Izlazak u App Store i Google Play

Plan i odluke dogovorene 2026-08-06. **Rad je počeo 2026-08-09.**

---

## 0. Stanje na 2026-08-09

Odrađeno i na produkciji (tri commita na `main`):

- **Native potpis `FitMessApp/1.0`** (`src/lib/device/native.ts`) kao jedan
  izvor istine. `capacitor.config.ts` ga UVOZI, ne prekucava.
- **Phone gate propušta ljusku** (zamka 4.1). Odluka izvučena iz middleware-a
  u čistu `decidePhoneGate` (`src/lib/device/phone-gate.ts`) i pokrivena
  testom sa pravim iPad UA nizom.
- **Nema PWA install poruka u ljusci** (tačka 3.1). `pushEnvironment()` dobio
  stanje `native` umesto lažnog `needs-install`; `push-nudge` više ne upisuje
  `needs_install` u levak za store korisnike.
- **Capacitor 8.5.0 ljuska**: iOS i Android projekat, `server.url` na
  fitmess.app, dozvole kamera + mikrofon, Android back dugme vrti istoriju,
  portret zaključan.

Dodato 2026-08-09 (pravne stranice):

- **Tri javna dokumenta**: `/privatnost`, `/uslovi`, `/brisanje-naloga` —
  pun tekst, srpski i engleski, izuzeti i iz phone gate-a i iz auth gate-a
  (`src/lib/legal/paths.ts`), u `robots.txt` i `sitemap.xml`.
- Isti tekst se prikazuje i u aplikaciji (`/profil/privatnost`, `/profil/uslovi`)
  iz **iste komponente** — dve verzije politike privatnosti su način da app
  obeća jedno korisniku a drugo recenzentu.
- Identitet rukovaoca (ime, adresa, kontakt) živi na jednom mestu:
  `src/lib/legal/controller.ts`. Podrška više ne pokazuje na
  `podrska@fitmess.app` — ta adresa je bila samo Resend identitet za SLANJE i
  ništa joj nije stizalo.
- **Pristanak na registraciji** (`consentSchema`): podaci o telu i ishrani su
  posebna vrsta podataka (GDPR čl. 9), a za njih je jedini osnov *izričit*
  pristanak — što znači svesna radnja, ne „nastavljanjem prihvataš". Kutijica
  je obavezna, neoznačena, i proverava se i na serveru.
- Pravni linkovi u futeru landinga (jedino javno mesto do kog dolazi neko ko
  nema nalog).
- **Zatečena zamka:** phone gate je 307-ovao svakog sa desktopa, pa bi
  recenzent koji na laptopu otvori link politike video „otvori na telefonu".
  Ista greška koja je nekad držala `robots.txt` van Google-a.

Ostaje od korisnika za pravni deo: **puna poštanska adresa** (ulica je poznata,
fali grad i poštanski broj) — ali samo za „trader" formulare u App Store
Connect-u i Play Console-u, ne za tekst politike.

Ispravke plana nađene u kodu:

- Push migracija je **0030**, ne 0021 — lokalne migracije su otišle do 0029.
- ~~**Privatnost i uslovi su iza logina** (`(app)/profil/*`) i pišu „u pripremi".
  Oba store-a traže javan URL politike privatnosti koji recenzent otvara na
  desktopu. To u tački 4.2 nije bilo zapisano, a blokira obe submisije.~~
  Rešeno 2026-08-09 — vidi gore.
- Na razvojnoj mašini **nema JDK ni Android SDK-a** — build ide ili preko
  Codemagic-a ili uz lokalnu instalaciju alata.

Ostaje: ikonica i splash (sad Capacitor podrazumevani), preuzimanje fajlova,
offline ekran, native push, javne pravne stranice, papirologija.

Pregledna verzija ovog stanja:
https://claude.ai/code/artifact/c553cc3c-cc5f-4ac4-8f28-8260df1abd40

---

## 1. Odluka: Capacitor u "remote" režimu

FitMess ide u prodavnice kao **Capacitor** aplikacija koja u native ljusci
(WKWebView na iPhone-u, WebView na Androidu) učitava `https://fitmess.app`.

**Zašto baš tako, a ne "pravi" bundlovan app:**

Capacitor normalno spakuje web fajlove *unutar* aplikacije, pa app starta
trenutno i offline. FitMess to ne može jer je Next.js sa server renderingom —
stranice se sklapaju na serveru pri svakom otvaranju (middleware, auth, server
akcije). Nema statičkog paketa koji bi se spakovao.

**Zašto se ne prepisuje u klijentsku aplikaciju** (izmereno 2026-08-06):

| Šta je vezano za server | Koliko |
|---|---|
| stranica koje se renderuju na serveru | 46 |
| fajlova sa server akcijama | 26 |
| fajlova koji diraju `next/headers` / Supabase server klijenta | 60 |
| ukupno `.ts`/`.tsx` u `src/` | 605 |

Nekoliko nedelja rada na završenoj aplikaciji, sa realnim rizikom regresija.
Dobitak bi bio: trenutni start umesto ~sekund, i mogućnost offline unosa.

Odluka: **ne sada.** Nije slepa ulica — ako offline unos jednom postane stvarna
žalba korisnika, prepiše se frontend, a Capacitor ljuska i store nalozi ostaju
isti.

### Šta korisnik oseti

Neće primetiti: ikonicu, splash, odsustvo browser trake, kameru, notifikacije,
haptiku, brzinu skrolovanja. Isto kao bilo koji native tracker.

Primetiće dve stvari:
- **Start je nešto sporiji** — čeka mrežu za prvi ekran. Ublažava se native
  splash ekranom i time što `public/sw.js` već kešira JS/CSS.
- **Offline ne radi.** Ali to je već tako i u današnjem PWA-u — nije korak
  unazad.

---

## 2. Troškovi

| Stavka | Cena |
|---|---|
| Google Play Console | $25 jednokratno (~3.000 din) |
| Apple Developer Program | $99 godišnje (~12.000 din) |
| Build mašina | 0 din |

**Mac nije potreban.** Apple dozvoljava potpisivanje samo sa macOS-a, ali
**Codemagic** ima besplatan nivo od 500 minuta mesečno na macOS mašinama, a
potpisivanje ide automatski preko App Store Connect API ključa. Mac mini je
razmatran i **odbačen** — 130k din je previše za ono što donosi.

(Za budućnost: polovan M1 Mac mini je oko 50-60k. Ubrzao bi svakodnevni rad
2-3× jer su Node/TypeScript/Next.js poslovi jednojezgarni, a video enkodiranje
5-10× zbog hardverskog enkodera. Ali za izlazak u store nije potreban.)

---

## 3. Posao — šta treba uraditi

### 3.1 Ljuska (~2-3 dana)

- Capacitor instalacija, `server.url` na `fitmess.app`
- **Custom User-Agent potpis** (`FitMessApp/1.0`) — server tako zna da je native
- Native režim u app-u: sakriti install nudge, "dodaj na početni ekran" poruke,
  PWA overlay-e — u instaliranom app-u nemaju smisla
- Dozvole: kamera **i mikrofon** (Prizma snima audio, lako se zaboravi). Ovo
  je samo deklaracija — `NSCameraUsageDescription` i
  `NSMicrophoneUsageDescription` u Info.plist, dva reda u Android manifestu.
  Bez njih iOS ni ne prikaže dijalog za dozvolu; sa njima radi.
  `camera-capture.tsx` se ne dira — `getUserMedia` radi u WKWebView-u od iOS
  14.3, pa Slikaj obrok, Prizma i Gric rade nepromenjeni
- Android hardversko back dugme da vrti istoriju umesto da izbacuje iz app-a
  (veže se na pravilo "nema izlaza")
- Splash ekran, status bar, provera `safe-area-inset` (već se koristi na 10+
  mesta)
- Native haptika umesto iOS switch trika — ovo je **poboljšanje**, ne zamena
- Offline ekran umesto sirove webview greške

### 3.2 Push (~2-3 dana)

Web Push ne postoji ni u WKWebView-u ni u Android WebView-u. `pushEnvironment()`
u `src/lib/push/client.ts` bi vratio `needs-install`, pa bi korisniku *unutar
instalirane aplikacije* pisalo "instaliraj na početni ekran".

Menja se **kanal isporuke, ne funkcija.** Logika kada i šta se šalje
(`src/lib/push/due.ts`, jutarnji/večernji pregled, nagrada za 3 obroka) ostaje
netaknuta.

- `@capacitor/push-notifications`
- Nova migracija: native tokeni pored postojećih endpointa u
  `push_subscriptions` (migracija 0021)
- Grana u `src/lib/push/send.ts`: web-push / FCM (Android) / APNs (iOS)
- Tap na notifikaciju otvara pravi ekran

### 3.3 Papirologija (~1-2 dana)

- Screenshotovi (Playwright postavka već postoji), ikona 1024×1024, opisi
- **Demo nalog za recenzente** — bez toga oba store-a odbijaju odmah
- Apple privacy upitnik + Play Data Safety: zdravstveni podaci, AI obrada
  fotografija
- Content rating, trader status za EU (ime i adresa postaju **javno vidljivi**)

---

## 4. Zamke nađene u kodu

### 4.1 Desktop gate može da obori Apple review

Apple ponekad testira iPhone aplikacije na iPadu. `src/lib/device/is-mobile.ts`
propušta samo telefone — iPad dobija `/samo-za-telefon` ekran. Recenzent vidi
zid umesto app-a i odbija.

**Rešenje:** `is-mobile.ts` uvek propušta native UA potpis.

### 4.2 Play traži javni link za brisanje naloga

`/api/account/delete` postoji i pokriva Apple (pravilo 5.1.1(v)). Ali Play
zahteva i **web stranicu dostupnu bez instaliranja aplikacije**. Tvoja je iza
logina → treba nova javna stranica na `fitmess.app`.

### 4.3 Preuzimanja fajlova u webview-u

WKWebView po pravilu ne preuzima fajlove kao browser. Pogođeno:
- `src/app/api/export/route.ts` (izvoz podataka, "Moji podaci")
- `src/app/api/export/pdf/route.ts` (PDF plana)
- `src/components/settings/export-download-button.tsx`

Treba native rukovanje preuzimanjem. **Proveriti pre submisije.**

### 4.4 Za proveru (nije potvrđen problem)

- `navigator.share` za share kartice — radi u WKWebView-u uz korisnički gest,
  ali testirati
- Barcode skener — koristi `barcode-detector` polyfill, trebalo bi da je u redu
- Supabase auth kolačići u WKWebView-u kroz restart app-a; paziti na rotaciju
  refresh tokena (AccountsSync)
- Neulogovan korisnik u native app-u ne treba da vidi marketing landing sa
  "instaliraj" pozivom

---

## 5. Apple pravilo 4.2 ("minimum functionality")

Apple odbija aplikacije koje ne nude ništa više od onoga što bi korisnik dobio
otvaranjem sajta u Safariju. Pošto i FitMess učitava sajt, recenzent može da ga
svrsta u tu fioku.

Odbrana je ceo spisak native stvari iz tačke 3.1 — pre svega **push**, jer sajt
ne može da pošalje notifikaciju na zaključan iPhone.

Rizik nije nula. Ako odbiju, odgovara se u Resolution Center-u nabrajanjem
native funkcija; najčešće se reši objašnjenjem, bez menjanja koda. Računati na
mogućih par dana kašnjenja.

---

## 6. Google Play — zatvoreno testiranje

Google od kraja 2023. traži od **novih ličnih** developer naloga da pre
produkcije odrade zatvoreni test: **12 ljudi instalira app i drži ga 14 dana
zaredom.** Testeri samo prihvate poziv na email i instaliraju — ništa više.

**Dva izuzetka — proveriti pre nego što se skupljaju ljudi:**
- nalog napravljen **pre novembra 2023.** → ne važi
- nalog registrovan kao **firma**, ne kao fizičko lice → ne važi

U Play Console-u na početnoj stranici piše da li se zahtev odnosi na tebe.

---

## 7. Dev petlja posle izlaska

Ovo je najveća dobit remote režima: **sadržaj app-a je sajt**, pa se
svakodnevni rad ne menja nimalo.

- `npm run dev` radi kao i do sada; testiranje kroz desktop gate ide sa iPhone
  UA u Chrome-u, kao i sada
- Popravka ide `git push` → Vercel → **aplikacija u prodavnici odmah ima
  ispravku.** Bez nove submisije, bez review-a, bez ažuriranja kod korisnika
- Native ljuska se ponovo šalje samo kad se menja nešto native — plugin,
  ikonica, splash, dozvole. Par puta godišnje

### Testiranje na pravom iPhone-u

Zamka: `getUserMedia` traži HTTPS. Preko `http://192.168.x.x:3000` na Wi-Fi-ju
browser blokira kameru. Dva rešenja:

- **Vercel preview** — push grane daje HTTPS link koji se otvori na telefonu.
  Bez podešavanja, malo sporija petlja.
- **Cloudflare tunnel** — besplatan, obmota lokalni dev server u pravi HTTPS.
  Hot reload i kamera rade uživo na telefonu.

### Hvatanje grešaka

- **Android:** `chrome://inspect` sa Windows PC-a daje pun DevTools nad
  webview-om
- **iOS:** Safari Web Inspector traži Mac. Bez njega: `inspect.dev` (~50€/god,
  radi na Windowsu). U praksi retko treba — sadržaj je isti web koji se vrti u
  Chrome-u, pa se skoro svaki bug reprodukuje u Chrome emulaciji; iOS
  inspekcija treba samo za webview-specifične stvari

---

## 8. Kalendar

| Kada | Šta |
|---|---|
| Nedelja 1 | ljuska + push + papirologija; Play nalog i zatvoreno testiranje kreću odmah |
| Nedelja 2 | App Store submisija, review 1-3 dana |
| Nedelja 3 | Play produkcija kad istekne 14 dana |

~3 nedelje do oba store-a, od čega je nedelja i po čisto čekanje.

---

## 9. Šta treba od korisnika

Stanje na 2026-08-06: iPhone ✅, Apple nalog ✅, Play nalog ✅, spreman na
trošak ✅.

Ostaje:

1. **Provera Play Console-a** — da li se traži zatvoreno testiranje (tačka 6)
2. **Firebase** (za Android push): napraviti projekat, dodati Android app,
   skinuti `google-services.json`. ~10 min.
3. **Apple APNs ključ** (za iPhone push): developer.apple.com → Keys → novi APNs
   ključ, skinuti `.p8` i zapisati Key ID i Team ID. ~5 min.
4. **12 testera** za Play, ako se ispostavi da je obavezno

Sve ostalo je kod i radi se ovde.
