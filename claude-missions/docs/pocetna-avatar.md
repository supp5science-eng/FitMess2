# Početna sa avatarom — plan ekrana

> Plan od 28.08.2026. **Ništa od ovoga nije napisano.** Ovo je odluka o tome
> gde avatar stoji na `/danas`, šta ga to košta i kojim redom se pravi.
> Kako se avatar PRAVI stoji u [`okret.md`](./okret.md) — ovaj dokument počinje
> tamo gde taj završi: 19 slika postoji, sad ih treba negde staviti.

---

## Prva stvar koja se mora znati

**Početna je puna.** Nije „ima mesta gore" — nema ga. Odozgo naniže:

```
logo + streak                 ← layout.tsx, PERZISTENTAN
točak sa datumima             ← layout.tsx, PERZISTENTAN
─────────────────────────────── ovde počinje page.tsx
„Dnevni unos"
pager sa tri strane           ← prstom levo-desno
   1. prsten + makroi + Gric
   2. Voda + Trening
   3. Mikronutrijenti + ocena
„Obroci danas" + lista
```

Na telefonu od 667pt (SE) prsten je već jedva iznad pregiba. Svaki piksel koji
avatar uzme, prsten plaća. To nije razlog da avatara nema — to je razlog da se
unapred zna koliko sme da košta, i da se to meri, a ne procenjuje.

---

## ⚠️ Tri zida u koje se udara, nađena u kodu pre nego u aplikaciji

### 1. PRST LEVO-DESNO JE VEĆ ZAUZET. Dvaput.

Točak sa datumima je horizontalni skrol. Pager je horizontalni skrol sa
`scroll-snap` i `snap-always`. Avatar se vrti — horizontalnim prevlačenjem.
To je **treći** horizontalni gest na istom ekranu.

Posledica koja se ne pregovara: **avatar NE SME unutra u pager.** Pager je
jedan skrol kontejner sa `touch-action: pan-x pan-y`; prevlačenje koje krene sa
avatara unutar njega ili okrene stranu umesto avatara, ili se avataru mora dati
`touch-action: none` — čime najveći deo strane prestaje da prevrće strane, a
ljudi prevlače odakle stignu. Oba ishoda su kvar.

Avatar dobija **svoju vodoravnu traku**, van pagera, u kojoj je horizontalni
gest samo njegov.

### 2. `/danas` se REMONTUJE na svaku promenu dana

`page.tsx` renderuje `<HomeScreen key={selectedKey} />`. Ključ po danu znači:
prebaciš dan na točku → ceo `HomeScreen` se montira iz početka. Avatar unutra
znači 19 slika koje se iznova dekodiraju svaki put kad neko prelistava dane.

Avatar zato ide u **`layout.tsx`**, gde već žive logo, streak i točak — jedini
deo ekrana koji preživljava promenu dana. To se poklapa i sa značenjem: avatar
nije činjenica o danu.

### 3. Fotografija u graviranoj temi izgleda kao tuđa

Tema je jedna („Gravira"): ultramarin na bledom papiru, halftone tačkice,
letterpress podizanje umesto meke senke. Avatar je **prava fotografija na
svetlo sivoj bešavnoj pozadini** — i to je razlog zašto uopšte radi (`okret.md`,
odluka „nije pravi 3D").

**Odluka: fotografija ostaje fotografija.** Ne duotone, ne halftone preko lica.
Duotone bi bacio jedino svojstvo zbog kojeg je ovaj put pobedio mesh.
Gravira se drži **okvira**: `.fm-lift` kartica, `.fm-halftone` iza, siva
pozadina iz šablona štimovana uz `--paper`. Papir je graviran, lik nije.

Iz istog razloga se **pozadina ne uklanja** po frejmu. Siva bešavna pozadina je
bila LEK za izgled nalepnice (zamka 2 u `okret.md`); 19 izrezanih likova na
belom papiru je 19 prilika da se nalepnica vrati. Avatar je namerno
pravougaona fotografija u podignutoj kartici.

---

## 📐 Predlog rasporeda

```
logo + streak                 ← ostaje netaknuto
točak sa datumima             ← ostaje netaknut
┌───────────────────────────┐
│  AVATAR — traka, ~170pt   │ ← novo, u layout.tsx, prst ga vrti
└───────────────────────────┘
„Dnevni unos" + pager         ← ostaje netaknuto
obroci
```

**Zašto ispod točka, a ne iznad:** gornja dva reda su ekran koji ljudi već
znaju. Menjati ih znači platiti i navikavanje i avatara odjednom. Avatar ulazi
kao ulaz u sadržaj dana, na jednom jedinom novom mestu.

**Zašto traka, a ne heroj preko pola ekrana:** kadar je glava i ramena
(odlučeno, `okret.md`). Avatar ne može da pokaže telo, pa ne može da pokaže
napredak. Ono što on radi je **prisustvo** — „ova aplikacija zna ko sam" — a
prisustvo ne traži pola ekrana. Prsten i dalje mora da bude prva stvar koju
čovek PROČITA, čak i kad je avatar prva koju VIDI.

**Tvrdo merilo, ne procena:** gornja ivica prstena mora ostati iznad pregiba na
667pt visine. Ako ne ostane, traka se smanjuje ili se skuplja pri skrolu — ne
prsten. Ovo se meri na uređaju pre nego što traka ide korisnicima.

### Nosivost: avatar je DODATAK, nikad noseći deo

Početna mora da izgleda dovršeno i **bez** trake. Tri nezavisna razloga, svaki
dovoljan sam:

- $0,73–1,47 po korisniku znači da se možda pali samo nekim korisnicima
- pravnik može reći ne (turnaround pravog lica; `klon.md` to već vodi kao otvoreno)
- čovek sme da ga isključi, i to mora da postoji od prvog dana

Zato traka nikad ne nosi broj, dugme ni obaveštenje. Ako išta od toga završi u
njoj, ekran bez avatara postaje ekran kome nešto fali.

---

## 🎬 Tri stanja, i trik koji ubija skok u rasporedu

Generisanje traje ~3 minuta i ide u pozadini posle registracije. Traka zato ima
stanja — ali **ne i „prazno stanje"**.

| Stanje | Šta se vidi | Zašto tako |
|---|---|---|
| Nema avatara | **Trake nema.** Ponuda stoji u onboardingu i u Podešavanjima. | Mrtva reklamna kutija na početnoj je porez koji plaćaju svi, zauvek. |
| Pravi se | **Kadar** — jedna slika, bez vrtnje, tiho „okret se pravi". | Kadar stigne za ~40s, orbit tek za ~3min. |
| Spreman | Ista slika, sad se vrti. | ↓ vidi ispod |
| Puklo | Ostaje kadar, zauvek i tiho. Greška živi u Podešavanjima. | Početna nije mesto za naš kvar. |

**Ovde je najbolja stvar u celom planu:** kadar JESTE srednji frejm konačnog
niza (`okret.md`: prava fotografija završava u sredini). Znači slika se pri
prelasku iz „pravi se" u „spreman" **ne menja ni za piksel** — pojavi se samo
mogućnost da se okrene. Nula skoka u rasporedu, nula lažnog procenta, nula
praznog pravougaonika koji čeka.

**Kako se uči da se vrti:** prvi put kad je spreman, avatar se sam okrene ~15°
i vrati. Jednom. Mehanika za to već postoji i skupo je plaćena —
`components/home/once-a-day.ts`, dva sloja pamćenja jer keširani RSC payload
ume da pusti isti trenutak po deset puta.

---

## 🎛️ Kako se vrti — i šta je čista logika

Po pravilu repoa (`AGENTS.md`, money-math), svaki broj koji UI pokaže računa se
u čistoj, testiranoj funkciji. Vrtnja nije izuzetak.

**Novo: `src/lib/avatar/okret.ts`** (+ testovi pored njega)

| Funkcija | Šta rešava |
|---|---|
| `frejmIzPrevlacenja(pocetni, dxPx, sirinaPx, brojFrejmova)` | prst → indeks frejma |
| `sidro(brojFrejmova)` | srednji frejm = prava fotografija (9 od 19) |
| `zauzdaj(indeks)` | **niz se NE vrti ukrug** — −90°..+90° ima dva kraja |
| `otporNaKraju(prekoracenje)` | kraj se oseti kao kraj, ne kao kvar |
| `smirenjePosleZamaha(brzina)` | zamah → klizanje → naleganje na frejm |
| `povratakNaSidro()` | posle ~2s mirovanja, meko nazad na sidro |

`povratakNaSidro` nije ukras: frejmovi 0 i 18 su 90° od sidra i nose najviše
drifta. Avatar koji miruje treba da miruje na pravoj fotografiji, ne na
najslabijoj.

**Ovo se može napisati i testirati danas** — ne čeka Veo. Radi nad 19 bilo kojih
slika. To je jedini deo posla koji trenutno nije zaglavljen.

### Slike: jedan sprite, ne 19 zahteva

19 × ~42 KB. Kao 19 `<img>` tagova: 19 zahteva, 19 dekodiranja, i klasična
greška — prvi prelazak prstom trza jer se frejmovi dekodiraju tek kad zatrebaju.

**Jedna slika, mreža 4×5, koračanje kroz `background-position`.** Jedan zahtev,
jedno dekodiranje, prelaz bez trzaja. Sečenje ionako ide na server (`okret.md`,
korak 3), pa se sprite sklapa tamo, jednom, a ne na telefonu.

### Pristupačnost i mirovanje

- `prefers-reduced-motion` → statično sidro, bez samo-okreta na uvod
- čitač ekrana vidi **jednu** sliku, `alt="Tvoj avatar"`; ostatak `aria-hidden`
- iza gesta nema NIJEDNE informacije — to je i razlog zašto traka ne nosi brojeve

---

## 🔨 Redosled

| # | Šta | Čeka Veo? |
|---|---|---|
| 1 | `lib/avatar/okret.ts` + testovi | **ne** |
| 2 | `components/avatar/okret-traka.tsx` — sprite, prst, otpor, reduced-motion | **ne** (lažni sprite) |
| 3 | Tabela `avatar_okret` + Storage bucket „samo svoji fajlovi" + čitanje | ne |
| 4 | Sečenje i sklapanje sprite-a na serveru | **da** |
| 5 | Traka u `danas/layout.tsx` + stanja | posle 3 |
| 6 | Uvodni okret jednom (`once-a-day.ts`) | posle 5 |
| 7 | Podešavanja: sakrij · napravi ponovo · obriši | posle 3 |

Koraci 1 i 2 su prava količina posla i **ne zavise od toga da li video ikad
proradi**. Ako se sutra sedne, sedne se tu.

---

## 📌 Odluke, da se ne prežvakavaju

**Avatar je van pagera.** Treći horizontalni gest mora imati svoju traku.

**Avatar je u `layout.tsx`, ne u `page.tsx`.** Inače se 19 slika dekodira na
svaku promenu dana.

**Fotografija ostaje fotografija.** Gravira se drži okvira i papira.

**Pozadina se ne uklanja.** Siva bešavna pozadina je lek, ne problem.

**Nema praznog stanja na početnoj.** Nema avatara → nema trake.

**Traka ne nosi brojeve ni dugmad.** Ekran mora da bude ceo i bez nje.

**Niz se ne vrti ukrug.** −90°..+90° ima dva kraja i oni se moraju osetiti.

---

## ❓ Jedna stvar koja nije moja da odlučim

**Koliko avatar sme da košta ekran.** Plan iznad bira traku od ~170pt ispod
točka sa datumima. Dve druge mogućnosti su žive:

- **Čip u zaglavlju + pun ekran na dodir.** Avatar postoji kao krug od 40pt;
  vrtnja dobija ceo ekran, gde joj je najlepše i gde nema nijednog
  konkurentskog gesta. Košta nula piksela početne. Plaća se time što se avatar
  ne vidi dok ga ne potražiš.
- **Avatar preuzima vrh ekrana** — portret iza loga, streaka i točka, papir se
  preliva preko njega. Najlepše i najskuplje: tekst preko fotografije, i gornji
  red koji ljudi znaju se menja. Razmotreno, odloženo — ne za prvu verziju.

Ako traka od 170pt obori prsten ispod pregiba na SE, prvi rezervni potez je
**skupljanje pri skrolu**: pun portret na vrhu, pa se skuplja u čip od 40pt u
zaglavlju kad se skroluje ka obrocima.

---

## 🔬 Kako ćemo znati da je vredelo

Jedno pitanje, i postavlja se pre nego što traka postane trajna:
**da li iko okrene avatar drugi put?**

Ako se okrene jednom prvog dana i nikad više, traka se skuplja na čip a vrtnja
seli na pun ekran. To se zapisuje sada, dok još nije muka — da se za tri meseca
ne raspravlja o istoj stvari sa nulom podataka.
