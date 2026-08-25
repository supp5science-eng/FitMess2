# Design snapshot — „Gravira" (25.08.2026)

Zapis trenutnog UI-ja PRE totalnog redizajna (dva taba: AI + Profil, crvena
„romantična" tema sa ambijentalnim motion-om). Ako redizajn krene u pogrešnom
smeru, ovaj dokument + git istorija su put nazad.

**Referentni commit:** `928169b` („Gde smo stali: krug od 24.08. na vrhu,
stariji netaknut") na `main`. Ceo stari UI je dostupan sa
`git checkout 928169b` — ovaj dokument je mapa, istorija je izvor istine.

---

## 1. Tema: „Gravira" — plavo mastilo na toplom papiru

Definisana u `src/app/globals.css` (~980 linija). JEDNA tema (svetla);
light/dark par je penzionisan 24.08.2026, nema `.dark` bloka ni `fm_theme`
kolačića.

Ključni tokeni:

| Token | Vrednost | Uloga |
|---|---|---|
| `--paper` / `--background` | `#fdf9f0` | topli papir, pozadina svega |
| `--paper-raised` / `--card` | `#ffffff` | podignuta kartica („svež list") |
| `--ink` | `#1c1b8f` | duboko mastilo — sav tekst i linije |
| `--ink-bright` / `--primary` | `#2f2ce6` | živi ultramarin — dugmad, ring, fokus |
| `--destructive` | `#b03a20` | cigla/terakota (paleta nema čistu crvenu!) |
| `--border` | ink na 20% alfe | linije su uvek mastilo, nikad siva |
| `--gauge` + grad 1–3 | `#6b69ff → #2f2ce6 → #15139c` | kalorijski ring |
| `--streak-*` | oker/ćilibar `#d9963a…#9c5312` | niz (streak) — jedini topli akcenat |
| `--chart-1…4` | ultramarin rampa | grafikoni („jedna ploča, tanji šraf") |
| `--chart-5` | `#b5761f` | preko-cilja marker (nikad destructive) |
| `--macro-protein/fat/carbs` | `#2c7a58` / `#c05028` / `#9a7112` | žalfija / terakota / oker |
| `--mark-water/steps/fiber/sugar/sodium/satfat` | čelik/šljiva/žalfija/dud/slate/oker | akcenti tile-ova |
| `--wordmark-grad` | ultramarin↔oker gradijent | „Mess" u logotipu |

Font: DM Sans (`@fontsource/dm-sans`), `--font-heading` = `--font-sans`.
Radijusi: skala iz `--radius` (0.6× do 2.6×).

Karakter/utility klase (sve u `globals.css`):
- `.fm-lift` — tvrdi letterpress ofset (ne meka senka)
- `.app-aurora` — halftone/stipple pozadina u uglovima kolone
- `.fm-halftone` — halftone overprint tekstura
- `.liquid-glass` — staklo efekat na nav pilули
- `.nav-glass` — klizeće „sočivo" iza aktivnog taba

## 2. Shell i navigacija

- `src/components/shell/app-shell.tsx` — mobilna kolona max 430px, centrirana
  na desktopu; sadržaj skroluje UNUTAR kolone, nav je sopstvena donja sekcija
  (nikad overlay). Full-bleed izuzeci: `/`, auth rute, `/klon`, `/upitnik`,
  `/onboarding`, `/telefon`, legal, `/en/*`, `/samo-za-telefon`.
- `src/components/shell/app-nav-bar.tsx` + `bottom-nav.tsx` — plutajuća
  „papirna pilula" sa ink hairline okvirom; **3 taba**:
  1. `/danas` — Home ikona, „Danas"
  2. `/analitika` — ChartColumnBig, „Analitika"
  3. `/profil` — Settings, „Profil"
  Klizeće liquid-glass sočivo se meri (getBoundingClientRect) i putuje
  spring krivom `cubic-bezier(0.34, 1.4, 0.5, 1)` 440ms; poštuje
  `prefers-reduced-motion` (pad na fade).
- `src/components/shell/app-splash.tsx` + `.css` — brand splash na prvom
  paint-u; sarađuje sa `fm_intro` kolačićem (onboarding ring hand-off).

## 3. Ekrani po tabovima (šta gde živi danas)

### `/danas` (Home)
`src/components/home/home-screen.tsx` + `src/lib/home/*`:
kalorijski ring (gauge, adaptivni target `projectDailyTarget`), makroi,
voda (nedelja + cilj), koraci (cilj `resolveStepGoal`), vaganje (due-state,
poslednje merenje), trening nedelja, streak, plan-intro i over-notice
(kolačići), day-answers („trust" pitanja o danu), BMR iz `lib/budget/engine`.

### `/analitika`
`src/app/(app)/analitika/page.tsx` → `WeeklyDashboard` + kartice iz
`src/components/analytics/`: BMI, prosek makroa, trend unosa (intake trend),
istorija obroka (30 dana), mikro nedelja, koraci, voda, trend vaganja,
week-on-track beleška, streak.

### `/profil` („Podešavanja")
iOS-style grupe (`SettingsGroup`/`SettingsRow`), pod-rute:
`cilj`, `moji-podaci`, `podaci`, `merenje`, `koraci`, `podsetnici`,
`telefon`, `lozinka`, `privatnost`, `uslovi`, `pravila`, `izvori` +
jezik (sr/en), zvuk, refresh, export podataka, medicinski disclaimer,
brisanje naloga, admin link (za `is_admin`), odjava.

### Ostale rute u shell-u
- `/dodaj` — unos obroka (pretraga, proizvod, skener barkoda, kamera/AI slika
  obroka — `components/food`, `scan`, `camera`, `ai/portion-dial`, `shot-guide`)
- `/merenje` — unos merenja; `/dostignuca` — dostignuća; `/nagrada` — nagrada
- `/onboarding`, `/upitnik` (public), `/klon` (3D avatar, three.js), auth grupa

## 4. Motion inventar (staro)

- Klizeće nav sočivo (gore) • splash animacija • `tw-animate-css` util-i
- AI „thinking" animacija: `components/ai/ai-thinking.{tsx,css}`
- Portion dial + shot guide animacije u food flow-u
- Onboarding ring hand-off (`fm_intro`)
- 3D klon (three.js) na `/klon` i `/admin/klon3d`

## 5. Ono što redizajn NE dira (dogovor 25.08.2026)

- `/upitnik` — ostaje na starom dizajnu do daljeg (eksplicitno)
- Backend/API rute, Supabase šema, logika u `src/lib/*` — redizajn je UI sloj
