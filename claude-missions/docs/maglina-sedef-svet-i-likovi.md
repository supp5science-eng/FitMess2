# MAGLINA SEDEF — sci-fi svet, SEDEFCI i stil FitMess-a

> Radni dokument za redizajn UI-a i za AI-generisane maskote.
> Verzija 0.3 · avgust 2026 · sr-Latn, "ti", zero-shame.
> Ton: animirani film (Minion-toplo), postavka: sci-fi.

---

## 0. Zašto sci-fi radi baš za nas

Tri stvari se poklapaju same od sebe — nije tema nalepljena spolja:

1. **Naš UI je već kokpit.** Prsten kalorija, gauge, makro trake, trend linija,
   date strip. To nije „kao" telemetrija — to *jeste* telemetrija.
2. **Logo je već brod.** Sedefna kruška sa zagrizom, gledana sa strane, je trup
   sa **otvorom** kroz koji svetli jezgro. Ne menjamo znak — objašnjavamo ga.
3. **Telo je najstarija sci-fi metafora.** Gorivo, hlađenje, potisak, masa,
   navigacija. Zdravlje se prevodi u brodske sisteme bez ijednog nategnutog
   koraka — i to je **mehanička**, a ne dekorativna veza sa fitnessom.

**Teza sveta:**

> **„Nema svetla bez otvora."** Zatvoren trup ne svetli, ne prima gorivo i ne
> može da se popravi. Otvor nije kvar — otvor je uslov.

To je zero-shame doktrina prevedena u hardver. I to je *Mess* iz imena FitMess.

---

## 1. Postavka u tri rečenice

**MAGLINA SEDEF** je jedino mesto gde se skuplja **Sjaj** — svetlost koja se ne
može uhvatiti odjednom, nego se taloži u **slojevima**, po jedan po mirnom danu
leta. Slojevi nikad ne legnu savršeno, i baš zbog nepravilnosti trup prelama
svetlost i dobija sedefni odsjaj — savršeno ravan trup bio bi mrtvo siv.

**Ti si brod.** Kruška-klase: trup u obliku kapi, lebdi, na boku ima klinasti
otvor kroz koji se vidi jezgro.

**Posada su SEDEFCI** — mala, bucmasta, žива bića u retro svemirskim odelima,
koja žive unutar tvog broda i drže ga u životu. Ti biraš jednog za vodiča.

---

## 2. Prevod: telo → brod (srce koncepta)

Ovo nije rečnik za marketing — ovo je mapa ekrana.

| Telo / podatak | Brodski sistem | Gde u app-u |
|---|---|---|
| kalorije | **gorivo** | prsten na `/danas` |
| protein | **oplata trupa** (popravka) | makro traka |
| ugljeni hidrati | **potisak** | makro traka |
| masti | **rezervne ćelije** | makro traka |
| voda | **rashladni sistem** | voda |
| koraci | **pređeni put** | koraci |
| težina | **masa broda** | trend |
| unos obroka | **utovar** | `/dodaj` |
| grickanje | **usputni utovar** | `gric` |
| dan | **sloj** na trupu | `logs` |
| nedelja | **KRUG** (jedan ciklus) | `lib/week/summary.ts` |
| niz | **neprekinut let** | `lib/streak` |
| prekoračenje | **višak tereta**, nikad avarija | `--chart-5`, nikad crveno |

### Ekrani postaju palube

| Ruta | Paluba |
|---|---|
| `/danas` | **MOST** — gorivo, potisak, stanje trupa |
| `/analitika` | **NAVIGACIJA** — kurs, prosek, krivina |
| `/dodaj` | **UTOVAR** |
| `/profil` | **MAŠINSKA** |
| `/agent` | tvoj Sedefac, uživo |

---

## 3. Vizuelni pravac: TOPLI RETRO-FUTURIZAM

Referentni osećaj: **animirani film, ne hladan sci-fi.** Bliže *Wallace &
Gromit u svemiru* nego *Blade Runneru*. Sve je zaobljeno, debeljuškasto,
opipljivo i **hoćeš da ga zagrliš** — a svet oko toga je svemirski.

- **Rendering:** stilizovana 3D animacija, mekana, mat, blago potkožno svetlo.
  Nikad fotorealizam, nikad sjajna plastika.
- **Tehnologija je stara i draga:** okrugli akvarijum-šlemovi, gumeni okovratnici,
  debele zakivke, veliki fizički prekidači koji *kliknu*, amber lampice.
  Ništa nije touchscreen. Sve se okreće rukom.
- **Regionalni potpis (naša tajna prednost):** stanice u Maglini imaju oblik
  **spomenika** — ogromne betonske geometrijske forme koje lebde u pozadini.
  Ceo region ih prepoznaje istog sekunda, a svima van regiona su egzotične.
  To je jedina estetika koju konkurencija ne može da uzme jer nije njihova.
- **Samo dve svetlosti u celom svetu:** topli **amber** (lampice, instrumenti)
  i hladan **sedef** (jezgro, šlemovi). Sve ostalo su neutrali.

---

## 4. DNK Sedefaca — pravila po kojima se sve crta

1. **Silueta = kap.** Uska gore, teška dole. Bez vrata. Kratke ruke i noge.
   Mora da se prepozna na 24 px, u crnom.
2. **Šlem.** Okrugli stakleni šlem sa **sedefnim prelivom** — to je naš
   ekvivalent Minion naočara. Jedan potez koji ceo svet drži na okupu.
3. **Jezgro na grudima.** Okrugli otvor u odelu kroz koji svetli sedefno
   jezgro. **Sjaj = napredak**: bolji krug, jače pulsira. Napredak je
   **svetlost, ne mišići.**
4. **Potpis lika je pozicija i oblik jezgra**, ne lice. Tako svih sedam ostaju
   ista porodica, a razlikuju se iz daljine.
5. **Lice.** Velike oči, jedan odsjaj, usta samo za četiri stanja: mir, radost,
   „hm", nežna briga. **Nema besa, nema tuge.**
6. **Nema tela iz teretane.** Nijedan lik nema mišiće, tegove ni „pre/posle".
   Nijedan lik nije čovek. Ovo nas razdvaja od cele kategorije.

### Anti-brief
- Bez neona i cyberpunka. Bez hroma i staklaste plastike.
- **Bez oružja.** Sedefci čiste smetnje, ne pucaju.
- Bez crvene za prekoračenje, ni u ilustraciji. Toplo zlato (`--chart-5`).
- Sedefac **nikad** ne prekoreva korisnika. Nikad „izgubio si niz".
- Nikad šala na račun kilaže ili izgleda.

---

## 5. POSADA — sedam Sedefaca

Izbor vodiča menja glas app-a (`/agent`), akcent boje i share kartice.
Oznaka + nadimak, kako se mašine i ljudi kod nas oduvek i zovu.

### P-1 „PERA" — jezgro broda
Najveće jezgro, najsporiji hod, najsuvlji humor. Kapetan i narator. Nikad ne
cvili, nikad ne žuri.
> *„Krug je jedinica. Dan je samo sloj."*
**Uloga:** onboarding, MOST, podrazumevani vodič.

### Ž-7 „ŽAR" — reaktor
Jezgro mu je iza rebraste rešetke, amber. Kad preskočiš dan **se ne gasi** —
prelazi u *tinjanje* i strpljivo čeka.
> *„Nisam se ugasio. Prešao sam u tinjanje."*
**Uloga:** niz, `--streak-*`.

### K-2 „KAP" — rashladni sistem
Najuža, najhladnija, najbrža. Govori u jednosložnim naredbama i uvek je u
pravu.
> *„Jedna čaša. Ne pregovaram."*
**Uloga:** voda.

### Đ-4 „ĐON" — pogon
Jedini sa gusenicama umesto nogu, izlizanim s jedne strane. Ne ume da stane, ne
ume da sedne.
> *„Nije daleko. Sve je blizu ako se ide."*
**Uloga:** koraci.

### S-9 „SABIR" — navigacija
Amber ekranić umesto lica, uvek prikazuje sedmodnevni prosek. Potpuno deadpan.
> *„Utorak nije podatak. Krug jeste."*
**Uloga:** `/analitika`, nedeljni prsten, trend.

### V-3 „VAGA" — senzor mase
Klima se, anksiozna, zlatna duša. Panično reaguje na dnevni šum; Sabir joj
izglađuje signal. **Njihov odnos je najbolji edukativni alat koji imamo** —
kroz njih korisnik nauči da je trend važniji od dnevnog skoka, a da mu to niko
nije održao predavanje.
> V-3: *„Danas +0,8!"* → S-9: *„To su so i san. Gledaj krivu."*
**Uloga:** težina, trend.

### G-6 „GRIC" — utovarna sonda
Najmanji, najbrži, prebegao sa druge strane. Ne krije usputni utovar — **beleži
ga**, uključujući onaj u 00.47.
> *„Utovareno. Upisujemo. Nema skrivanja, nema drame."*
**Uloga:** `gric`, brzi čipovi.

---

## 6. Protivnik — ŠUM

**Ključna odluka: hrana nikad nije neprijatelj.** Boriti se protiv pljeskavice
u zero-shame app-u je kontradikcija koja ubija poverenje.

Neprijatelj je **ŠUM** — smetnja koja ti briše, umanjuje ili izobličava
sopstveni dnevnik. Šum ne napada telo. Napada **zapis**. Svaka smetnja je jedna
rečenica koju svi izgovaramo.

| Smetnja | Šta je | Kontra |
|---|---|---|
| **SUTRA-1** | sonda zaglavljena u odbrojavanju koje nikad ne stigne do nule | prvi unos, bilo koji |
| **JOŠ-JEDAN** | mikro-dron koji se udvostruči čim ga pogledaš | `gric`, upiši i to |
| **NULA-ZAREZ** | prepravlja telemetriju naniže, sve mu je „sto kalorija" | katalog, gramaža |
| **MAGLA** | briše unose pre nego što stignu u dnevnik | glasovni unos za 3 s |
| **VIKEND-2** | dvoglavi signal: ubeđuje brod da subota i nedelja nisu deo kruga | nedeljni prsten |
| **KRIVO-OGLEDALO** | izobličava senzor mase | Sabirova kriva proseka |
| **PRAZAN-SAT** | najveći, ali šupalj — unutra je samo raspored | petosekundni unos |
| **PONOĆNIK** *(bos)* | pukotina koja se otvara u 00.47 kod utovarnog otvora | planiran večernji utovar |

> **Ton:** smetnja nikad ne predstavlja *osobu*. Predstavlja *rečenicu*.
> Korisnik se smeje sebi — ne stidi se sebe.

**Vizuelno pravilo:** Sedefci su čisti, mekani, topli. Smetnje su jedina stvar
u svetu koja sme da bude **zrnasta, izlomljena i hladna**. Neprijatelj se
prepoznaje bez ijedne reči objašnjenja.

---

## 7. Borba — kako da radi, a da ne poništi zero-shame

Klasičan PvP leaderboard je suprotan svemu što piše u `AGENTS.md`. Zato tri
sloja, od kojih su prva dva bezbedna.

**Sloj 1 — Zatvaranje kruga (solo, kanon).**
Nedelja uveče: tvoj Sedefac čisti Šum onim što si tog kruga stvarno uradio.

| Podatak | Sistem |
|---|---|
| dani sa unosom | snaga signala |
| protein | integritet oplate |
| voda | hlađenje — koliko dugo možeš punom snagom |
| koraci | domet |
| puni dani | čist prolaz |

**Nema poraza.** Ako smetnja preživi: *„Ostaje u sledećem krugu."* Novi krug
kreće čist.

**Sloj 2 — FLOTA (co-op).** Tri do osam ljudi, zajednička smetnja. Doprinosi se
**sabiraju, nikad ne rangiraju** — niko ne vidi ko je dao najmanje. Retencija
bez toksičnosti.

**Sloj 3 — Duel (opt-in, preporuka: ne u v1).** Krug protiv kruga, metrika je
**doslednost, ne deficit**. Kalorije kao takmičenje su bezbednosno pitanje, ne
samo pitanje brenda.

Nagrada je uvek **kozmetika** — slojevi, boje jezgra, oznake — nikad „poeni
zdravlja".

---

## 8. Napredak: SLOJ → KRUG → GODIŠNJI KRUG

- Dan sa unosom = **sloj** sedefa na trupu.
- Nedelja = **KRUG** koji se u nedelju uveče zatvori i zapečati.
- Godina = **52 kruga**, prikazana kao hronometarski prsten sa 52 crte; dužina
  crte = broj slojeva tog kruga.
- Preskočen dan = kraća crta. **Nikad rupa. Prsten se nigde ne prekida.**

Ovim izbacujemo „izgubio si niz od 47 dana" — najtoksičniju mehaniku u
industriji — i dobijamo sliku jedinstvenu kao otisak prsta, savršenu za
deljenje.

---

## 9. Kako ovo generišemo AI-em (produkcioni deo)

Pošto likove pravimo AI-em, **stil mora da bude napisan kao ponovljiv prompt**,
ne kao raspoloženje.

### 9.1 STYLE TOKEN — lepi se na kraj SVAKOG prompta

```
Stylized 3D character animation, modern animated feature film quality.
Soft rounded chunky forms, appealing proportions, oversized expressive eyes,
short stubby limbs, no neck. Warm retro-futuristic space gear: round fishbowl
glass helmet with an iridescent nacre sheen, cream enamel suit, thick rubber
collar and boots, exposed rivets, one big physical toggle. A round port on the
chest glows with an iridescent teal-gold-blue core.
Lighting: soft cinematic three-point, warm amber key from lower left, cool
nacre bounce from the chest port, gentle rim light, subsurface softness.
Matte materials, no gloss. Shallow depth of field.
Palette strictly #0a0c0b #f1efe8 #17d1a8 #ecc766 #2c7cbe.
Plain warm neutral studio background, 3/4 view, eye level, 50mm.
```

### 9.2 NEGATIVE — takođe uvek

```
no muscles, no six-pack, no human anatomy, no realistic human, no gym
equipment, no weapons, no neon, no cyberpunk, no chrome, no glossy plastic,
no lens flare, not photorealistic, no text, no logos, no watermark
```

### 9.3 Formula prompta

```
[oznaka + nadimak] + [funkcija na brodu] + [varijacija tela] +
[OBLIK I POZICIJA JEZGRA — potpis lika] + [jedan potpisni detalj] +
[akcenat boje] + [izraz] + STYLE TOKEN + NEGATIVE
```

**Primer, P-1 „PERA":**

> P-1 "PERA", the ship's core keeper. A small chubby pear-shaped creature in a
> cream enamel spacesuit, round fishbowl helmet with iridescent nacre sheen,
> the largest chest port of the crew glowing warm teal-gold, thick rubber
> collar and boots, calm half-smile, standing relaxed with hands behind back.
> + STYLE TOKEN + NEGATIVE

### 9.4 Redosled rada (bitniji od samog prompta)

1. **Prvo samo PERA.** Generiši dok jedan kadar ne bude tačan. Taj kadar
   postaje **referenca celog sveta.**
2. **Character sheet za Peru:** turnaround (prednji / 3-4 / profil / zadnji) +
   četiri izraza. Tek to je „lik" — jedan render nije lik.
3. **Ostalih šest** se generišu **sa Perinom referencom priloženom**, i menja se
   **samo jedan slot** — oblik i pozicija jezgra plus potpisni detalj. Sve
   ostalo se ne dira: isto svetlo, isti kadar, ista pozadina, isti hex kodovi.
4. **Zaključaj i sačuvaj.** Svaki finalni prompt ide u `docs/brand/prompts/` uz
   sliku, da svako sledeće generisanje bude reproducibilno.
5. **Smetnje (Šum)** se generišu tek na kraju i namerno **krše** style token na
   tačno jedan način — grubo zrno i pokidan signal, dok posada ostaje čista.

---

## 10. Stil u app-u (postojeći tokeni)

| Namena | Token |
|---|---|
| podloga | `--background` |
| sedef / jezgro | `--brand` `#17d1a8`, `--wordmark-grad` |
| amber lampice / reaktor | `--streak-1..3` |
| preko cilja | `--chart-5` — **nikad** `--destructive` |
| lebdenje | `--fm-lift` |

- Sedefni preliv ide **samo u jezgro i šlem**, nikad na celo odelo — inače
  gubimo mat/sjaj kontrast, a to je ceo trik.
- Animacija: disanje 2,4 s, treptaj na 4–7 s, pulsiranje jezgra vezano za
  progres. `prefers-reduced-motion` gasi sve osim statičnog sjaja.
- **Sedefac nikad ne stoji preko podataka.** Stoji pored prstena, nikad u
  njemu.

---

## 11. Glas

sr-Latn, „ti", kratke rečenice. Brodski registar: konstatacija, pa jedan mali
sledeći korak. **Nikad:** „moraš", „prekršio si", „izgubio si", „greška",
„avarija".

Svaki Sedefac mora da ima svojih pet test-rečenica: prekoračenje, propušten
dan, prvi dan, sedmi dan, povratak posle dva kruga. Primer — *propušten dan*:

| Sedefac | Rečenica |
|---|---|
| P-1 Pera | „Sloj je tanji, to je sve. Nastavljamo." |
| Ž-7 Žar | „Prešao sam u tinjanje. Dovoljno je da upišeš." |
| S-9 Sabir | „Prosek kruga: nepromenjen." |
| V-3 Vaga | „Masa se nije ni pomerila. Sve u redu." |

---

## 12. Sadržaj — kako app reklamira sam sebe

- **Serija „Jedan krug"** — epizoda nedeljno, 20–35 s, jedna smetnja po
  epizodi. Format je neiscrpan i poklapa se sa nedeljnim ritmom app-a.
- **„Smetnje"** — viralni deo. Svako se prepozna u bar tri.
- **Nedeljna share kartica** — tvoj zatvoreni krug, tvoj Sedefac, jedna
  rečenica. Infrastruktura već postoji (`next/og`).
- **Stikeri** za Viber i WhatsApp — besplatna distribucija brenda u regionu.
- **Merch:** silueta kapa + šlem je plišana igračka koja se sama traži.
- **Sezone:** svaka donosi jednu novu stanicu, jednu smetnju i nove boje jezgra.
- **Kanon pravilo:** sve što se pojavi u marketingu **mora postojati u app-u**.

### Da ne budemo Duolingo klon
- **Nema pretnje.** Nikad „Pera je tužan", nikad guilt push.
- **Nema jedne maskote koja radi sve.** Izbor Sedefca *jeste* naša razlika.
- Nema srca ni života koji se troše. Ne kopiramo zeleno — naše je sedef.

---

## 13. Redosled izvođenja

| Faza | Šta | Trajanje |
|---|---|---|
| **F1 — Referenca** | Pera: hero kadar, character sheet, zaključan style token; prvi ekran (MOST) | 2–3 nedelje |
| **F2 — Posada** | ostalih šest sa Perinom referencom, ekran izbora, glas u `/agent` | 3–4 nedelje |
| **F3 — Krug** | sloj → krug → godišnji krug, nedeljno zatvaranje, share kartica | 2–3 nedelje |
| **F4 — Šum** | prve tri smetnje, zatvaranje kruga, Flota co-op | 4–6 nedelja |

Marketing kreće od **F1** — Pera i prve smetnje se mogu snimati pre nego što
uđu u app.

---

## 14. Otvorena pitanja

1. **Sedefci** kao ime vrste — prolazi, ili tražimo kraće/čudnije?
2. Da li Pera ostaje kruškastog tela (vezan za logo) ili je logo samo znak?
3. Duel u v1 — da ili ne? *(preporuka: ne; Flota daje istu retenciju bez rizika)*
4. Region: samo Srbija ili ceo ex-Yu? Nadimci moraju da rade i u HR/BiH/CG.
5. Budžet po liku — koliko iteracija po Sedefcu smemo pre nego što zaključamo?
