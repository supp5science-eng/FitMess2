# SEDEFJE — svet, likovi i stil FitMess-a

> Radni dokument za redizajn UI-a i za izgradnju sopstvenog sveta maskota.
> Verzija 0.1 · avgust 2026 · sr-Latn, "ti", zero-shame.

---

## 0. Odakle sve kreće — logo nam je već dao svet

Naš znak je **sedefna kruška sa zagrizom**. U njemu su tri stvari koje niko
drugi u fitness kategoriji ne može da uzme, jer su bukvalno naše:

1. **Sedef se pravi u slojevima.** Školjka nanosi po jedan tanak sloj. Slojevi
   nikad nisu savršeni — i baš zato sedef prelama svetlost i sija. Savršeno
   ravan sloj bi bio mutan.
   → **Nesavršeni slojevi prave sjaj.** To je *Mess* iz imena FitMess.
2. **Zagriz.** Fali komad. To nije oštećenje — to je početak. Svet je nastao iz
   zagriza.
3. **Sve lebdi.** UI brief već kaže "sve lebdi" (`--fm-lift`, aurora podloga,
   `oblak` oko prstena). Znači svet je arhipelag koji lebdi.

**Svet u jednoj rečenici:**
*Sedefje je svet koji se ne gradi odjednom, nego u slojevima — po jedan dnevno —
i sija baš tamo gde sloj nije bio savršen.*

Sve ostalo u ovom dokumentu je izvedeno iz te rečenice.

---

## 1. Mitologija (kratka, jer mora da stane u 15 sekundi videa)

- Postojala je jedna Kruška. Neko ju je **zagrizao**. Iz zagriza je iscurila
  svetlost i od nje je nastalo Sedefje.
- Svetlost se ne može držati u ruci — hvata se samo u **slojevima**. Stanovnici
  svaki dan nanesu po jedan sloj sedefa.
- **Preskočen dan ne razbija ništa.** Taj sloj je samo tanji.
- **Nedelja je jedinica.** Sedam slojeva se u nedelju uveče zatvore u jedno
  **zrno**. Zrna se nižu u **Nisku**.

Direktno mapiranje na kod koji već imamo:

| Svet | Proizvod |
|---|---|
| sloj | `logs` — dan sa unosom |
| zrno | `lib/week/summary.ts` — nedeljni rezime |
| niska | `lib/streak` — "Niz" (na srpskom *niska* i jeste ogrlica) |
| sjaj kroz zagriz | progres ka cilju |
| Svetionik | `/analitika` |

---

## 2. Mapa — Sedmica

Sedam ostrva koja lebde u auroralnom nebu. Ovo daje `date strip`-u pravo
značenje: ti ne skroluješ datume, ti **ploviš nedelju**.

| Dan | Ostrvo | Šta je |
|---|---|---|
| Ponedeljak | **Luka** | polazak, pakuje se nedelja |
| Utorak | **Radionica** | tu se pravi ritam |
| Sreda | **Greben** | sredina, najveći uspon |
| Četvrtak | **Vetrenjača** | drugi vetar |
| Petak | **Trg** | narod, muzika, iskušenja |
| Subota | **Trpezarija** | ostrvo gozbe — **nije opasna zona**, jelo je deo plana |
| Nedelja | **Svetionik** | odavde se vidi cela nedelja; zrno se zatvara |

Subota kao Trpezarija, a ne kao "zamka", je celokupna naša filozofija u jednom
potezu dizajna.

---

## 3. DNK likova — pravila po kojima se sve crta

Da bi svet bio prepoznatljiv kao *jedan* svet, svi likovi dele šest pravila:

1. **Silueta.** Svako telo je varijacija **kruškaste kapi** — usko gore, teško
   dole. Mora da se prepozna na 24 px, u crnom, bez detalja.
2. **Zagriz.** Svaki lik ima zagriz — na ramenu, uvu, boku, repu. Niko se zbog
   njega ne izvinjava. *Svako ima svoj zagriz.*
3. **Materijal.** Spolja **mat keramika** (mlečna, blago zrnasta). Unutra
   **sedef**. Kroz zagriz se vidi unutrašnjost kako svetli.
4. **Sjaj = napredak.** Što je nedelja bolja, to unutrašnji sjaj jače pulsira
   kroz zagriz. Napredak je **svetlost, ne mišići.**
5. **Lice.** Dve tačke + jedan odsjaj. Usta se pojavljuju samo za četiri
   emocije: mir, radost, "hm", nežna briga. **Nema besa. Nema tuge.**
6. **Nema tela iz teretane.** Nema trbušnjaka, nema tegova, nema "pre/posle".
   Ovo nas razlikuje od praktično cele kategorije.

### Tehnika (brief za ilustratora)

Gvaš / riso zrno preko vektorskih formi. Dve teksture: mat zrno na telu +
sedefni gradijent (iz `--wordmark-grad`) na unutrašnjosti. Kontura promenljive
debljine, tanka, u boji tela — **nikad crna**. Meke, velike, niske senke.

### Anti-brief — šta NE radimo

- Ne 3D plastika u Pixar stilu — to radi svako.
- Ne flat vektor bez teksture — generično.
- Ne crvena za prekoračenje, ni u ilustraciji. Toplo zlato (`--chart-5`).
- Lik **nikad** ne prekoreva korisnika. Nikad "izgubio si niz".
- Nikad šala na račun kilaže, izgleda ili "cheat meal" krivice.

---

## 4. Postava — sedam vodiča (biraš jednog)

Izbor vodiča menja **glas app-a** (`/agent`), akcent boje, mikro-animacije i
share kartice. Sedam vodiča = sedam ostrva; svaki "drži" svoj dan.

### 1. PERA — kruška
Lice brenda i narator. Miran, suvo duhovit, nikad ne cvili. Ima najveći zagriz
od svih.
> *"Nedelja je jedinica. Dan je samo sloj."*
**Uloga:** onboarding, `/danas`, podrazumevani vodič.

### 2. ŽARKO — žar
Živo ugljevlje u sedefnoj ljusci. Kad preskočiš dan **ne gasi se** — samo
potamni i čeka da duneš.
> *"Nisam se ugasio. Samo sam tiši."*
**Uloga:** Niz (streak), amber tokeni.

### 3. KAPLJA — voda
Sramežljiva, hladna, brza. Govori u gutljajima, najkraće rečenice u svetu.
> *"Jedna čaša. Ne pregovaram."*
**Uloga:** voda.

### 4. ĐON — hodač
Telo mu je peta patike, izlizana s jedne strane. Ne ume da sedi.
> *"Nije daleko. Sve je blizu ako se ide."*
**Uloga:** koraci.

### 5. SABIR — knjigovođa nedelje
Sitne naočare, uvek nosi tablicu sa prosekom. Potpuno deadpan. Voli sedmodnevni
prosek više nego bilo koji pojedinačni dan.
> *"Utorak nije podatak. Nedelja jeste."*
**Uloga:** `/analitika`, nedeljni prsten, trend.

### 6. VAGICA — vaga
Klimava, anksiozna, dobra duša. Panično reaguje na dnevni šum; Sabir je smiruje
linijom proseka. **Njihov odnos je najbolji edukativni alat koji imamo** — kroz
njih učimo korisnika da trend > dnevni skok.
> Vagica: *"Danas +0.8!"* → Sabir: *"Danas je so i san. Gledaj liniju."*
**Uloga:** težina, trend grafikon.

### 7. GRICKO — bivši Izgovorac
Prebegao na našu stranu. Sitan, brz, uvek nešto žvaće, iskren do bola. Ne krije
grickanje — **beleži ga.**
> *"Pojeo sam. Upisujemo. Nema skrivanja, nema drame."*
**Uloga:** `gric` (glasovni unos), brzi čipovi.

---

## 5. Protivnici — IZGOVORCI

**Ključna odluka: hrana nikad nije neprijatelj.** U zero-shame app-u boriti se
protiv pljeskavice je kontradikcija koja ubija poverenje. Neprijatelj je
**izgovor** — rečenica koju svi izgovaramo.

Izgovorci su simpatični, smešni i svaki je gotov skeč od 25 sekundi.

| Izgovorac | Kako izgleda | Kontra u app-u |
|---|---|---|
| **Sutra Počinjem** | večito spakovan kofer, nikad ne krene — glavni antagonista | prvi unos, bilo koji |
| **Samo Jedan** | sitan; podeli se na dva čim ga pogledaš | `gric`, upiši i to |
| **Ma Nije To Ništa** | smanjuje brojeve, sve mu je "sto kalorija" | katalog hrane, gramaža |
| **Zaboravko** | magla, briše unose | glasovni unos za 3 sekunde |
| **Vikend Ne Računa** | dvoglav — jedna glava subota, druga nedelja; svira | nedeljni prsten |
| **Vaga Laže** | krivo ogledalo, izobličava grafikon | Sabirova linija proseka |
| **Nemam Vremena** | najveći, ali šupalj — unutra je samo raspored | 5-sekundni unos |

**Bos (mesečni): PONOĆNIK.** Dolazi u 23:47, otvara frižider, ništa ne kaže.

> Ton: Izgovorac nikad ne predstavlja *osobu*. Predstavlja *rečenicu*. Korisnik
> se smeje sebi — ne stidi se sebe.

---

## 6. Borba — kako da radi, a da ne poništi zero-shame

Otvoreno: klasičan PvP leaderboard je suprotan svemu što nam piše u `AGENTS.md`.
Zato borba ide u tri sloja, od kojih su prva dva bezbedna:

**Sloj 1 — Nedeljni obračun (solo, kanon).**
U nedelju uveče tvoj vodič izlazi na Svetionik i tera Izgovorce onim što si te
nedelje stvarno uradio:

| Tvoj podatak | Šta postaje |
|---|---|
| dani sa unosom | snaga udarca |
| protein | oklop |
| voda | brzina |
| koraci | domet |
| puni dani | kritični udarac |

**Nema poraza.** Ako Izgovorac preživi: *"Vidimo se sledeće nedelje."* Sledeća
nedelja kreće čista.

**Sloj 2 — Jato (co-op).**
3–8 ljudi, zajednički nedeljni bos. Doprinosi se **sabiraju, nikad ne
rangiraju** — niko ne vidi ko je dao najmanje. Ovo je retencija bez toksičnosti.

**Sloj 3 — Duel (opt-in, prijateljski).**
Nedelja protiv nedelje, ali metrika je **doslednost, a ne deficit** — koliko si
dana upisao, nikad koliko si malo jeo. Kalorije kao takmičenje su bezbednosno
pitanje, ne samo pitanje brenda. *Preporuka: ne u v1.*

Nagrada iz borbe je uvek **kozmetika** (sedefni slojevi, boje, sitni dodaci) —
nikad "poeni zdravlja".

---

## 7. NISKA — vizual napretka (najvažnija ideja u dokumentu)

Naša postojeća reč za streak je **"Niz"**. Na srpskom *niska* je ogrlica. Zato:

- Dan sa unosom = **sloj**.
- Nedelja = **zrno** koje se u nedelju uveče zatvori. Veličina zrna = broj
  slojeva. Boja = kakva je nedelja bila. **Nikad crveno.**
- Zrna se nižu u **Nisku**. Tvoj profil je **ogrlica, a ne broj**.
- Preskočen dan = tanji sloj i malo manje zrno. **Niska se nikad ne kida.**
- Godina = 52 zrna, jedinstvena kao otisak prsta.

Ovim izbacujemo "izgubio si niz od 47 dana" — najtoksičniju mehaniku u celoj
industriji — i menjamo je nečim što je istovremeno lepše, naše i deljivije.

---

## 8. Style guide (sve iz postojećih tokena, bez novog haosa)

| Namena | Token |
|---|---|
| podloga | `--background` |
| brend | `--brand` `#17d1a8` |
| sedef (unutrašnjost likova) | `--wordmark-grad` |
| žar / niz | `--streak-1..3` |
| preko cilja | `--chart-5` (toplo zlato) — **nikad** `--destructive` |
| lebdenje | `--fm-lift` |

- Sedefni gradijent ide **samo na unutrašnjost** lika, nikad na celo telo —
  inače gubimo mat/sjaj kontrast koji je ceo trik.
- **Animacija:** disanje 2.4 s, treptaj na 4–7 s nasumično, pulsiranje sjaja
  vezano za progres. `prefers-reduced-motion` gasi sve osim statičnog sjaja.
- **Lik nikad ne stoji preko podataka.** Stoji *pored* prstena, nikad u njemu.

---

## 9. Glas

- sr-Latn, "ti", kratke rečenice.
- **Nikad:** "moraš", "prekršio si", "izgubio si", "loše", "greška".
- **Uvek:** konstatacija + jedan mali sledeći korak.
- Svaki vodič ima svoj registar. Test rečenice koje svaki vodič mora da ima:
  prekoračenje, propušten dan, prvi dan, sedmi dan, povratak posle dve nedelje.

Primer — *propušten dan*:

| Vodič | Rečenica |
|---|---|
| Pera | "Sloj je tanji, to je sve. Nastavljamo." |
| Žarko | "Potamnio sam. Duni." |
| Sabir | "Nedeljni prosek: nepromenjen." |
| Vagica | "Ja se nisam ni pomerila. Sve u redu." |

---

## 10. Sadržaj — kako app reklamira sam sebe

- **Serija "Nedelja u Sedefju"** — jedna epizoda nedeljno, 20–35 s, jedan
  Izgovorac po epizodi. Format je neiscrpan.
- **"Izgovori"** — viralni deo. Svako se prepozna u bar tri.
- **Nedeljna share kartica** — tvoje zrno + tvoj vodič + jedna rečenica.
  Infrastruktura već postoji (`next/og` share card).
- **Stikeri** za Viber i WhatsApp. Srbija živi na Viberu — besplatna
  distribucija brenda.
- **Sezone** — svaka sezona (3 meseca) donosi jedno novo ostrvo, jednog
  Izgovorca i nove sedefne skinove. Razlog za povratak.
- **Kanon pravilo:** sve što se pojavi u marketingu **mora postojati u app-u**.
  Nema maskote koja živi samo na TikTok-u.

---

## 11. Šta ne radimo (da ne budemo Duolingo klon)

- **Nema pretnje.** Nikad "Pera je tužan", nikad guilt push. To je Duolingo
  potpis i direktno je suprotan našem.
- **Nema jedne maskote koja radi sve.** Naš izbor vodiča *je* razlika.
- Nema srca ni života koji se troše.
- Ne kopiramo zeleno. Naše je sedef.

---

## 12. Redosled izvođenja

| Faza | Šta | Trajanje |
|---|---|---|
| **F1 — Temelj** | finalni Pera, pravila siluete, sedef materijal, 4 emocije, tokeni; Pera u onboarding + `/danas` | 2–3 nedelje |
| **F2 — Izbor** | svih 7 vodiča u 2 poze, ekran izbora, vodič menja glas `/agent`-a i akcent | 3–4 nedelje |
| **F3 — Niska** | zrno + niska, nedeljno zatvaranje, share kartica | 2–3 nedelje |
| **F4 — Borba** | Svetionik, prva tri Izgovorca, Jato co-op | 4–6 nedelja |

Marketing kreće već od **F1** — Pera i Izgovorci se mogu snimati pre nego što
uđu u app.

---

## 13. Otvorena pitanja

1. Ime sveta: **Sedefje**, **Sedmokraj**, ili nešto tvoje?
2. Da li Pera ostaje kruška (vezan za logo), ili logo ostaje "predmet" a Pera
   postaje neko drugi?
3. Duel u v1 — da ili ne? *(preporuka: ne)*
4. Region: samo Srbija ili ceo ex-Yu? Imena moraju da rade i u HR/BiH/CG.
5. Ko crta? Stil traži ilustratora sa gvaš/riso osećajem — ne 3D generalistu.
