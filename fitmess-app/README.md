# FitMess — nativna aplikacija

Prava React Native aplikacija. Nema WebView-a, nema `server.url`, ništa ne
čeka mrežu pre prvog kadra.

Zašto se ovo radi i šta je odlučeno: `../claude-missions/docs/nativna-aplikacija.md`.

---

## Kako da vidiš aplikaciju na telefonu

Ovo je bilo glavno pitanje i evo odgovora. **Svakodnevni rad je prvi način —
druga dva su izuzeci.**

### 1. Dok radimo — promena se vidi za 2 sekunde

Ja pokrenem server na kompjuteru:

```
cd exexutor/fitmess-app
npx expo start
```

Ti na telefonu otvoriš aplikaciju i ona se poveže (isti Wi-Fi; ako ne prolazi,
`npx expo start --tunnel` radi i preko interneta).

Od tog trenutka: **sačuvam fajl → promena je na tvom telefonu za sekundu-dve.**
Bez builda, bez deploy-a, bez čekanja. Ostaje čak i tamo gde si stao na ekranu
(Fast Refresh).

Poređenja radi, danas je: `git push` → Vercel build ~90 s → refresh.

### 2. Kad ja radim a ti nisi za kompjuterom — `eas update`

```
npx eas update --branch production
```

Ti otvoriš aplikaciju i ona povuče novi JS. **Bez store-a, bez review-a**, oko
minut. Ovo je zamena za današnje „`git push` pa stigne svima".

### 3. Kad se dira native — `eas build`

Nova biblioteka, nova dozvola, ikonica. Cloud build (Mac i dalje **ne treba**,
isto kao Codemagic sada), stigne ti kroz TestFlight ili direktan link, ~15 min.
Ovo se dešava retko — par puta mesečno.

---

## Šta treba jednom da uradiš (prvi put)

Ovo su jedine stvari koje traže tebe, jer traže tvoje naloge.

**Korak 1 — Expo nalog:**

```
npx eas login
npx eas init
```

`eas init` upiše `extra.eas.projectId` u `app.config.ts`. Do tada je namerno
prazan — pogrešan id šalje buildove i OTA update u tuđi projekat.

**Korak 2 — aplikacija na telefon.** Dva puta, biraj po tome koliko brzo hoćeš
da vidiš nešto:

| | Expo Go | Development build |
|---|---|---|
| Šta je | tuđa aplikacija iz App Store-a u koju se učita naš kod | naša aplikacija, naša ikonica, naše ime |
| Treba ti | ništa, samo skineš Expo Go | Apple Developer nalog (imaš ga) |
| Za koliko | odmah | ~15 min prvi build |
| Ograničenje | radi samo dok SDK ima sve module koje koristimo | nema ograničenja |

Za prvi pogled Expo Go je najbrži. Za sve dalje — development build:

```
npx eas build --profile development --platform ios
```

⚠️ **Ovo NIJE store submisija.** Development build i TestFlight build se
instaliraju samo na telefone na koje ih ti staviš; live aplikacija u store-u se
ne dira. Zamenjuje je tek `--profile production` plus slanje u store.

---

## Struktura

```
src/
  app/                 ekrani (expo-router: fajl = ruta)
    _layout.tsx        koren — sesija, splash gate, native stack
    (auth)/prijava     prijava
    (app)/index        početna (dokazni ekran)
    (app)/jarvis       Jarvis
  jarvis/
    alat.ts            REGISTAR ALATA — srce; pročitaj ovo prvo
    mozak.ts           razgovor sa serverom i petlja alata
    alati/             pojedinačni alati (voda.ts kao šablon)
    komponente/        ono što alat sme da nacrta
  lib/
    supabase.ts        klijent + sesija u keychain-u
    auth.tsx           ko je prijavljen
    feedback.ts        haptika
  theme/tokens.ts      „Gravira" paleta, prepisana sa sajta
  ui/                  Text, Button, Wordmark
```

Backend nije ovde: sajt `fitmess.app` i Supabase su isti kao do sada
(`../claude-missions`).

---

## Dva pravila koja ne treba kršiti

**Model ne dira bazu.** Bira alat, popuni argumente; upis radi naš kod u
`src/jarvis/alati/`.

**Model ne crta ekran.** Bira alat; alat imenuje komponentu koju smo mi
napisali (`src/jarvis/komponente/`).

Posledica: **Jarvis je tačno onoliko sposoban koliko alata ima.** Dodavanje
sposobnosti je dva koraka — napiši alat, uvezi ga u `src/jarvis/registracija.ts`.

---

## Okruženje

`.env` (nije u gitu):

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Isti projekat i isti ključ kao sajt — `sb_publishable_` ključ je namenjen da
bude u klijentu, RLS je ono što stvarno štiti redove.

**Anthropic i ElevenLabs ključevi ovde NE smeju.** Svako ko skine aplikaciju
može da ih izvuče. Zato Jarvis priča preko `fitmess.app/api/jarvis`, koji drži
ključ.
