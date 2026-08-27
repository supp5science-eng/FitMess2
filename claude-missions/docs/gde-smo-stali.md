# Gde smo stali

> Najnoviji unos je na vrhu. Stariji krugovi stoje ispod, netaknuti.

---

# 27.08.2026 — Jarvis je uklonjen; aplikacija je vraćena na stanje pre 26.08. ✅

Vlasnikova odluka: Jarvis pravac se napušta, app se vraća na ono što je radilo.
Razlog nije tehnički — Jarvis je bio odgovor na probleme korisnika kojih još
nema (app nema nijednog pravog korisnika), pa je prepis plaćao cenu bez pokrića.

## Šta je obrisano

- **`fitmess-app/`** — cela Expo/React Native aplikacija (56 fajlova): temelj,
  registar alata, Jarvis ruta, dva alata (`dan`, `voda`), EAS profili.
- **Jarvis sloj u vebu** — `jarvis-top-bar`, `jarvis-exit-rail`,
  `jarvis-composer`, `jarvis-voice-mode`, `/api/jarvis`, `lib/ai/jarvis.ts`,
  i18n deo, chromeless režim u `app-shell.tsx` (ono što je sklonilo donju
  navigaciju sa `/ai`).
- **`docs/jarvis-redizajn.md`** i **`docs/nativna-aplikacija.md`**.

`claude-missions/` je vraćen **tačno** na `3bfb9f5` (poslednji commit pre
Jarvisa). Donja navigacija je opet svuda, `/ai` je Prizma kakva je bila 26.08.

## Šta je time izgubljeno (svesno)

U istom prozoru je sleteo i posao koji nije Jarvis, i on odlazi sa njim:
Prizma koja upisuje obrok uz potvrdu (`agent-draft.ts` + `/api/ai/agent/unos`),
živa visina tastature, haptika, `theme.test.ts`. Odluka je doneta znajući ovo —
birana je čistoća stanja, ne očuvanje pojedinačnih feature-a.

## Kako se Jarvis vraća ako zatreba

Ništa nije nepovratno. Sve stoji na GitHubu i na lokalnom tagu:

```bash
git tag -l jarvis-arhiva-27-08-2026      # ceo Jarvis pravac, poslednje stanje
git checkout jarvis-arhiva-27-08-2026    # ili: git checkout ec2f48b
```

## Zatečeno stanje testova (nije posledica ovoga)

Provereno poređenjem sa starim stanjem pod istim uslovima — **nula novih
padova**. Padaju istih 6 testova i pre i posle: `profil.test.tsx` (4),
`micro-week-card` (1), `onboarding/pregled` (1). Uz njih 24 integraciona
fajla traže žive Supabase kredencijale (nema `.env` u kontejneru) i to je
očekivano. `npm run lint` ima 20 zatečenih grešaka u `scripts/store/*.cjs`
(`require()` u .cjs) — takođe nije dirano.

Jedina ispravka koja je bila potrebna: `app-shell.test.tsx` je na `3bfb9f5`
tražio kolonu selektorom `:scope > div > div` i nalazio launch splash
(`fm-splash` je uveden u `a34f947`, pre Jarvisa). Uzeta je ista ispravka koju
je projekat kasnije sam napisao — `:not(.fm-splash)`. Test-only; ponašanje
aplikacije se ne menja.

---

# 26.08.2026, kasnije — ElevenLabs usta ugrađena; ključ stigao, mreža još ne ✅/⏳

Vlasnik presudio posle prvog testa glasa: sistemski TTS nije to. Ciljni
workflow potvrđen: **Gemini sluša → Opus piše → Eleven govori.** ElevenLabs
ključ je stigao u sesiju (u `.env`) i cela integracija je ugrađena:

- **`src/lib/ai/elevenlabs.ts`**: `synthesizeSpeech` — `eleven_v3` (jedini
  model sa srpskim; Flash v2.5 staje na hrvatskom), glas i model su ENV
  config (`ELEVENLABS_VOICE_ID`/`ELEVENLABS_TTS_MODEL`) jer casting glasa
  tek sledi — promena glasa ne sme da bude deploy. Default glas: George
  (primer iz dokumentacije), muški placeholder.
- **`/api/ai/agent/tts`**: tekst odgovora → MP3 (44.1 kHz/128 kbps); auth
  obavezan, tekst ograničen na 1200 znakova da ruta ne postane tuđa
  audio-knjiga na našem računu. Grešku vraća kao JSON — klijentski ugovor
  je „nije ok → sistemski TTS", pa istekao ključ košta lepši glas, nikad
  razgovor.
- **`src/lib/audio/play-tts.ts`**: pušta MP3 i meri ŽIVU glasnoću kroz
  AnalyserNode — orb se dok Prizma govori pomera na stvarni zvuk njenog
  glasa (izmereno, ne simulirano); envelopa ostaje samo za sistemski TTS
  (koji nema audio tap). Jedan deljeni AudioContext za celu sesiju (iOS
  otključavanje zvuka lepi se za kontekst).
- **`agent-screen.tsx`**: `ttsAvailable` prop sa servera (da klijent ne
  troši zahtev otkrivajući da ključa nema); Eleven prvo, sistemska usta
  fallback; novi snimak ili odlazak sa ekrana seče govor.
- Čuvari ažurirani: `.env.example` + `docs/deploy.md` (AS_003/AS_007 zeleni).

## ⏳ Šta koči živi test ODAVDE (dva klika + jedan ključ)

1. **Mrežna politika okruženja ne pušta `api.elevenlabs.io`** — proxy vraća
   403 „Host not in allowlist". Vlasnik: claude.ai/code → environment →
   Network egress → dodaj `api.elevenlabs.io`. Zbog toga ElevenLabs ključ
   iz `.env` još NIJE verifikovan (zahtev ne stiže do ElevenLabsa).
2. **Novi Anthropic ključ nikad nije stigao** — stari je 401 (rotiran
   26.08. ujutru). Bez njega srednji korak (Opus piše) i dalje ide na
   Gemini fallback. Čim vlasnik nalepi ključ: u `.env` ovde + Vercel env.
3. Za produkciju: `ELEVENLABS_API_KEY` (+ po želji `ELEVENLABS_VOICE_ID`)
   dodati u Vercel env — tabela u `docs/deploy.md`.

Sledeće po planu kad mreža pusti: verifikacija ključa, pa **casting glasa**
(isti srpski tekst × v3 srpski/Flash hrvatski × 2 muška glasa → MP3 +
latencije, vlasnik bira uvom) i doterivanje latencije (streaming po
rečenicama, cilj ~2,5–4 s do prvog zvuka).

---

# 26.08.2026 — Prizma priča: glasovni razgovor i orb koji živi uz njega ✅

Vlasnikova želja: „da priča sa nama, ali interaktivno — swirl se pomera dok
sluša i dok govori". ElevenLabs i dalje nema (mreža blokirana + ključ nikad
nije stigao u sesiju), pa je isporučen dogovoreni most: **Gemini uši +
sistemski TTS usta**, arhitektura spremna da ElevenLabs uskoči kao zamena
usta.

## Šta je novo

- **Mikrofon u Prizmi** (`agent-screen.tsx`): dugme pored polja za kucanje;
  snima istim rekorderom kao Gric (`record-wav.ts`, mono 16 kHz WAV + živi
  nivo). Tap = slušam, tap = pošalji. Dok sluša, polje zameni „Slušam te…"
  pilula.
- **Transkripcija** = `transcribeSpeech` u `gemini.ts` (audio direktno u
  model, doslovan zapis, bez interpretacije) + server akcija
  `app/(app)/ai/actions.ts`. Transkript ulazi u ISTI `send` put kao kucanje —
  jedan razgovor, ista istorija/kvota/kartice. Namerno se NE naplaćuje
  posebno (jedna izgovorena poruka = jedna akcija = jedan charge, kao Gric).
- **Prizma odgovara naglas** (`src/lib/audio/speak.ts`): Web Speech API,
  izbor glasa sr → hr → bs (lokalni > default); ako uređaj NEMA nijedan
  ex-Yu glas, ćuti umesto da čita srpski engleskim ustima. Kad stigne
  ElevenLabs, menja se samo ovaj modul.
- **Orb je Prizmino lice** (`ai-orb-canvas.tsx` v3): props `mode`
  (idle/listening/thinking/speaking) + `getLevel`. SLUŠA → nadima se i
  svetli na pravi nivo tvog glasa sa mikrofona; MISLI → vrtlog ubrza i
  stegne; GOVORI → govorna envelopa (tri nesamerljive sinusoide — jedna
  zvuči kao metronom) + talas kroz mastilo. Sve preko uniformi glatko
  peglanih u JS-u.
- ⚠️ **Šejder zamka za onog ko dira**: brzina rotacije NE sme da množi
  `uTime` u šejderu (nagomilani ugao skoči pri promeni) — JS integriše
  `uSpin += dt * rate` i šejder koristi taj sat. `speechSynthesis` nema
  audio tap, pa su usta komponovana, ne merena.
- **Popravljena dva čuvara koja su padala i na main-u**: `.env.example`
  dopunjen sa SVIM referenciranim varijablama (ANTHROPIC_API_KEY, APNS_*,
  FCM, CRON_SECRET, GEMINI_VOICE/MICRO_MODEL, NODE_ENV) → `AS_003` prolazi;
  `docs/deploy.md` tabela dopunjena istim → `AS_007` prolazi.

## Provereno

Typecheck ✅, build ✅, lint bez novih grešaka (20 zatečenih u `.cjs`
skriptama), testovi: +14 novih prolaze; padaju samo zatečeni — 4 env-zavisna
`app-shell` + `micro-week-card` „names a tapped day" (pada i na čistom
main-u, nije iz ovog kruga — čeka svoj).

## ⚠️ Živi test glasa NIJE odrađen odavde

U kontejneru nema nijednog važećeg ključa (stari Anthropic je 401 — rotiran
jutros; novi Anthropic/ElevenLabs nikad nisu stigli u sesiju; Gemini ključ
ovde ne postoji). Kod je verifikovan build/testovima; glas i orb se čuju/vide
na lokalu ili produkciji, gde ključevi već stoje. Podsetnik: iPhone bočni
prekidač za zvono gasi Web Audio/TTS — nije bug.

---

# 25.08.2026, veče — Prizmin mozak je od danas Claude Opus 5 ✅

Korak 1 sa jučerašnje liste je urađen i **živo testiran** (vlasnik dao Anthropic
ključ u sesiji; mreža ka `api.anthropic.com` je već bila otvorena).

- **Novi modul `src/lib/ai/claude.ts`**: zvanični `@anthropic-ai/sdk`
  (v0.120.0), model `claude-opus-5`, strukturirani izlaz kroz
  `output_config.format` (JSON šema). Gemini ostaje za SVE ostalo (slike,
  deklaracije, STT) — ovaj modul postoji samo za agentov turn.
- **Ruta `/api/ai/agent` bira mozak po ključu**: `ANTHROPIC_API_KEY` postoji →
  Claude; ne postoji → stari Gemini put, netaknut. Produkcija bez ključa radi
  kao do sada; ključ se dodaje u produkcijski env kad vlasnik odluči.
- **Dve šeme, jedan sudija**: `AGENT_RESPONSE_JSON_SCHEMA` (standardni JSON
  Schema, za Claude) pored Gemini-jeve uppercase varijante; oba izlaza i dalje
  prolaze kroz isti `agentModelReplySchema` (halucinirana akcija se tiho
  odbaci). Test čuva da obe šeme nabrajaju tačno katalog akcija.
- ⚠️ Naučeno uživo: `output_config.format.schema` **odbija `maxItems`**
  (HTTP 400) — kapa od 3 akcije živi u promptu i zodu, ne u šemi.
- **Živi test** (pravi sistemski prompt, 3 scenarija): srpski topao i tačan,
  računa preostale makroe bez greške (58 g proteina = 140−82), za logovanje
  nudi `prizma_unos` prvo. Latencija 5,7–9 s po turnu uz `effort: "medium"` —
  doterivati uvom kad se čuje u appu (opcije: `effort: "low"`, streaming).
- 🔜 I dalje čeka: **ElevenLabs** — `api.elevenlabs.io` je i dalje blokiran u
  mrežnoj politici okruženja, a ključ treba ponovo dostaviti (stari je nestao
  sa kontejnerom; ionako je bio plan da se rotira).

---

# 25.08.2026 — Prizma (Jarvis agent), AI tab, i dan velikog redizajna koji se vratio

Jedan dug dan, tri poglavlja. Sve ispod je **na `main`** (vrh: `39dbb90`),
svaki korak je mergovan i verifikovan (typecheck + build + testovi; jedini
padovi su 11 zatečenih env-zavisnih testova koji padaju i bez ovih izmena).

## Poglavlje 1: totalni redizajn „Žar" — urađen, pa POVUČEN isti dan

- Jutarnja odluka: tamna crvena romantična tema, dva taba, žar/pepeo animacije.
  Isporučene **dve verzije** (tamni bordo `2f55896`, pa otvorena crvena
  `1d9af64` po iOS referenci) — vlasnikova presuda: „ništa mi se ne sviđa,
  vrati staro".
- **Vraćena Gravira** (`abde317`), pa doterana: papir je sada **čisto beo
  `#ffffff`** (krem `#fdf9f0` se čitao žućkasto) — tokeni, theme-color,
  manifest, OG slika (`140d4a8`). Nekadašnje tople nijanse su bela sa dahom
  mastila.
- ⚠️ Mapa starog dizajna: `docs/design-snapshot-2026-08-25-gravira.md`;
  povratna tačka pre svega: `928169b`. Žar tema živi u istoriji
  (`2f55896`…`1d9af64`) ako ikad zatreba.

## Poglavlje 2: AI tab i orb

- **Četvrti tab „AI"** (`/ai`, ruta zaštićena kao i sve) — na njemu je SAMO
  agent. `8c01523`.
- **Orb**: WebGL shader sfera (three.js, već u zavisnostima) — ultramarin
  fluid sa domain-warped šumom, tamnim „venom" venama, stalnom rotacijom,
  mekim topljenjem u papir (`ai-orb-canvas.tsx`, `bbb284a`). U nav-u se vrti
  ISTI shader na 32px, bez teksta ispod (aria ostaje „AI") — `51e56cf`.
  ~30fps kapa, reduced-motion → statičan frejm, bez WebGL-a → CSS fallback.

## Poglavlje 3: Prizma — Jarvis v1 (`13cde90`)

Vizija (vlasnik): **agent JE aplikacija**. Korisnik kaže šta hoće, Prizma
donese ekran/akciju; na kraju ostaju samo AI + Postavke, ostali tabovi se gase
kad v1/v2 sazru. Dizajn platno sa 4 stanja ekrana:
https://claude.ai/code/artifact/2b7fd35b-2e50-43ba-8556-cc47fa1f9ce1

Šta radi danas:
- **Mir**: orb + lični pozdrav (ime iz `profiles.full_name`, doba dana po
  Beogradu) + živo stanje („Do sada X kcal — ostalo ti je Y").
- **Razgovor**: bez mehurića — korisnikova rečenica je tihi citat, odgovor
  krupan tekst; **akcije kao kartice** („hoću da logujem obrok" → FM 2.7 /
  Slikaj / Gric; tap otvara postojeći flow).
- Bezbednost akcija: model bira samo **ID iz kataloga**
  (`lib/ai/agent-actions.ts`, 9 navigacionih akcija), JSON šema +
  zod; halucinirani ID se tiho odbaci, tekst dugmadi je naš (i18n).
- Backend: `/api/ai/agent` → `generateAgentTurn` (Gemini, chat + JSON šema u
  `gemini.ts`); činjenice dana se prepočitavaju server-side; kvota kao za
  procene obroka.
- **Preimenovanje**: stari flow „Prizma" je za korisnike sada **„FM 2.7"**
  (AddSheet, kartica akcije, legal) — Prizma je samo agent. Interni
  nazivi/rute nedirnuti. `39dbb90`.

## 🔜 Sledeći koraci (dogovoreno, čeka dve stvari od vlasnika)

1. **Prizmin mozak → Claude Opus 5** (`claude-opus-5`, zvanični
   `@anthropic-ai/sdk`, strukturirani izlaz za reply+actions). Gemini ostaje
   za slike/deklaracije/STT. Odluka pala jer je Gemini u chatu „glup";
   fine-tuning NIJE plan — plan je bolji model + širi kontekst (nedelja,
   adaptivni cilj, trening) + doteran prompt.
   ⏳ Čeka: **Anthropic API ključ** (api.anthropic.com je već dozvoljen u
   mrežnoj politici okruženja — može se testirati odavde čim ključ stigne).
2. **Glas — ElevenLabs, muški, srpski.** Utvrđeno: srpski TTS ima samo
   **Eleven v3**; Multilingual v2 / Flash v2.5 imaju hrvatski (testiraćemo da
   li „hrvatski čita srpski" prolazi — brže i jeftinije). Arhitektura:
   mikrofon → Gemini (audio direktno u model, kao Gric) → Prizma tekst →
   ElevenLabs streaming po rečenicama; cilj ~2,5–4 s do prvog zvuka.
   ⏳ Čeka dve stvari: (a) na ElevenLabs ključu **Restrict Key** trenutno sve
   drži na No Access — treba Text to Speech=Access + Voices=Read (ili
   isključiti restrikciju za test); (b) u mrežnoj politici Claude okruženja
   dozvoliti **api.elevenlabs.io**. Ključ je sačuvan u `claude-missions/.env`
   (gitignorisan; posle testa rotirati i staviti u produkcijski env).
   Plan testa: isti tekst × (v3 srpski, Flash hrvatski) × 2 muška glasa →
   MP3 + latencije, vlasnik bira uvom.
3. **v2 Prizme** (posle glasa): mutirajuće akcije iz razgovora („obriši mi
   ručak") uz izričitu potvrdu u chatu — katalog akcija je dizajniran da ih
   primi.

## ⚠️ Zamke za onoga ko nastavlja

- `.light` klasa u `globals.css` je od redizajn-dana bila „legacy pin"; posle
  vraćanja Gravire `.light, :root` su opet JEDNO — ne razdvajati bez potrebe.
- `sessionStorage` ključ niti razgovora je `fm_agent_chat_v2` (v1 shape je
  imao poruke bez akcija).
- Testovi nav-a sada broje ČETIRI taba, AI tab se u testovima nalazi po
  aria-label „AI".

# 24.08.2026, 23:00 — dizajn: staklo, zvuk, verzija 2.0.1

Radilo je više agenata odjednom u istom radnom stablu. Ovo je **dizajnerska
traka**; klon i 3D idu svojim tokom (`docs/klon.md`).

## ✅ Urađeno i živo na produkciji

**Verzija 2.0.1, sa jednim izvorom istine** (`c324ef0`). Broj je stajao na
četiri mesta koja niko ne upoređuje: `package.json` i ekran Podešavanja su
govorili `0.1.0` onog dana kad je App Store odobrio binar koji se zove `1.0`, a
jedno podizanje na 2.0.1 se pre toga izgubilo **celo u merge-u, bez ijedne
greške**. Sad broj živi samo u `src/lib/app-version.ts`, a tri fajla koja ne
mogu da ga uvezu (`package.json`, `versionName`, `MARKETING_VERSION`) drži
`src/lib/__tests__/app-version.test.ts` — otvara ih sa diska i pada čim se
raziđu. `versionCode` i `CURRENT_PROJECT_VERSION` se **ne diraju**, njih
Codemagic piše na svaki build.

⚠️ Tag **`v1.0`** stoji na `35a4dc9` = tačno stanje koje je Apple odobrio
23.08. To je povratna tačka.

**Staklo na mastilu + zvuk klika** (`b83902a`, pojačano u `774677e`).
Puna priča i zamke: memorija `fitmess-liquid-glass`. Ukratko:

- Staklo ide **samo na površine punjene mastilom** (`.liquid-glass.bg-primary`,
  `.bg-destructive`), nikad na papir. Referenca koju je vlasnik dao (tamno
  dugme sa iridescentnim rubom) živi na crnom; preko toplog belog papira je to
  tačno greška koju je projekat već jednom napravio i vratio.
- Selektor gađa `.bg-primary` umesto nove klase jer je **svaka** kontrola
  punjena mastilom već napisana kao `liquid-glass bg-primary`.
- Zvuk se **sintetizuje u trenutku pritiska** (`src/lib/feel/click-sound.ts`,
  Web Audio) — app ne nosi nijedan zvučni fajl i radi offline. Kači se na
  postojeći delegirani `touchstart` u `HapticProvider`; nijedno dugme se ne
  dira. Mastilo = `stamp`, sve ostalo = `tick`.
- Gasi se u **Podešavanja → Aplikacija → Zvuk klika** (`localStorage`,
  `fm_click_sound`), jer da li telefon sme da se čuje zavisi od prostorije, ne
  od naloga.
- ⚠️ Na iPhone-u **bočni prekidač za zvono gasi Web Audio**. To nije bug i
  namerno se ne zaobilazi.

## ⚠️ Dug koji je svesno napravljen — politika privatnosti je ISPRED koda

Commit `c042a43` objavljuje da se **izvorne slike lica čuvaju** vezane za nalog,
uvodi izričit pristanak i imenuje prava. Pushovano **na izričit zahtev
vlasnika, uz upozorenje**.

Danas kod to ne radi:

- slike se **ne čuvaju** — `api/klon/sacuvaj` upisuje samo crtež, tabele za
  slike nema;
- `avatar_clones` **nije** u `USER_OWNED_TABLES` → ne izlazi ni u „Moji podaci";
- nema kontrole za brisanje slika;
- pristanak pre slanja ne postoji na ekranu za klona.

**Da se zatvori:** tabela za slike + upis u nju → pristanak na `/klon` pre
slanja → `avatar_clones` i nova tabela u `USER_OWNED_TABLES` → oboje u brisanje
naloga. Dok to ne stoji, objavljena politika imenuje tri prava koja ne postoje,
a to je prvo što recenzent čita.

## 📌 Otvoreno, sa mog stola

**Redizajn UI-a je odložen, ali dijagnoza je gotova.** Vlasnik: „izgleda kao
klasičan calorie tracking app". Snimio sam živi app i našao sedam stvari koje
odaju žanr; teza je **„FitMess ne broji hranu, FitMess crta tebe"** — klon kao
jedinica mere, ne red u Podešavanjima. Detalji i redosled: memorija
`fitmess-ui-redizajn`. Vlasnik je rekao **„polako sa UI-em dok ne rešim klona"**
— ne kretati bez njegove reči.

**Hidraciona greška** i dalje stoji, sad potvrđena i na `/analitika`, ne samo na
`/danas` (vidi „Ostalo otvoreno" niže). Nije ničija.

**`app-shell.test.tsx`** pada u 4 testa: `AccountsSync` traži Supabase env koji
vitest ne dobija. Provereno `git stash`-om — pada i bez izmena iz ovog kruga.

---

# 19.08.2026, 21:50 · ✅ POSLATO NA RECENZIJU

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
