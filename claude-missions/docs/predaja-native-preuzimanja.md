# Predaja: preuzimanja i offline u native ljusci (Agent B → native/config)

Datum: 2026-08-09. Prati `docs/izlazak-u-store.md`, tačke 3.1 (offline ekran) i
4.3 (preuzimanja fajlova u webview-u).

Web strana je gotova i puštena. Native strana je **sve što je ostalo** i sva je
u fajlovima koje drži glavni agent (`package.json`, `capacitor.config.ts`,
`android/`, `ios/`). Ovaj dokument je tačan spisak — ništa se ne pogađa.

---

## 1. Dva plugina, jedan `npm i`

```
npm i @capacitor/filesystem@8.1.2 @capacitor/share@8.0.1
npx cap sync
```

Verzije provereno u npm registru **2026-08-09**:

| Plugin | Verzija | `peerDependencies` | Instalirani `@capacitor/core` |
| --- | --- | --- | --- |
| `@capacitor/filesystem` | 8.1.2 | `@capacitor/core >=8.0.0` | 8.5.0 ✅ |
| `@capacitor/share` | 8.0.1 | `@capacitor/core >=8.0.0` | 8.5.0 ✅ |

Oba su zvanična Capacitor plugina i oba traže samo `cap sync` — **nema ručnog
koraka u Xcode-u ni u Android Studiju**, nema novih dozvola u `Info.plist` ni u
manifestu (deljenje fajla iz keša ne traži nijednu).

**Web kod ih ne uvozi.** Nijedan `import` iz ova dva paketa ne postoji u
`src/`, namerno: u remote režimu plugin JS je samo tanak omotač oko mosta koji
ljuska ionako ubrizga u stranu, pa se pluginovi zovu preko
`window.Capacitor.Plugins` (`src/lib/native/capacitor-bridge.ts`). Posledica
koja je ovde bitna: **web build radi i pre nego što se pluginovi dodaju**, i
`package-lock.json` ostaje netaknut od moje strane. Kad ih dodaš i sinhronizuješ,
kod ih zatekne i sam počne da ih koristi — bez ijedne izmene u `src/`.

## 2. Jedan red u `capacitor.config.ts`

```diff
   server: {
     url: "https://fitmess.app",
     androidScheme: "https",
+    /**
+     * Hladan start bez mreže: web view ne može da dovuče ni prvu stranu, pa bi
+     * pokazao sistemsku grešku (`net::ERR_INTERNET_DISCONNECTED`). Ovo je
+     * zamenjuje brendiranom stranom iz `webDir`. Android-only u Capacitoru 8 —
+     * iOS pokriva `public/offline.html` preko servisnog radnika, kad je bar
+     * jednom bio online.
+     */
+    errorPath: "index.html",
   },
```

`webDir` je `capacitor/www`, a `capacitor/www/index.html` je već tu (tvoj rad iz
`570daf2`) — samo ga ništa nije prikazivalo, jer `errorPath` nije bio postavljen.
Test drži da ta strana i `public/offline.html` govore **isti tekst**, pa ako
menjaš kopiju na jednom mestu, test će te odmah upozoriti na drugo.

## 3. Šta da proveriš kad prvi build stigne na uređaj

Nemam Android telefon (potvrđeno sa korisnikom), pa je ovo jedini deo koji
ostaje neproveren na stvarnoj stvari. Redom, na Androidu:

1. `/profil/moji-podaci` → **Preuzmi PDF** → mora se otvoriti sistemski share
   sheet. Ako se ne otvori ništa — pluginovi nisu u buildu, i tada dugme mora
   ispisati „Ova verzija aplikacije ne ume da sačuva fajl…". Prazan ekran bez
   poruke znači da nešto treće ne valja i vredi ga prijaviti.
2. Isto i za tihi `.json` link ispod.
3. Kartica obroka → **Podeli**. Dugme mora pisati „Podeli" (ne „Sačuvaj").
4. Avionski režim pa tap po app-i → traka „Nema veze sa internetom".
5. Avionski režim pa **hladan start** app-e → brendirana strana, ne sistemska
   greška. Ovo je jedino što zavisi od `errorPath` iz tačke 2.

Na iOS-u su 1–3 očekivano radili i pre (WKWebView ima Web Share), ali sad idu
istim putem kao Android, pa vredi proći isti spisak.

---

## Odgovor na tačku 4.4 „za proveru" (`navigator.share`)

Vodila se kao nepotvrđena. Zatvaram je: **jeste problem, i to veći nego što je
zapisano** — ali samo na Androidu.

- **iOS / WKWebView:** Web Share API postoji, share kartica prolazi. Nije bio
  problem.
- **Android / system WebView:** `navigator.share` **ne postoji**. Kod je zato
  padao na `blob:` + `a.download`, a WebView bez `DownloadListener`-a taj klik
  **ignoriše — bez fajla i bez greške**. Pogađalo je ovo:
  - `src/components/settings/export-download-button.tsx` (izvoz .json i PDF)
  - `src/components/share/share-meal-sheet.tsx` (kartica obroka) — jedini
    korisnik `web-share.ts`; dugme je uz to pisalo „Sačuvaj" umesto „Podeli",
    jer se labela računa iz `canShareFiles`. Sad odgovara tačno.

  **Prizma nije pogođena**, iako izgleda tako: njen `URL.createObjectURL`
  (`dodaj/najtacnije/flow.tsx`) pravi `<img>` pregled izabrane fotografije, a
  ne preuzimanje. Isto važi za `use-scan-card.ts`. Ostaju samo dva mesta gore.

Rešeno kroz `@capacitor/share`, dakle **istim pluginom iz tačke 1** — nema
dodatnog troška, samo ta dva plugina pokrivaju i preuzimanja i share kartice.

Nije proveravano (ostaje u 4.4): barcode skener, Supabase auth kolačići kroz
restart ljuske.

## Jedno svesno ograničenje

Ako pisanje fajla stvarno pukne (nema mesta na telefonu), **izvoz** ispiše
poruku, a **share kartica** samo ostane na „Podeli" i upiše razlog u konzolu —
list obroka nema mesto za tekst greške, a deljenje kartice je radnja koja se
bezbolno ponavlja i ništa se ne gubi. Ako želiš i tu poruku, to je nova linija
u `share-meal-sheet.tsx` i mogu je dodati.

## Šta je već urađeno na web strani (ne dira te, informativno)

- `src/lib/native/capacitor-bridge.ts`, `src/lib/native/save-file.ts` — pisanje
  u keš + sistemski share sheet, sa tri odgovora umesto izuzetka
  (`saved` / `cancelled` / `unsupported`).
- `src/components/settings/export-download-button.tsx` — ljuska prva, pa web
  putevi; ako ništa ne može, **kaže to naglas** umesto da ćuti.
- `src/lib/share/web-share.ts` — isto za share kartice (obrok, Prizma).
- `public/offline.html` + `public/sw.js` — offline strana umesto keširane
  marketinške landing strane.
- `src/middleware.ts` — `offline.html` izuzet iz matchera (inače bi phone gate
  307-ovao precache i offline ekran bi postao „otvori na telefonu").
