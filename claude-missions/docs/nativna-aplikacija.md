# Prava nativna aplikacija (React Native / Expo)

Odluka doneta 26–27.08.2026. **Rad je počeo 27.08.2026.**

Ovaj dokument nastavlja `izlazak-u-store.md`, koji je 06.08.2026. izmerio i
**odbio** prepis u klijentsku aplikaciju. Ta odluka je bila tačna za cilj koji
je tada postojao. Cilj se promenio, pa se promenila i odluka — zapisano ovde
zajedno sa razlogom, da za tri meseca niko ne pita „zašto smo ovo dirali".

---

## 0. Zašto se odluka promenila

U avgustu je cilj bio: **izaći u store što pre sa onim što već postoji.**
Capacitor ljuska (`server.url = https://fitmess.app`) je bila najkraći put i
pogodila je taj cilj — Apple je odobrio aplikaciju za dve nedelje.

Novi cilj nije tehnički nego proizvodni: **FitMess prestaje da bude ekranski
tracker i postaje Jarvis** — agent kome se kaže šta treba i on to uradi.
Polazna teza je Navalova: niko ne bi trebalo da uči aplikaciju da bi je
koristio.

Za tracker sa ekranima ljuska je bila sasvim u redu. Za Jarvisa nije, i to
nije stvar ukusa — pet stvari koje je vlasnik naveo su **osobine WebView-a**,
ne bagovi koji se mogu popraviti:

| Simptom | Zašto se u WebView-u ne može rešiti |
|---|---|
| Sporo paljenje | Prvi ekran čeka mrežu; nema lokalnog paketa |
| Nema haptike ni zvuka na dugmadima | iOS ne daje haptiku vebu (otud `switch` trik, kome ističe rok u iOS 26.5) |
| Navigacija se oseća kao veb | WebView nema native stack ni swipe-back |
| Tastatura kod AI chata je katastrofa | Stranica nema kontrolu nad sistemskom tastaturom |
| Sve se kopira na dugi pritisak | To je browser i radi ono što browser radi |

Šesta stavka nije bila navedena ali je najveća: **prepoznavanje govora na
samom uređaju.** iOS i Android ga imaju ugrađenog — trenutno, besplatno, radi
offline, vidi reči dok korisnik još govori. WebView ga ne dobija. Za Jarvisa
kome se priča to je razlika između razgovora i čekanja.

### Šta se NE gubi

Prilikom odluke je rečeno da se gubi „`git push` = svi dobiju update". **To je
bilo netačno i ispravljeno je isto veče.** Expo ima **EAS Update**: novi JS
paket stiže svima bez store review-a. Granica je ista kao kod Capacitora —
menjaš JS, stiže odmah; menjaš native (biblioteka, dozvola, ikonica), ide nov
binar.

### Šta se stvarno menja u ceni

- Nova biblioteka ili dozvola traži nov build i store review.
- Backend se **ne dira** (vidi 2), pa sajt nastavlja da radi bez promene.

---

## 1. Šta se prepisuje, a šta ne

Računica iz avgusta („605 fajlova, nedelje rada") **ne važi za ovaj posao**,
jer se ne prepisuje isto.

**Ostaje netaknuto — postaje backend nativne aplikacije:**

- Supabase, sve tabele, sve RLS politike
- 37 API ruta i 27 server akcija
- Sve formule (BMR/TDEE, adaptivni plan, mikronutrijenti, sidra za skrivenu mast)
- Migracije, push infrastruktura, PDF izvoz, admin
- Ceo sajt fitmess.app, koji nastavlja da radi kao i do sada

**Prepisuje se:** samo UI sloj — i ne 1:1. Ako Jarvis preuzima ulogu
Početne, veći deo od 63 postojeće stranice ne treba da postoji kao ekran.
Prepisivati ih pa brisati bilo bi bacanje rada, i to je razlog zašto se
prepis i „Jarvis redizajn" rade kao **jedan** posao, a ne dva.

---

## 2. Kako nativna aplikacija priča sa serverom

Dva puta, namerno različita:

**Podaci → direktno na Supabase.** RLS politike već postoje i važe isto za
telefon kao za pregledač. Nema novog backend koda, nema novog sloja koji može
da ima svoju rupu.

**AI i serverski poslovi → API rute na fitmess.app.** Ključevi (Anthropic,
ElevenLabs) nikad ne smeju u binar — svako ko skine aplikaciju može da ih
izvuče.

Za drugi put je trebala jedna izmena, i ona je urađena kao **nov fajl koji
ništa postojeće ne dira**: `src/lib/supabase/from-request.ts`. Sajt šalje
kolačiće, telefon šalje `Authorization: Bearer`; ovaj helper pravi klijenta iz
onoga što je stiglo. Rute prelaze na njega jedna po jedna, kad zatrebaju.

⚠️ Header se proverava PRE kolačića, namerno: telefon koji je ikad otvorio
fitmess.app u ugrađenom pregledaču može da nosi tuđe kolačiće za isti domen.

---

## 3. Arhitektura Jarvisa

### Dva pravila koja drže sve

**Model nikad ne dira bazu.** Bira alat i popuni argumente; sve što stiže do
Supabase-a prolazi kroz naš kod (`src/jarvis/alat.ts`). Model koji bi mogao da
piše redove direktno je jedan halucinirani broj od tihog kvarenja istorije.

**Model nikad ne crta ekran.** Bira alat; alat imenuje komponentu koju smo
mi napisali. Model koji emituje raspored daje UI koji je svaki put drugačiji,
ne može da se testira i kvari se neponovljivo.

Iz toga sledi jedina rečenica koja određuje da li će Jarvis biti dobar:

> **Jarvis je tačno onoliko sposoban koliko alata ima.**

### Odgovor je ponekad ekran, ne rečenica

Glas je najbrži način da se nešto **kaže** i najsporiji da se nešto
**pročita**. „Loguj 200g pirinča" je jedna rečenica naspram četiri tapa; sedam
dana kalorija izgovoreno naglas traje minut, a nacrtano se pročita za pola
sekunde.

Zato alat sme da odgovori ekranom (`RezultatAlata.ekran`), i dobri to obično i
rade. Jarvis izgovori kratku polovinu, a broj preda oku.

### Šta već postoji, a šta fali

`src/lib/ai/agent-chat.ts` i `claude.ts` već voze **Opus 5** — mozak ne treba
graditi od nule.

Ali `agent-actions.ts` sam kaže šta mu fali:

> *v1 actions are all NAVIGATIONAL… v2 (planned, not here): mutating actions —
> „izbriši mi ručak", „promeni cilj" — each behind an explicit in-chat
> confirmation. Keep them OUT of this catalog until that confirmation UI
> exists.*

Postojeća Prizma **navigira** — pošalje te na pravi ekran. Jarvis mora da
**uradi**. Ta „confirmation UI" koja je nedostajala sada postoji kao tip:
polje `potvrda` na alatu. Alat koji menja nešto vraća pitanje i ne radi ništa
dok korisnik ne potvrdi — tačno onaj tok koji je vlasnik opisao (korisnik
traži → Jarvis pita → korisnik potvrdi → Jarvis uradi).

Čitanja (`potvrda: null`) idu odmah: pitati „smem li da pogledam?" je trenje
bez ikakve sigurnosti u sebi.

### Glasovni lanac — latencija je ovde problem, ne pamet

Zamišljeno je bilo: Gemini transkribuje → Opus misli → ElevenLabs govori.
Serijski, to je 3–5 sekundi tišine. Čovek toleriše oko **jedne**.

Isti nalaz već stoji u beleškama o Prizminom mozgu: *effort ne rešava
latenciju, streaming rešava.*

Tri izmene:

1. **Transkripcija na telefonu**, ne na serveru — iOS i Android je imaju
   ugrađenu. Trenutno, besplatno, offline, i vidi reči dok korisnik govori.
   (Gemini 3.5 Pro je uz to već ranije pravio timeout-e.)
2. **Opus streamuje** — prva rečenica ide dalje čim je gotova.
3. **ElevenLabs streamuje** — govor kreće na prvoj rečenici.

Prvi zvuk za ~1s umesto 4. Isti model, isti glas, drugi redosled.

**Trošak:** glasovni razgovor je znatno skuplji od jednog AI poziva. Uz
„5 AI dnevno besplatno", glas verovatno mora na plaćeni nivo.

---

## 4. Ostaje u fitness sferi

Razmatran je „all-in" Jarvis (edituj sliku, napravi stranicu, bilo šta).
Odbijeno za sada, i razlog nije skromnost:

**All-in Jarvis nije veći posao — to je druga aplikacija.** Svaka nova oblast
traži svoj alat, svoj ekran, svoje održavanje i svoj račun. Bez alata Jarvis
ne ume ništa, samo lepo objasni zašto ne može.

Uz to: FitMess je odobren u store-u kao fitness aplikacija četiri dana pre ove
odluke. Aplikacija koja radi „sve" je promena svrhe, a to je stvar koju Apple
gleda pri update-u.

**Odluka: arhitektura je all-in, proizvod je fitness.** Registar alata,
generativni UI i glasovni sloj nisu fitness-specifični. Kad rade, „all-in" je
dodavanje alata u registar, ne prepis.

---

## 5. Otvorena pitanja

Postavljena vlasniku, još bez odgovora — rad ide dalje na delovima koji od
njih ne zavise.

1. **Šta ostaje ekran, a šta postaje „pitaj Jarvisa"?** Predlog: Prizma ostaje
   ekran (kamera je brža od pričanja), Analitika ostaje ekran ali ga Jarvis
   može otvoriti; Navike, Podsetnici, Podešavanja, Profil nestaju kao ekrani i
   postaju alati; Početna postaje Jarvis.
2. **Nova aplikacija kao update postojeće ili paralelno?** Vidi upozorenje uz
   `BUNDLE_ID` u `fitmess-app/app.config.ts` — identifikator se troši jednom.

### Zatečeno usput

- **Tema više ne postoji.** Light/dark par je penzionisan 24.08.2026;
  aplikacija je jedna „Gravira" paleta. Primer iz razgovora — „Jarvis, promeni
  mi temu u crnu" — nema šta da promeni. Ako je Jarvisu potrebna takva
  komanda, tema mora prvo da se vrati kao feature.

---

## 6. Gde je kod

`exexutor/fitmess-app/` — pored `claude-missions/`, u istom repou. Vercel
builduje iz `claude-missions`, pa novi folder ne dira produkciju.
