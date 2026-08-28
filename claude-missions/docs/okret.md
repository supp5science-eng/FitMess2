# Okret — avatar koji se vrti

> Stanje na 28.08.2026. **Klupa je živa na `/admin/okret`, slika radi, VIDEO NE.**
> Zaglavljeno na pozivu ka Veo-u. Ništa nije upaljeno za korisnike i ništa se ne
> čuva — cela stvar je i dalje proba, ne feature.

---

## Šta je ovo

Avatar na početnom ekranu koji korisnik **vrti prstom**, kao 3D model. Nije 3D.
Niz od 19 fotografija iste osobe iz uglova od −90° do +90°, koje se smenjuju dok
prevlačiš prst.

```
5–20 slika
    ↓
referentni portret          ← vernost lica (deli se sa klonom)
    ↓
JEDAN kadar po šablonu      ← svetlo siva pozadina, glava i ramena
    ↓
DVA orbit videa po 90°      ← jedan nos ulevo, jedan nos udesno
    ↓
frejmovi isečeni iz oba  →  video se BRIŠE
    ↓
19 slika (~800 KB) na telefonu, zauvek
```

---

## ⏭️ Šta ostaje ⬅️ ovde smo stali

### 1. Otkriti zašto video puca

Otvoriš `/admin/okret` na telefonu (treba `is_admin`), napraviš kadar (radi), pa
klikneš „Nos ulevo". Ako pukne, **trebaju dve stvari**:

- **Sivi tekst ispod crvene poruke** — sirov odgovor od Google-a. Tu je uzrok.
- **Šta piše u padajućoj listi modela** — imena i koja su zasivljena.

Tri moguća ishoda:

| Šta vidiš | Šta znači | Šta dalje |
|---|---|---|
| Lista prazna | Ključ nema pristup video modelima | Nov ključ ili uključena naplata. Kod tu ne pomaže. |
| Ima Veo model pod drugim imenom | Google ga je preimenovao | Izaberi ga u listi, ili upiši u `GEMINI_VIDEO_MODEL` |
| Lista puna, poziv i dalje puca | Oblik zahteva | Sirov odgovor kaže šta. Lestvica parametara (zamka 5) je već pokrila najverovatnije. |

### 2. Ako se ide na Omni

`gemini-omni-flash-preview` prima **1–5 referentnih slika** (Veo prima jednu), i
podržava doradu kroz više poteza. Ali ide na **Interactions API**
(`POST /v1beta/interactions`), koji ovde nije napisan.

Nije napisan namerno: oblik za kačenje slika nije potvrđen, a `ai.google.dev` je
blokiran sa build servera. Nagađanje se plaća po pokušaju.

**Najbrži put:** u Google AI Studio napravi bilo koji video sa slikom → „Get code"
→ pošalji taj isečak. Iz njega se putanja piše iz prve.

### 3. Kad video proradi

- Migracija: tabela `avatar_okret` + Supabase Storage bucket sa „samo svoji fajlovi"
- Sečenje frejmova se seli na server (sad je u pregledaču, kroz `<canvas>`)
- Ekran u nativnoj aplikaciji: `okret.ts` (čista logika + testovi) → komponenta na
  Reanimated worklet-u → kartica → na početnu
- `expo-image-picker` za ubacivanje slika (nativna zavisnost → nov dev build)

### 4. Otvoreno, po važnosti

- **Cena.** ~$0,73–1,47 po korisniku, jednom. Na hiljadu korisnika ~$1.500. To je
  poslovno pitanje pre paljenja, ne tehničko.
- **Tri minuta ne smeju biti ekran za učitavanje.** Posao ide u pozadinu posle
  registracije.
- **Pravnik.** Turnaround pravog lica je jasnije biometrija nego crtež.
  `docs/klon.md` to već vodi kao otvoreno.
- **v2 šablon nije potvrđen na slici.** Upisan je jer je v1 dokazano pogrešan.

---

## ✅ Šta je napravljeno

| Fajl | Šta radi |
|---|---|
| `src/lib/avatar/okret-prompt.ts` | **Likovni pravac — konstante.** Kadar, aparat i svetlo, odeća, oba smera orbita, spajanje frejmova. |
| `src/lib/ai/veo.ts` | Video na Gemini ključu. Otkrivanje modela, lestvica parametara, preuzimanje snimka. |
| `src/app/api/admin/okret/kadar/route.ts` | Slike → portret → kadar. **Ne čuva ništa.** |
| `src/app/api/admin/okret/orbit/route.ts` | Zakaži orbit / pitaj je li gotov. |
| `src/app/admin/okret/` | Klupa: prompt se menja bez deploya, frejmovi se seku u pregledaču, okret se vrti prstom. |
| `src/lib/avatar/__tests__/okret-prompt.test.ts` | 28 testova nad čistom logikom. |

**Promenljiva:** `GEMINI_VIDEO_MODEL` — ispravlja ime modela kad ga Google
preimenuje. Prazno = ugrađeni default (`veo-3.1-generate-preview`).

---

## 📌 Odluke, i zašto (da se ne prežvakavaju)

**Nije pravi 3D, i to je probano.** 24.08. je klon nacrtan kao četiri pogleda pa
propušten kroz image-to-3D. Lice preživi rekonstrukciju kao vosak. Referenca
izgleda fotografski zato što JESTE fotografija, pa kadrovi ostaju slike do kraja.

**Video je alat u fabrici, ne proizvod.** Postoji dva minuta na serveru i baca
se; aplikacija vidi samo slike. Dva razloga, oba nezamenjiva: pet nezavisno
generisanih uglova je pet malo različitih ljudi i iluzija pukne čim se prevuče
prst; i jedan snimak se plaća jednom, pa **broj uglova ne utiče na cenu**.

**Kadar je glava i ramena.** Varijante (od struka naviše, cela figura) su
obrisane, ne ostavljene „za svaki slučaj". Cena te odluke: avatar iz kog se ne
vidi telo ne može da pokaže napredak ni da nosi šablone odeće.

**Odeća se UZIMA sa fotografija** — obrnuto od klona, gde je izričito zabranjeno.
Izmišljena odeća izgleda generički i odaje sliku. Pravilo nosi jedna rečenica:
*„radije onaj komad koji najbolje VIDIŠ nego onaj koji ti se najviše SVIĐA"* —
bez nje model bira lepše, pa opet izmišlja, samo sa alibijem.

**Dva snimka po 90°, ne jedan od 180°.** Vidi zamku 3.

**Higgsfield se ne koristi.** Odluka korisnika, 28.08. Sve ide na Gemini ključ.

---

## ⚠️ Zamke — nađene na teži način

**1. Ključ u Expo aplikaciji je javan ključ.** Sve pod `EXPO_PUBLIC_*` je u
binarnom fajlu i vadi se iz IPA za pet minuta. Za Supabase je to u redu (RLS ga
pokriva); za Gemini nije. **Generisanje ostaje na serveru, bez izuzetka** — i
zato ruta živi u `claude-missions`, a ne u nativnoj aplikaciji.

**2. Pozadina nije bela nego SVETLO SIVA.** v1 je tražio *„pure white, no
gradient"*, što modelu kaže „izrezan lik na belom" i vraća nalepnicu umesto
fotografije. Referenca je bešavni sivi papir sa blagim padom ka uglovima. Ovo je
bio najveći pojedinačni uzrok promašaja.

**3. Kod slike-u-video ULAZNA SLIKA JE NULTI FREJM.** Zato je luk „od 45° levo do
45° desno" nemoguć — kamera ne može da krene sa −45° kad snimak počinje tačno
tamo gde je fotografija. Model to razreši jedino kako može: ode do profila pa se
VRATI. Mereno na snimku od 10s: ~3,5s okreta, ~2s povratka, ~4,5s stajanja —
upotrebljiva trećina, i to samo na jednu stranu.

Zato dva snimka sa iste fotografije. Druga dobit je veća od prve: **prava
fotografija završava u SREDINI niza**, pa je najdalji kadar 90° od sidra umesto
180°. Duplo manje drifta na najgorem mestu, besplatno.

**4. NA GEMINI KLJUČU POSTOJE DVA PROTOKOLA ZA VIDEO.** Veo ide na
`models/<ime>:predictLongRunning`; Omni NE — on ide na `/v1beta/interactions`.
Poslati Omni na predictLongRunning vrati `404 ... is not found for API version
v1beta`, što svakog ubedi da modela nema na ključu — a ima ga, samo govori drugim
jezikom. Lista modela zato nosi `radiOvde`, čitano iz `supportedGenerationMethods`.

**5. Jedan nepodržan parametar obara CEO poziv.** `aspectRatio`, `resolution`,
`negativePrompt`, `generateAudio`, `personGeneration` — svaki zavisi od modela i
verzije, i bilo koji vrati `400 INVALID_ARGUMENT` koji ne kaže ko je kriv. Zato
lestvica: pun zahtev → bez Vertex pojmova → samo aspectRatio → goli minimum.
Silazi se **samo na 400** (404/403/429 se ponavljanjem neće popraviti).

**6. Negativni prompt je zabranjivao sivu pozadinu koju šablon traži.** Dve
instrukcije koje se tuku, i to se plaća celim jednim snimkom pre nego što se
primeti. Test to sada drži.

**7. Premotavanje videa nema povratnu vrednost.** `currentTime = t` samo *traži*
premotavanje; crtanje odmah posle dodele vraća prethodni kadar. Dobiješ niz sa
duplikatima i pomisliš da model pravi iste uglove. Čeka se `seeked`, jedan po
jedan.

**8. Nulti frejm snimka JESTE ulazna fotografija.** U spojenom nizu ona već stoji
u sredini, pa se iz oba snimka preskače — inače se ista slika pojavi tri puta
zaredom i skrol na sredini za tren „zastane".

---

## 🧪 Šablon se menja bez deploya

Konstanta u `okret-prompt.ts` je izvor istine za korisnički tok. Ali klupa ima
polje za prepis: menjaš tekst, pustiš, gledaš — krug se zatvori za minut.
**Kad tekst legne, prepisuje se U KONSTANTU**, i korisnički tok ga odatle čita.

Promptovi na engleskom, za ručno testiranje u Google Flow, stoje u biblioteci
šablona (link u chatu 28.08.). Otvoreno pitanje: da li engleski osetno bolje
pogađa kadar od srpskog. Ako da — konstanta se prevodi.

---

## 💰 Cena i trajanje, po korisniku

| Korak | Štedljivo | Preporuka |
|---|---:|---:|
| Referentni portret | preskočen | $0,134 |
| Kadar | $0,134 | $0,134 |
| Dva orbita, 2×6s 720p | $0,60 | $1,20 |
| Sečenje + čuvanje | $0 | ~$0 |
| **Ukupno, jednom** | **$0,73** | **$1,47** |

**Trajanje:** ~3 minuta ukupno. Portret 20–40s, kadar 20–40s, **oba orbita
paralelno** 1–3 min (kreću sa iste slike, ne zavise jedan od drugog), sečenje
5–10s.
