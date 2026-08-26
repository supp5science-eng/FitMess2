# Prizma redizajn — zajednički brief

Ovaj dokument je kontekst za sve koji rade na redizajnu `/ai` ekrana
(2026-08-26). Pročitaj ga pre nego što napišeš prvu liniju.

## Šta gradimo

`/ai` je Prizmin ekran — AI agent aplikacije. Vlasnik hoće da radi kao
mobilna aplikacija Perplexity-ja:

1. **Dva režima**, biraju se segmentnom kontrolom na vrhu ekrana:
   - **Jarvis** (levo) — SAMO GLAS. Pričaš sa Prizmom, ona sluša, odgovara
     naglas i loguje obroke. Bez tastature, bez konca poruka.
   - **Chat** (desno) — postojeći tekstualni razgovor.
2. **Bez donje navigacije na tom ekranu.** Kad uđeš u Prizmu, četiri taba
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
- `src/components/ai/ai-orb-canvas.tsx` — WebGL orb, Prizmino lice. Prima
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
- **Sav tekst kroz i18n.** `const { t } = useT()` pa `t("prizma.…")`.
  SVI ključevi koji ti trebaju VEĆ POSTOJE u
  `src/lib/i18n/messages-parts/prizma.ts`. Čitaj ih, ne dodaj nove — ako ti
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
