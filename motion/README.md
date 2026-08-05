# motion — b-roll motion graphics

Motion-graphics klipovi za video skriptu (b-roll). Svaka scena je jedan HTML
fajl koji se renderuje frejm-po-frejm u Chromium-u i pakuje u mp4.

## Scene

| Scena | Format | Trajanje | Copy |
|---|---|---|---|
| `deficit-9x16` | 1080×1920, 30 fps | 9,0 s | „naravno da ću smršati jer logično više sam trošo nego što sam unosio" |

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
sama: bela pozadina, mastilo `#0a0c0b`, muted `#646b6f`, potrošnja/plava
`#0ea5e9`, unos/amber `#c98a1b`, brend teal `#17d1a8` za deficit, zeleni trend
`#0f9e80`. Tipografija je Inter (900/800/600), sr-Latn, zero-shame ton — bez
kaznene crvene.

Sadržaj stoji između ~96 px i ~846 px (od 960 CSS px visine), tako da gornji i
donji UI sloj Reels/TikTok-a ne prekriva ništa bitno.
