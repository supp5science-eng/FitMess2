# Testeri za Play — zašto instalacija nije prošla i šta se menja

Pisano 17.08.2026, posle prve provere poziva na pravom Android telefonu.
Poruka testerima **još nije poslata široko** — i to je jedina dobra vest u
ovom dokumentu, jer sve tri greške ispod bi pogodile svakog pozvanog čoveka.

---

## 0. Šta se tačno videlo

Tri ekrana, redom kojim ih čovek dobije prateći poruku:

| Korak iz poruke | Šta se dobije |
|---|---|
| 1. Uđi u grupu | „Немате дозволу за приступ овом садржају" (grupa se vidi, sadržaj ne) |
| 2. Otvori opt-in link | „You are a tester." — dakle nalog **jeste** na listi |
| 3. „download it on Google Play" | „Ставка није пронађена." |

Instalacije nema. Nije do telefona i nije do naloga.

---

## 1. Greška A — grupa ne prima nikoga

`groups.google.com/g/fitmess-testeri` vraća zid. Nova Google grupa se
podrazumevano pravi zatvorena: nečlan ne vidi razgovore i nema dugme
„Pridruži se grupi", nego baš ovu poruku sa uputstvom da piše vlasniku.

Znači **prvi korak poruke je zid za svakog pozvanog**, ne samo za nalog sa
kog je test rađen. Petnaest ljudi bi dobilo isti ekran.

**Popravka** (groups.google.com → FitMess testeri → *Podešavanja grupe*):

- *Ko može da vidi grupu* → **Svako na vebu**
- *Ko može da se pridruži* → **Svako na vebu može da se pridruži**
  (ako smeta spam: „Svako može da traži da se pridruži" — ali onda svaku
  molbu moraš ručno da odobriš, a čovek koji čeka odobrenje ne instalira
  ništa te večeri)
- *Ko može da vidi članove* → nebitno za Play, ostavi kako jeste

Provera koja jedina vredi: otvori link u **anonimnom prozoru**. Ako vidiš
dugme „Pridruži se grupi", radi. Ako vidiš zid, nije sačuvano.

---

## 2. Greška B — „Stavka nije pronađena" je Google, ne ti

> **Rešeno 16.08.2026.** Submission activity pokazuje obe pošiljke kao
> **Published** (1: 15.08. u 00:13 — release + listing + App content;
> 2: 16.08. u 20:46 — Closed testing), a Publishing overview „Last published
> on August 16, 2026". Recenzija je prošla; ostatak ovog odeljka objašnjava
> zašto je test tada pao i ostaje kao zapis.
>
> Sat na telefonu u trenutku testa je pokazivao **12:13**, a pošiljka 1 je
> poslata **15.08. u 12:13 AM**. Test je rađen u istoj minuti u kojoj je
> release otišao na recenziju — nije imao šanse da prođe.

Konzola je od 15.08. stajala na `Update status: In review`. Dok Google ne
odobri **sam closed-testing release**, stavka u prodavnici ne postoji ni za
jednog testera — ni za vlasnika naloga.

Zato dva ekrana koja izgledaju kontradiktorno to nisu:

- **„You are a tester"** servira Play Console. On zna listu testera i
  istinito kaže da si na njoj.
- **„Stavka nije pronađena"** servira prodavnica. Ona nema šta da isporuči,
  jer izdanje još nije objavljeno.

Ništa nije pogrešno urađeno na telefonu. Čeka se recenzija — za prvo izdanje
sa novog ličnog naloga to ume da potraje i do nedelju dana.

**Gde se gleda:** Play Console → *Publishing overview* (da li još stoji „In
review") i *Testing → Closed testing → Alpha*, gde release iz stanja „In
review" prelazi u „Available to testers". Managed publishing je isključen, pa
po odobrenju ne treba nijedan klik — objavi se samo.

---

## 3. Greška C — ona koja bi tiho pojela sve ljude

Ovo se na screenshotovima **ne vidi**, i zato je najskuplja.

U konzoli je kao izvor testera upisana **email lista „FitMess testeri" sa 2
adrese** (`nastavak-14-08-2026.md`, §3.6). Ulazak u Google grupu **ne dodaje
nikoga na tu listu.** To su dve nezavisne stvari koje samo dele ime.

Po sadašnjem podešavanju: 15 ljudi uđe u grupu → **0 testera.** Svako od njih
bi na opt-in stranici dobio „niste tester", a brojač u konzoli bi ostao na
nuli — bez ijedne greške igde.

Treba izabrati jedno od dva, i to pre nego što poruka ode:

| | Google grupa kao izvor | Email lista |
|---|---|---|
| Šta radi čovek | uđe u grupu sam | pošalje ti adresu, čeka da ga upišeš |
| Šta radiš ti | ništa, po čoveku | otvoriš konzolu, nalepiš, Save |
| Zamena testera kasnije | u grupi, trak se ne dira | menjaš listu na aktivnom traku |
| Zamka | grupa mora biti javna (§1) | ručna petlja po čoveku, i kašnjenje između „poslao adresu" i „može da instalira" |

**Preporuka: grupa.** Ne zbog lenjosti nego zbog sata — 14 dana teče samo dok
ima 12 opted-in ljudi, a zamena čoveka koji je obrisao app desetog dana tada
ide bez diranja aktivnog traka.

**Kako se upisuje:** Play Console → *Testing → Closed testing → Alpha* →
*Manage track* → kartica **Testers** → adresa grupe
`fitmess-testeri@googlegroups.com` → **Save**.

> Ako konzola odbije adresu grupe u polju za email listu, ne insistiraj —
> vrati se na email listu i prepiši poruku po verziji B iz §5. Obe rade;
> grupa samo štedi tvoje vreme. Ono što **ne sme** je da u konzoli ostane
> lista sa 2 adrese dok poruka šalje ljude u grupu.

---

## 4. Redosled — poruka ide poslednja

Poziv za testiranje se traži jednom. Petnaest ljudi koji dobiju „Stavka nije
pronađena" ne probaju drugi put, i drugu molbu istim ljudima nemaš.

1. ~~**Sačekaj odobrenje** — release mora otići sa „In review".~~ ✅ prošlo
   16.08.2026, obe pošiljke `Published`.
2. **Otvori grupu** (§1) i proveri je u anonimnom prozoru.
3. **Upiši izvor testera u konzolu** (§3) i sačuvaj.
4. **Dokaz na tuđem telefonu.** Jedan čovek koji nije ti: drugi Google nalog,
   drugi telefon, od nule — uđe u grupu, otvori opt-in, instalira, otvori app.
   Dok taj krug ne prođe do kraja, poruka ne ide dalje ni jednom čoveku.
5. **Tek onda masovno**, i to u talasima — pet ljudi, pa kad ta petorka
   potvrdi, ostatak.

Tačka 4 je jedina koja razlikuje „sve je podešeno" od „radi". Sve tri greške
iz ovog dokumenta bi preživele podešavanje i pale bi tek na tuđem telefonu.

---

## 5. Popravljena poruka

Šta je falilo staroj: slala je ljude na zatvorenu grupu, grupa ionako nije
bila izvor testera, nije rekla koliko se čeka između koraka, i nije tražila
potvrdu — pa se broj ljudi nije mogao pratiti dok konzola ne pokaže brojač.

### Verzija A — kad je grupa upisana kao izvor testera

> Napravio sam aplikaciju za praćenje ishrane — FitMess. Slikaš obrok, ona ti
> kaže koliko ima kalorija i šta si pojeo. Na srpskom, besplatna.
>
> Da bi izašla na Play Store, Google traži 12 ljudi koji je drže instaliranu
> 14 dana. Ako imaš Android i pet minuta, mnogo bi mi značilo.
>
> 1. Uđi u grupu, dugme „Pridruži se grupi": https://groups.google.com/g/fitmess-testeri
> 2. Sačekaj 10-15 minuta (toliko treba Google-u), pa otvori: https://play.google.com/apps/testing/app.fitmess
> 3. Klikni „Postani tester", pa instaliraj app sa linka koji ti da.
>
> Dve stvari koje sve obore:
>
> — **Isti nalog.** Onaj koji ti je u Play prodavnici na telefonu (Play →
> slika profila gore desno, tu piše koji je). Ako u grupu uđeš sa drugog
> naloga, Google te ne prepozna.
> — **Jedan čovek, jedan telefon.** Više naloga na istom telefonu se broji
> kao jedan, i Google to prepozna kao zaobilaženje.
>
> Ako ti bilo gde piše „Stavka nije pronađena" ili „niste tester" — javi mi i
> stani. To je do mene, ne do tebe, i rešavam za pet minuta.
>
> Molba je samo da je ne obrišeš 14 dana. Ne moraš je koristiti svaki dan —
> ali ako ti se dopadne, slobodno. Ako nešto puca ili ti smeta, piši mi,
> popravljam isti dan.
>
> Kad ti se instalira, dobaci mi „gotovo". Brojim ljude — treba mi tačno 12 i
> ne smem da padnem ispod.

### Verzija B — kad ostaje email lista

Isti tekst, samo prva dva koraka:

> 1. Pošalji mi u poruci Gmail adresu **sa koje ti radi Play prodavnica na
>    telefonu** (Play → slika profila gore desno).
> 2. Javim ti kad te upišem — obično par minuta. Tek tada otvori:
>    https://play.google.com/apps/testing/app.fitmess

Ostatak (opt-in, isti nalog, jedan telefon, 14 dana, „gotovo") je nepromenjen.

**Adrese testera ne idu u git.** Drži ih u lokalnom fajlu van repoa, jedna po
redu — tako se lepe u konzolu. To su tuđi lični podaci i nemaju šta da traže
u istoriji javnog repozitorijuma.

---

## 6. Kad ti neko napiše „ne radi"

| Šta vidi | Šta je | Šta mu odgovaraš |
|---|---|---|
| „Nemate dozvolu za pristup" na grupi | grupa je zatvorena (§1) | ne on — ti otvaraš grupu, pa mu javljaš da proba ponovo |
| „Stavka nije pronađena" | release još u recenziji, ili nije prošlo 10-15 min od opt-ina, ili je Play prodavnica na drugom nalogu | prvo: koji nalog piše u Play → profil gore desno. Ako je isti, čeka se |
| „Niste tester" / nema dugmeta „Postani tester" | nije u grupi/listi, ili je opt-in otvorio sa drugog naloga | neka se izloguje iz drugih naloga u browseru pa proba opet |
| „Aplikacija nije kompatibilna sa uređajem" | Android stariji od 7.0 (minSdk 24), ili telefon bez Google servisa (noviji Huawei) | ne može da bude tester, ne troši vreme |
| Instalirao, app traži da se uloguje | to je normalno — nalog u aplikaciji je odvojen od Play naloga | neka napravi nalog u app-u, bilo kojim mejlom |
| Instalirao pa app ne radi | ovo je jedina prava prijava buga | traži screenshot, popravka ide `git push` — bez novog builda i bez zaustavljanja sata |

---

## 7. Brojanje

- Traži se **12 opted-in neprekidno 14 dana**. Skupljaj **15** — neko obriše
  app desetog dana, neko promeni telefon, a brojač se ne pauzira.
- Brojač je u konzoli: *Closed testing → Alpha*, red „testers currently
  opted-in". **Poziv nije opt-in** — dok čovek ne klikne „Postani tester",
  za Google ne postoji.
- Instalacija nije isto što i opt-in, ali bez opt-ina nema instalacije, pa u
  praksi „javio je gotovo" ≈ „broji se". Svejedno proveri brojač u konzoli
  pre nego što kažeš da ih ima 12.
- Posle 14 dana ide još i **prijava za production access sa upitnikom** — to
  nije automatsko.

---

## 8. Put jednog testera — od poruke do brojača

Ovako izgleda proces kad je sve podešeno kako treba. Vremena su tipična, ne
garantovana; Google nigde ne obećava rok.

| # | Šta radi on | Koliko traje | Šta ti vidiš |
|---|---|---|---|
| 1 | Klikne link grupe, klikne „Pridruži se grupi" | 10 sek | ništa u Play Console-u; član se pojavi u Google grupi |
| 2 | Čeka da Google prenese članstvo u Play | ~10-15 min, ume i duže | ništa |
| 3 | Otvori opt-in link, klikne **„Postani tester"** | 10 sek | brojač *opted-in* raste za 1 — **ovo je jedini korak koji se broji** |
| 4 | Klikne link ka prodavnici, pa **Instaliraj** | 1-2 min | instalacija se vidi tek u statistici, sa danom zakašnjenja |
| 5 | Otvori app, napravi nalog u FitMess-u | 2 min | novi red u `profiles` |
| 6 | **Ne briše app 14 dana** | 14 dana | brojač mora ostati ≥12 sve vreme |

**Šta se zapravo broji:** opt-in, ne instalacija i ne korišćenje. Čovek koji
klikne „Postani tester" a nikad ne instalira — i dalje se broji. Čovek koji
instalira pa se ispiše iz grupe — više se ne broji, i sat pada.

**Gde puca u praksi, po učestalosti:**

1. **Drugi nalog u browseru nego u Play prodavnici.** Najčešći kvar. Telefon
   ume da bude ulogovan na privatni Gmail u Chrome-u a na neki drugi u Play-u.
   Simptom: „niste tester" ili „Stavka nije pronađena" iako je sve podešeno.
2. **Nestrpljenje između koraka 1 i 3.** Ko otvori opt-in odmah po ulasku u
   grupu, dobije „niste tester", pomisli da ne radi i odustane. Zato poruka
   izričito kaže da se sačeka 10-15 minuta.
3. **Ispisivanje iz grupe posle instalacije.** Ljudi čiste pretplate na mejl
   grupe i ne znaju da time prestaju da budu testeri. Vredi to reći unapred.

**Šta ne treba da te brine:** app se ne ažurira preko Play-a. Sadržaj je
`fitmess.app`, pa svaka popravka stiže `git push`-om na Vercel — bez novog
builda, bez nove recenzije, i **bez zaustavljanja sata od 14 dana**.
