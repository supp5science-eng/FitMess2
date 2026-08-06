# Izlazak u App Store i Google Play

Plan i odluke dogovorene 2026-08-06. Rad **još nije počeo** — čeka se da se
završi sitni polishing aplikacije.

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
- Dozvole: kamera **i mikrofon** (Prizma snima audio, lako se zaboravi)
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

## 7. Kalendar

| Kada | Šta |
|---|---|
| Nedelja 1 | ljuska + push + papirologija; Play nalog i zatvoreno testiranje kreću odmah |
| Nedelja 2 | App Store submisija, review 1-3 dana |
| Nedelja 3 | Play produkcija kad istekne 14 dana |

~3 nedelje do oba store-a, od čega je nedelja i po čisto čekanje.

---

## 8. Šta treba od korisnika

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
