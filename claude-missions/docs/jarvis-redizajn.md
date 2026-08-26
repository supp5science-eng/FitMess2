# Jarvis redizajn — zajednički brief

Ovaj dokument je kontekst za sve koji rade na redizajnu `/ai` ekrana
(2026-08-26). Pročitaj ga pre nego što napišeš prvu liniju.

## Dva imena koja se ne smeju pomešati

Ovo je bila najskuplja zabuna na ekranu, pa stoji na vrhu:

- **Jarvis** je AI agent — `/ai`, glas i chat. Fajlovi `src/components/ai/jarvis-*`,
  i18n ključevi `jarvis.*`, persona u `src/lib/ai/agent-chat.ts`.
- **Prizma** je flow za najtačniji unos hrane — `/dodaj/najtacnije`. Fajlovi
  `src/lib/ai/prizma.ts`, `shot-guide.*`, `portion-dial.*`, akcija `prizma_unos`,
  i18n ključevi `dodaj.prizma.*`.

Agent se 2026-08-25 nakratko zvao Prizma, pa je flow preimenovan u „FM 2.7"
da se sklonio s puta. Vlasnik je 2026-08-26 odlučio obrnuto i konačno: flow
je opet Prizma, agent je Jarvis. Ako negde vidiš „FM 2.7", to je zaostatak.

## Šta gradimo

`/ai` je Jarvisov ekran — AI agent aplikacije. Vlasnik hoće da radi kao
mobilna aplikacija Perplexity-ja:

1. **Dva režima**, biraju se segmentnom kontrolom na vrhu ekrana:
   - **Jarvis** (levo) — SAMO GLAS. Pričaš sa Jarvisom, on sluša, odgovara
     naglas i loguje obroke. Bez tastature, bez konca poruka.
   - **Chat** (desno) — postojeći tekstualni razgovor.
2. **Bez donje navigacije na tom ekranu.** Kad uđeš u Jarvisa, četiri taba
   nestaju. Ekran je njen.
3. Gore levo: profil/podešavanja. Gore desno: izlaz nazad u aplikaciju.
4. Composer (polje za kucanje) prerađen po uzoru na Perplexity: kartica sa
   zaobljenim uglovima, tekst u svom redu, kontrole u redu ispod njega,
   unutar iste kartice.

## Kako je ekran sastavljen danas

- `src/app/(app)/ai/page.tsx` — server komponenta. Čita ime iz `profiles`,
  računa `contextLine` iz dnevnih podataka, javlja da li ElevenLabs ključ
  postoji. Prosleđuje sve u `AgentScreen`.
- `src/components/ai/agent-screen.tsx` — sve ostalo. Client komponenta:
  konac poruka u `sessionStorage`, slanje na `/api/ai/agent`, snimanje
  glasa (`startWavRecording`), transkripcija (`transcribeVoiceAction`),
  izgovor odgovora (`playTtsBlob` pa `createSpeaker` kao rezerva), i
  `orbMode` koji vodi orb kroz stanja.
- `src/components/ai/ai-orb-canvas.tsx` — WebGL orb, Jarvisovo lice. Prima
  `mode` (`idle | listening | thinking | speaking`) i `getLevel()` (živa
  jačina zvuka 0..1). NE DIRATI — drugi agent radi na njemu.
- `src/components/shell/app-shell.tsx` — odlučuje da li ruta dobija
  centriranu kolonu + donju navigaciju, ili je „full bleed".
- `src/components/shell/app-nav-bar.tsx` + `bottom-nav.tsx` — donja
  navigacija.

## Pravila projekta (iz AGENTS.md — obavezno)

- **Srpski, sr-Latn, neformalno „ti", bez stida.** Nikad kaznjivo crveno.
- **Tokeni teme, ne heks.** Boje dolaze iz CSS promenljivih u
  `src/app/globals.css` (`--primary`, `--card`, `--ink`, `--ai-prose`, …).
  Nikad inline heks. Jedna tema („Gravira"), nema `dark:` varijante —
  `src/app/theme.test.ts` obara build ako se vrati.
- **Sav tekst kroz i18n.** `const { t } = useT()` pa `t("jarvis.…")`.
  SVI ključevi koji ti trebaju VEĆ POSTOJE u
  `src/lib/i18n/messages-parts/jarvis.ts`. Čitaj ih, ne dodaj nove — ako ti
  baš zatreba nov ključ, javi orkestratoru umesto da diraš taj fajl.
- **Kartice** koriste `components/ui/card.tsx` na `bg-card` podlozi.
- `cn()` iz `@/lib/utils` za spajanje klasa.
- Komentari objašnjavaju ZAŠTO, ne ŠTA. Piši ih kao okolni kod.

## Pravila ove paralelne smene

- **Radiš SAMO na fajlovima koje ti je orkestrator dao.** Fajlove drugih
  agenata ne diraj ni da popraviš očiglednu grešku — javi umesto toga.
- **Ne diraj git.** Bez `git add`, `commit`, `checkout`, `push`.
  Orkestrator sve commituje.
- **Ne pokreći `npm run build` ni `npm run dev`.** Više agenata deli isti
  radni direktorijum i `.next` bi se sudarao. `npx tsc --noEmit` sme (ništa
  ne upisuje), ali je sporo — orkestrator svejedno proverava centralno.
- Ako ti treba nešto van tvog opsega, opiši to u završnom izveštaju.

## Šta vraćaš

Kratak izveštaj: koje si fajlove napisao, koje propse komponenta prima,
šta je namerno ostavljeno orkestratoru da spoji, i sve na šta si naleteo a
nije bilo u zadatku.

---

# Referenca: mobilna aplikacija Perplexity

Vlasnik je kao uzor dao mobilnu aplikaciju Perplexity. Novi agent u novom
chatu neće videti te snimke, pa je ovde zapisano šta se sa njih uzima.
Ovo je opis cilja, ne recept — ako nešto od navedenog ne odgovara Gravira
temi, tema pobeđuje.

## Gornja traka

Pilula sa dva segmenta u sredini ekrana. Aktivni segment je bela pilula sa
mekom senkom KOJA KLIZI kad se prebaci; neaktivni je samo ikona + tekst na
providnoj podlozi. Levo od pilule okrugli avatar, desno okruglo dugme.
Traka je niska — oko 40px — i čita se kao hrome, ne kao sadržaj.

Kod nas: levo profil/podešavanja, sredina Jarvis | Chat, desno izlaz.
Napravljeno u `src/components/ai/jarvis-top-bar.tsx`.

## Composer

Ovo je bila glavna zamerka na naš stari ekran. Kod Perplexity-ja je JEDNA
KARTICA, ne red odvojenih kontrola:

- zaobljena kartica, blago izdignuta, na dnu ekrana;
- tekst zauzima ceo gornji red kartice;
- ispod teksta, UNUTAR iste kartice, red kontrola: levo `+` i čip, desno
  ikone i puno okruglo dugme za slanje;
- kad se tapne, kartica poraste, tekst se prelama, kartica ostaje
  prilepljena tačno iznad tastature.

Naš stari composer je bio traka alata — pilula za tekst, pa okrugli
mikrofon, pa okrugli send, sa linijom iznad. To je zamenjeno; vidi
`src/components/ai/jarvis-composer.tsx`.

## Prazan ekran

Ogroman prazan prostor sa logotipom u sredini, pa tek pri dnu tri predloga
kao redovi razdvojeni vlas-linijom, pa composer. Bez naslova, bez kartica.
Tišina je poenta.

## Bez donje navigacije

Na Jarvisovom ekranu nema tabova. Izlaz je isključivo dugme gore desno.
Zato je uveden `CHROMELESS_PREFIXES` u `src/components/shell/app-shell.tsx`.

---

# Gde da gledaš pre nego što pitaš

| Pitanje | Fajl |
|---|---|
| Kako izgleda boja / token | `src/app/globals.css`, `:root` blok |
| Sme li druga tema | `src/app/theme.test.ts` — obara build |
| Kako se meri klizeći indikator | `src/components/shell/bottom-nav.tsx` |
| Kako se kolocira CSS uz komponentu | `src/components/ai/ai-thinking.css` |
| Kako se piše pure funkcija + test | `src/lib/week/`, `src/lib/weight/` |
| Kako ruta upisuje uz RLS | `src/app/api/logs/route.ts` |
| Kako se snima glas | `src/lib/audio/record-wav.ts` |
| Kako se govori naglas | `src/lib/audio/play-tts.ts`, `speak.ts` |
| Kako orb prima stanja | `src/components/ai/ai-orb-canvas.tsx` |
| Belgrade dani i nedelje | `src/lib/dates.ts` |
