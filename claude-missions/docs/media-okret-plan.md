# Media — avatar koji se okreće

> Plan na 29.08.2026, pisan **posle merenja nad dva prava snimka** koja je
> vlasnik napravio istog dana (`~/Videos/Camera_orbits_*_202608291542/1543.mp4`).
> Merenje nije potrošilo nijedan kredit. Tri nalaza menjaju ono što piše u
> `okret.md`, a jedan je nov i odlučuje kako se seku frejmovi.

Nasleđuje `okret.md` (fabrika) i zamenjuje `pocetna-avatar.md` (mesto na ekranu)
— avatar više ne ide na Početnu nego u **svoj tab**.

---

## Tok, kako je zamišljen

```
5–10 slika koje korisnik izabere
    ↓
Nano Banana Pro  →  JEDNA slika: glava i ramena, svetlo siva pozadina
    ↓                              ← ovo je "kadar", i on je SIDRO
Veo  →  dva snimka po 8s sa istog kadra: jedan nalevo, jedan nadesno
    ↓
frejmovi se vade iz oba, snimci se BRIŠU
    ↓
~19 slika · prst levo-desno · korisnik vidi sebe kao 3D
```

Živi pod **Media**, kao četvrti tab u donjoj navigaciji.

---

## ✅ Šest stvari izmerenih danas

### 1. Blokada od 28.08. nije bila u kodu

`veo.ts` je slao ispravan zahtev. Google je vraćao:

```
429 RESOURCE_EXHAUSTED — "Your prepayment credits are depleted."
```

Lestvica parametara u `veo.ts` silazi **samo na 400**, pa nikad nije ni imala
šta da popravi. Ključ ima Veo pristup pod imenom koje kod već koristi:
`veo-3.1-generate-preview`, `-fast`, `-lite`, sva tri sa `predictLongRunning`.
Tabeli u `okret.md` fali četvrti red: **kredit potrošen.**

### 2. ⚠️ Zamka 3 iz `okret.md` NE VAŽI za ove snimke

`okret.md` tvrdi: model ode do profila pa se **vrati**, i upotrebljiva je
trećina snimka. Mereno na oba snimka — **to se ne dešava.**

Oba su 8s, 24 fps, 192 frejma, 720×1280. Oba idu **čistim zamahom od lica do
punog profila kroz svih 8 sekundi**, i tu ostaju. Nema povratka, nema stajanja.

I idu u **suprotnim smerovima** — jedan pokazuje jedan profil, drugi drugi.
Zajedno daju punih **180°**, sa pravom fotografijom u sredini. To je tačno ono
što plan traži, i upotrebljivo je ~3× više frejmova nego što je doc pretpostavio.

**Zašto je ranije ispalo loše, a sad dobro:** ne zna se pouzdano. Verovatno
prompt („orbit oko subjekta" umesto luka sa zadatim početkom i krajem). Ali
snimci postoje i mere se, pa je to sada činjenica a ne pretpostavka — i prompt
koji ih je napravio je ono što ide u konstantu.

### 3. Nulti frejm JESTE ulazna slika — potvrđeno

Prvi frejm oba snimka je kadar, preskaliran. Zamka 8 važi: **frejm 0 se
preskače u oba snimka**, kadar ulazi jednom, u sredinu niza.

### 4. Pozadina nije bela — i tvoja referenca to potvrđuje

Izmereno na tvojoj slici: **`#DFDFE0`**. To je svetlo siva, ne bela (`#FFFFFF`).

Znači nema sukoba između „hoću belu da se uklopi u temu" i odluke iz `okret.md`
(„pozadina je svetlo siva, bela vraća nalepnicu umesto fotografije). **Slika
koja ti se dopala JE svetlo siva.** Konstanta ostaje kakva jeste.

### 5. ⚠️ NOVO, i najvažnije: okret nije ravnomeran u vremenu

Mereno preko širine glave u pikselima (pozadina je ravnomerna, pa je silueta
merljiva bez ikakvog modela):

| frejm | 0 | 24 | 72 | 96 | 128 | 160 | 184 |
|---|---:|---:|---:|---:|---:|---:|---:|
| širina glave (px) | 90 | 90 | 93 | 95 | 98 | 101 | 104 |
| ugao (procena) | 0° | 0° | ~19° | ~32° | ~51° | ~71° | 90° |

**Prva polovina snimka pređe ~32°, druga ~58°.** Model ubrzava — ease-in,
otprilike 1:2.

Posledica: ako se frejmovi seku **na jednak vremenski razmak**, uglovi ispadnu
neravnomerni, i prevlačenje prstom se oseti kao da se lik **zaglavi na licu pa
odjuri u profil**. To je tačno ona vrsta greške koja obori iluziju, a u kodu se
ne vidi — sve „radi".

**Rešenje:** frejmovi se biraju **po uglu, ne po vremenu.** Ugao se procenjuje
širinom siluete — čista piksel-matematika nad izvučenim frejmovima, bez modela i
bez ijednog dodatnog poziva.

⚠️ Poštenja radi: širina glave je *proxy*, ne merenje ugla. Korak od 1 px ≈ 6°,
pa signal treba zagladiti (npr. fit monotone krive kroz sve frejmove umesto
čitanja frejm po frejm). Dovoljno dobro, ali nije egzaktno — i to se dokazuje
u fazi 0, besplatno.

### 6. Nav ima slobodno mesto

Na ovoj grani je Jarvis uklonjen, pa `bottom-nav.tsx` ima tri taba:
`/danas`, `/analitika`, `/profil`. **Media ide na četvrto mesto** — ništa se ne
izbacuje i ništa se ne pomera.

---

## 🤔 Veo, ne Omni

Rekao si Omni. Predlog je **Veo**, iz jednog konkretnog razloga:

Omni prima **1–5 referentnih slika**; Veo prima **jednu**. Ali ovaj tok šalje
**tačno jednu** — kadar. Prednost Omnija se ovde ne koristi ni za šta, a cena
je: nov endpoint (`/v1beta/interactions`) koji nije napisan, oblik tela koji
nije potvrđen, i `ai.google.dev` blokiran sa build servera. Svako nagađanje se
plaća po pokušaju, a imamo osam pokušaja ukupno.

Veo je već napisan, već dokazan na ključu, i **tvoja dva snimka su verovatno
njegova** — `encoder=Google`, imenovanje kao iz Google Flow-a.

Ako se kasnije pokaže da Omni bolje drži lice, prelazak je jedna funkcija —
ali ne sada, ne sa $10.

---

## 💰 Budžet: $10

| korak | cena | koliko staje u $10 |
|---|---:|---:|
| kadar (izgled, pozadina, odeća, kadriranje) | $0,13 | **~70** |
| dva orbita, pun model | ~$1,20 | ~8 |

**Pravilo: izgled se šteluje na kadru, okret se plaća tek kad kadar legne.**
Obrnutim redom se $10 spali na osam pokušaja, a ne zna se je li kriv prompt,
model ili sečenje.

**Poluga koja se prvo proba:** `veo-3.1-lite-generate-preview` i `-fast`. Okret
kamere je jednostavan pokret bez radnje — ako lite drži lice, cena po korisniku
pada osetno. To je **prvi plaćeni test**, ne pun model.

---

## 🔨 Redosled — prve dve faze ne troše ništa

### Faza 0 — cela klijentska strana, nad snimcima koje VEĆ IMAŠ · **$0**

Ovo je najveći deo posla i **ceo se završava bez ijednog kredita**, jer dva
prava snimka postoje na disku.

- `lib/avatar/okret.ts` — čista logika: prst → frejm, sidro u sredini, otpor na
  krajevima niza, zamah, povratak. Testovi.
- `lib/avatar/uglovi.ts` — procena ugla iz siluete + izbor ~19 frejmova po
  **jednakom uglu**. Testovi nad izmerenim brojevima iz nalaza 5.
- Sečenje frejmova (čeka se `seeked`, jedan po jedan — zamka 7), preskakanje
  nultog frejma u oba snimka (zamka 8), spajanje u jedan sprite.
- Komponenta trake, vrti se prstom.

**Kraj faze 0:** na `/admin/okret` se prstom vrti **pravi okret napravljen od
tvojih snimaka.** Tu se vidi je li iluzija dobra — pre nego što je plaćena.

### Faza 1 — kadar · **~$0,13 po pokušaju**

Prompt za kadar se šteluje na klupi (polje za prepis postoji, menja se bez
deploya). Kad slika legne, tekst se prepisuje **u konstantu**.

Cilj: slika neodvojiva od tvoje reference — glava i ramena, `#DFDFE0` pozadina,
odeća uzeta sa fotografija, bez ulepšavanja.

### Faza 2 — prvi plaćeni orbit · **~$0,30–0,60**

Jedan snimak, `lite`. Provuče se kroz gotov lanac iz faze 0. Ako lice preživi —
ostajemo na lite i cena po korisniku pada. Ako ne — `fast`, pa pun.

⚠️ Ovde se otkriva i traje li `durationSeconds: 8` na ovom API-ju. Tvoji snimci
su 8s i ceo luk im treba; 6s možda ne stigne do profila. Parametar ide **na dno
lestvice** u `veo.ts`, da ne obori poziv ako ga model ne prima.

### Faza 3 — drugi smer i spajanje · **~$0,30–0,60**

Drugi orbit, spajanje u niz od 180°, sud nad celinom.

### Faza 4 — feature · **$0 za AI**

Tab „Media", tabela + Storage bucket sa „samo svoji fajlovi", sečenje se seli
na server, ekran.

⚠️ **Ide zajedno sa pravnim delom.** Politika privatnosti već javno obećava
četiri stvari koje kod ne radi (slike se čuvaju uz nalog · pristanak pre slanja ·
povlačenje pristanka · brisanje i preuzimanje u „Moji podaci"). Turnaround pravog
lica je jasnije biometrija nego crtež. Ovo se ne pušta korisnicima dok tekst i
kod ne kažu istu stvar.

---

## ⚠️ Zamke koje i dalje važe

Iz `okret.md`, nepromenjeno: ključ ostaje **na serveru** (`EXPO_PUBLIC_*` se vadi
iz IPA za pet minuta) · pozadina svetlo siva, ne bela · dva protokola za video na
istom ključu · jedan nepodržan parametar obara ceo poziv · negativni prompt ume da
zabrani pozadinu koju šablon traži · `currentTime = t` nema povratnu vrednost.

**Novo, iz ovog kruga:**

- **429 ≠ bag.** Pre svake debug sesije nad AI featureom: jedan `curl` na
  najjeftiniji model. Košta sekundu, štedi popodne.
- **Ravnomerno vreme ≠ ravnomeran ugao.** Vidi nalaz 5.
- **Tri minuta nisu ekran za učitavanje.** Posao ide u pozadinu; korisnik dobija
  kadar odmah, okret kad stigne. Kadar je srednji frejm niza, pa se slika kad
  okret stigne **ne pomeri ni za piksel** — nema skoka u rasporedu.

---

## ❓ Tvoje odluke

1. **Kad se plaća okret?** Predlog: **ne na registraciji.** Levak kaže da se
   ljudi ne vraćaju drugog dana; ~$1 po čoveku koji ode sutra je najgori mogući
   raspored troška. Kadar odmah (jeftin), okret tek na signal da je ostao —
   treći dan ili prvo merenje. Jedna `if` linija, razlika između $1 po
   *registrovanom* i $1 po *stvarnom* korisniku.

2. **Vidi li avatara još neko?** Ako je samo korisnikov, ovo je lep feature. Ako
   ide na share karticu obroka, postaje i način da app govori o sebi bez tebe
   pred kamerom. To menja šta se čuva i u kojoj rezoluciji — pa je bolje znati
   sada nego posle migracije.
