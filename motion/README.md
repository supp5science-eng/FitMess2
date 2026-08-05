# motion — b-roll motion graphics

Motion-graphics klipovi za video skriptu (b-roll). Svaka scena je jedan HTML
fajl koji se renderuje frejm-po-frejm u Chromium-u i pakuje u mp4.

## Scene

| Scena | Format | Trajanje | Copy |
|---|---|---|---|
| `deficit-9x16` | 1080×1920, 30 fps | 3,0 s | „naravno da ću smršati jer logično više sam trošo nego što sam unosio" |

Kratak rez: na ekranu stoji samo zaključak („naravno da ću smršati"), a ostatak
rečenice odigra vaga — desni tas (potrošnja) pretegne levi (unos) — pa pilula
deficita. Tekst je namerno kratak da ne trči ispred voice-overa.

Gotovi fajlovi su u [`out/`](./out).

## Kako se renderuje

```bash
npm i -D playwright && npx playwright install chromium   # jednom
node motion/render.mjs deficit-9x16                       # -> motion/out/deficit-9x16.mp4
node motion/render.mjs deficit-9x16 --fps 60 --scale 2    # gušći frejmovi
```

Potreban je i `ffmpeg` sa `libx264` u PATH-u. Render pravi frejmove u
`motion/.frames/` (ignorisano u gitu) i briše ih posle enkodovanja.

## Kako se piše nova scena

`motion/scenes/<ime>.html` mora da izloži dve stvari:

- `window.SCENE = { width, height, fps, duration }` — logičke CSS dimenzije
  (scena se snima na `--scale`, podrazumevano 2× → 1080×1920);
- `window.render(t)` — postavlja **ceo** kadar za trenutak `t` (u sekundama).

Pravilo: **nikakve CSS/Web animacije** — svaki frejm mora da bude čista funkcija
vremena, inače screenshot-ovi klize i render nije ponovljiv.

## Vizuelni jezik

Isti tokeni kao app (`src/app/globals.css`), samo hard-kodirani jer scena stoji
sama: bela pozadina, mastilo `#0a0c0b`, muted `#646b6f`, unos `#d95540`
(`--macro-fat`), potrošnja `#22c55e` (svetlo zelena), brend teal `#17d1a8`
za pilulu deficita. Tipografija je
Inter (900/700), sr-Latn, zero-shame ton — bez kaznene crvene.

Sadržaj stoji između ~170 px i ~770 px (od 960 CSS px visine), tako da gornji i
donji UI sloj Reels/TikTok-a ne prekriva ništa bitno.
