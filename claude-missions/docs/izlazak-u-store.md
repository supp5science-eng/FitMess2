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

Dodato 2026-08-10 (native push, tačka 3.2):

- **Kanal je zamenjen, funkcija nije.** `due.ts` i dalje odlučuje ko dobija
  podsetnik i kada; `sendToSubscription` je jedino mesto gde se tri transporta
  sreću (Web Push / APNs / FCM).
- `@capacitor/push-notifications@8.1.2`, dosegnut preko `capacitor-bridge.ts`
  — bez ijednog `import`-a iz plugin paketa, pa web bundle ostaje netaknut.
- `src/lib/push/native.ts`: dozvola → registracija → token → ista
  `/api/podsetnici/pretplata` ruta, koja sad prima dva oblika tela.
- Tap na notifikaciju otvara ekran o kome je podsetnik
  (`components/native/push-tap-listener.tsx`, u ljusci; na vebu to radi
  servisni radnik).
- 23 nova testa nad lažnim Capacitor mostom.

**Četiri tihe rupe nađene i zatvorene** — sve četiri bi otkazale bez ijedne
greške u logu:

1. **`ON CONFLICT (device_token)` nije mogao da pogodi parcijalni indeks** iz
   0030 (`42P10`), pa bi svaka registracija telefona vraćala 500. Obrazloženje
   za parcijalni indeks je bilo pogrešno — Postgres tretira NULL-ove kao
   različite, pa običan unique indeks dozvoljava koliko god web redova.
   Migracija **0031**, primenjena i verifikovana na živoj bazi.
2. **iOS `AppDelegate` nije prosleđivao APNs token** — bez ta dva callback-a
   `register()` ćuti zauvek, a korisnik dobije poruku o internetu.
3. **Android manifest nije imao `POST_NOTIFICATIONS`** (plugin ga ne donosi).
   Na Androidu 13+ dijalog se ne pojavi, a korisniku piše da je *on* blokirao
   notifikacije.
4. **`aps-environment` entitlement nije postojao** — potpisivanje bi palo.
   `App.entitlements` + `CODE_SIGN_ENTITLEMENTS` u obe konfiguracije.

Push podaci su svi na mestu od 13.08.2026 — vidi blok ispod.

---

## Dodato 13–14.08.2026: build lanac radi, aplikacija je u TestFlight-u

**Prvi iOS build je napravljen, potpisan i prihvaćen od Apple-a.** Build 1 stoji
u TestFlight-u (`processingState: VALID`), instaliran je na telefon vlasnika i
otvara se normalno.

### Kako se od sada pravi build

`codemagic.yaml` je u **korenu repoa** (Codemagic ga traži samo tamo) i nosi
`working_directory: claude-missions`. Build se pokreće API pozivom, bez
Codemagic UI-ja:

```
POST https://api.codemagic.io/builds     (header x-auth-token)
{ "appId": "6a7e2809f248596b960795ac",
  "workflowId": "ios-testflight",
  "branch": "main" }
```

Token je u `~/.secrets/codemagic-token.txt`. Status: `GET /builds/{id}`.

Nema `triggering:` bloka namerno — sadržaj store aplikacije JESTE fitmess.app,
pa običan `git push` već stiže do svakog instaliranog telefona. Novi binarni
paket treba samo kad se menja nešto native, a besplatnih macOS minuta je 500
mesečno.

### Četiri stvari koje su obarale build, sve nevidljive sa Windowsa

1. **`Package.swift` je imao Windows putanje** (`..\..\..\node_modules\...`).
   Capacitor CLI piše razdvajače po OS-u koji ga pokrene, a Swift čita `\n` iz
   `\node_modules` kao novi red. `cap sync` na Mac-u ga prepiše ispravno.
2. **Nije postojala deljena Xcode šema.** Xcode ih izmišlja kad čovek prvi put
   otvori projekat i drži u `xcuserdata/` (gitignore). CI projekat nikad ne
   otvara → `xcodebuild -scheme App` ne nalazi ništa. Šema je sad komitovana.
3. **`npx cap sync ios` u CI-ju nije prazan hod** iako je app remote: on piše
   `ios/App/App/capacitor.config.json`, koji je gitignore-ovan a nosi
   `server.url` i `FitMessApp/1.0`. Bez njega ljuska nema sajt da učita.
4. **`ITSAppUsesNonExemptEncryption=false`** u `Info.plist` — bez toga svaki
   build stoji u TestFlight-u kao „Missing Compliance" i ne može se dati
   testeru, i tako za svaki naredni build.

Broj builda se upisuje `sed`-om nad pbxproj-om, ne `agvtool`-om: Capacitor
šablon nema `VERSIONING_SYSTEM = apple-generic`.

### ⚠️ Potpisivanje ima TRI karike, ne jednu

Codemagic potpisuje **iz svoje zalihe**, ne gleda Apple uživo. Build koji padne
za 0.8 sekundi bez ijednog koraka (`buildActions: []`) je odbijen pre nego što
se mašina i upalila. Redom:

1. **Sertifikat se pravi u Codemagic UI** (Settings → Code signing identities →
   iOS certificates). Ne može drugačije — Apple vraća samo javni deo, pa
   sertifikat skinut sa njihovog sajta ne može ništa da potpiše; privatni ključ
   mora ostati tamo gde je nastao.
2. **Profil ne nastaje sam.** Napravljen je API-jem: `POST /v1/profiles`,
   `IOS_APP_STORE`, veze na bundleId + certificate.
3. **Profil se onda povlači u Codemagic** (iOS provisioning profiles → Fetch
   profiles). Bez ovog koraka postoji kod Apple-a a build i dalje pada istom
   porukom.

Stanje kod Apple-a se proverava bez klikanja: JWT (ES256, `aud:
appstoreconnect-v1`) iz `.p8`, pa `GET /v1/certificates` i `/v1/profiles`.

### App Store listing

Popunjeno kroz API (verzija 1.0, slot **hr** — Apple nema srpski, hrvatski je
najbliži, a beleška recenzentu je posebno na engleskom):

| Popunjeno | Vrednost |
|---|---|
| Subtitle | Alat ka boljem životu |
| Description / keywords / promo | iz `docs/store-listing.md` (1893 zn. / 98 od 100 / 142) |
| Kategorije | Health & Fitness + Food & Drink |
| Privacy / Support / Marketing URL | fitmess.app/privatnost, fitmess.app |
| Copyright | 2026 Marko Bera (odluka: **fizičko lice**) |
| Uzrasna ocena | **4+** |
| Screenshotovi | iPhone 6.9" (`APP_IPHONE_67`) + iPad 13" (`APP_IPAD_PRO_3GEN_129`), po 6 |
| App Review kontakt | Marko Bera, +381600637486, supp5science@gmail.com |
| Demo nalog za recenzenta | `supp5science+fitmess-demo@gmail.com` + beleška na engleskom |

Uzrasna ocena je iskrena deklaracija: `healthOrWellnessTopics: true`,
`medicalOrTreatmentInformation: NONE` (app ne opisuje bolesti ni lečenje i
izričito kaže da ne zamenjuje lekara). Plan je predviđao 12+; Apple na ove
odgovore računa 4+.

⚠️ **`whatsNew` se ne postavlja za prvu verziju** — Apple odbija sa
`STATE_ERROR`, jer nema prethodnog izdanja u odnosu na koje bi bio „novo".

**Odluka o iPad-u:** `TARGETED_DEVICE_FAMILY` ostaje `"1,2"`. Posledica koju
treba držati na umu: recenzent app testira i na tabletu, gde je svaki ekran
crtan za telefon. Maketa na iPad screenshotovima je zato i dalje telefon —
razvučen tablet na slici bi obećao raspored koji ne postoji.

### APNs

⚠️ **Prvi ključ je bio ograničen na Sandbox, i to se posle kreiranja ne vidi
nigde u Apple-ovom UI-ju.** Pri pravljenju ključa, ispod APNs servisa stoji
**Environment** — mora **Sandbox & Production**, uz **Key Restriction: Team
Scoped (All Topics)**. Ključ se ne može izmeniti, pravi se novi (limit 2 po
timu). TestFlight i App Store buildovi su produkcijski, pa bi sandbox ključ
značio da podsetnici ćute bez ijedne greške u logu.

Ključ se dokazuje bez telefona: HTTP/2 POST sa namerno pokvarenim device
tokenom na oba hosta. `400 BadDeviceToken` = ključ radi (odbijen je samo
uređaj); `403 BadEnvironmentKeyInToken` = ne važi za to okruženje;
`403 InvalidProviderToken` = ključ ne valja.

Važeći ključ (`Q6G8DC8N3R`) prolazi na oba, i upisan je na Vercel: `APNS_KEY_P8`
(sensitive), `APNS_KEY_ID`, `APNS_TEAM_ID`, sve samo Production.

### Dva bug-a nađena usput

**1. „Moji podaci" su pucali svakom korisniku** — i PDF i .json. Poruka je
pokazivala na PDF, ali je `.json` padao isto, što odmah premešta krivicu na
zajedničko čitanje podataka. `funnel_events` je bio u `USER_OWNED_TABLES`, a
migracija 0028 nikad nije puštena na bazu.

Ispod toga je bila prava greška: tolerancija za nemigriranu tabelu je
**postojala, bila opisana i pokrivena testom — i nikad nije radila.** Čekala je
Postgres-ov `42P01`, a upit kroz Supabase do Postgresa nikad ne stigne —
PostgREST razreši ime u svom kešu šeme i vrati `PGRST205`. Test je testirao baš
kod koji ne može da stigne. Popravljeno (oba koda + novi test), migracija
primenjena, oba izvoza provereno rade na produkciji.

**Pravilo koje iz ovoga sledi:** kad pišeš toleranciju na grešku baze, proveri
kod na živom PostgREST-u (`GET /rest/v1/nepostojeca_tabela`), ne iz pamćenja.

**2. Merenje levka je ćutalo deset dana.** Ista neprimenjena migracija. Brojke
pre 13.08.2026 ne postoje — nije da je levak bio prazan, nego se nije merio.

### Screenshotovi

Demo nalog je osvežen (`seed-demo-data.cjs`), sve presnimljeno i zamenjeno kod
Apple-a. Drugi slajd se sad snima sa prekidačem na **„Potrošeno"**: na
„Preostalo" dan pojeden do kraja piše `0g UH · 0g Masti`, tri skoro-nule ispod
naslova „Ceo dan na jednom ekranu".

---

## Dodato 17.08.2026: poziv za testere je proban i pao na tri mesta

Prvi pokušaj da se poziv prođe od početka do kraja na pravom Android telefonu
**nije doveo do instalacije.** Tri nezavisna uzroka, sva tri bi pogodila
svakog pozvanog čoveka jednako:

1. **Google grupa `fitmess-testeri` je zatvorena** — nečlan dobije „Nemate
   dozvolu za pristup ovom sadržaju", bez dugmeta za pridruživanje. Nova
   grupa se tako pravi podrazumevano.
2. **„Stavka nije pronađena" je recenzija, ne greška.** Dok closed-testing
   release stoji `In review`, stavka u prodavnici ne postoji ni za jednog
   testera. Opt-in stranica u istom trenutku istinito piše „You are a tester"
   — nju servira konzola, a listing prodavnica.
3. **Grupa nije ono što nekoga čini testerom.** U konzoli je izvor testera
   email lista sa 2 adrese; ulazak u grupu je ne dodiruje. Po tom
   podešavanju 15 ljudi u grupi daje **0 testera**, i to bez ijedne greške
   igde — najskuplji od tri kvara.

Ceo nalaz, popravke po koracima, prepisana poruka za testere i tabela
odgovora na „ne radi mi": **`docs/testeri-onboarding.md`**.

Pravilo koje iz ovoga sledi: **poziv se šalje tek posle kruga na tuđem
telefonu** — drugi nalog, drugi uređaj, od nule do otvorenog app-a. Sve tri
greške preživljavaju podešavanje i vide se tek tamo, a molba za testiranje se
istim ljudima ne postavlja dva puta.

---

## Šta je sledeće (stanje 14.08.2026)

**Odmah, čim se otvori app na telefonu:**

1. **Uključiti podsetnike u app-u** i prihvatiti iOS dijalog. Trenutno u
   `push_subscriptions` postoje samo 3 web pretplate i **nijedan iOS token** —
   dok token ne postoji, lanac nije dokazan do kraja. Čim se pojavi, pravi push
   se šalje sa razvojne mašine.
2. **Ponoviti PDF izvoz** u ljusci — sad bi trebalo da radi.
3. **Ubiti app iz multitaskinga pa ga otvoriti** — jedini test iz tačke 4.4 koji
   još nije prošao ni u jednom smeru (Supabase sesija kroz restart).

Podeljena kartica obroka je **potvrđeno ispravna** (sistemski share sheet nudi
WhatsApp, Instagram, Viber).

**Pre Apple submisije:**

- **Trader podaci** — ime i adresa (Ratnih Vojnih Invalida 23, 11211). Nisu u
  API-ju, upisuju se ručno u App Store Connect. Adresa postaje **javna**.
- **Cena i dostupnost** — app još nema cenovni raspored; bez njega se ne
  submituje. Ide besplatno.
- **Apple Small Business Program** (15% umesto 30%) — ručna prijava, još nije
  urađena. Vredi pre prve zarade.
- **Politika privatnosti da pomene ~24h čuvanja fotografija obroka**
  (`public.meal_photos`, pg_cron briše posle ~dan), radi doslednosti sa
  odgovorima u Data Safety formi.
- **Demo nalog pustiti ponovo** neposredno pred submisiju i jednom tokom
  recenzije — ustaje po kalendaru, ne od nečijeg rada.

**Google Play — dogovoreno da ide bez žurbe, ali je kalendarski najduže:**

- **12 testera × 14 dana** zatvorenog testiranja. Nije počelo. Sve ostalo traje
  sat do dan-dva; ovo traje dve nedelje bez obzira na sve.
- ✅ Za start treba AAB. Android build lokalno ne može (nema SDK), ali može isti
  Codemagic — workflow `android-play` je u `codemagic.yaml` od 14.08.2026.
  Keystore je napravljen lokalno (`~/.secrets/fitmess-upload.jks`, alias
  `upload`, važi do 2053) i uploadovan u Codemagic pod imenom `fitmess-upload`;
  Codemagic personal nalog ume samo da ga primi, ne i da ga napravi.

  > **Ispravka ranije tvrdnje na ovom mestu** („keystore se gubi jednom i
  > zauvek"): to važi za *app signing key*. Uz **Play App Signing**, koji je
  > podrazumevan za nove aplikacije, taj ključ drži Google, a naš je samo
  > *upload key* — ako se izgubi, resetuje se zahtevom Google-u i aplikacija
  > ostaje ažurna. Backup svejedno postoji, jer je reset dani čekanja.

- ✅ Play listing (ikonica 512², feature graphic 1024×500, screenshotovi) —
  slike su u `store/screenshots/play-phone/` i **od 14.08. su u gitu**. Ranije
  su bile gitignore-ovane kao „regenerišu se", ali se regenerišu samo tamo gde
  postoji ceo projekat sa Playwright-om i seed-ovanim demo nalogom — pa na
  drugoj mašini nisu postojale i zaustavile su završetak listinga.

**Otvoreno, bez roka:**

- Android notifikaciona ikonica je rešena (commit `5416f6b`), ali nije
  proverena na pravom uređaju.
- `app-shell.test.tsx` pada na HEAD-u (4 testa) jer `AccountsSync` traži
  Supabase env koji Vitest ne učitava. Zatečeno, nije od ovog rada.

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
- **Demo nalog za recenzente** — bez toga oba store-a odbijaju odmah.
  Puni ga `node scripts/store/seed-demo-data.cjs`. **Pustiti ga ponovo pred
  svaku submisiju i jednom tokom recenzije** — nalog ne ustaje od nečijeg rada
  nego od kalendara, a recenzent koji otvori app dve nedelje kasnije vidi
  praznu Početnu i ne može da razlikuje „ništa nije uneto" od „pokvareno".
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
