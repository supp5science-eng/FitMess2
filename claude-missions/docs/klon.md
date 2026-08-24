# Klon — avatar iz slika

> Stanje na 24.08.2026. **Kod je na `main` i živ, ali gate SPAVA** — klon
> trenutno ne blokira nikoga i „Započni" na landingu i dalje vodi na `/upitnik`.
> Pali se jednom promenljivom, kad se potvrdi da crtanje radi.

---

## ⏭️ Šta ostaje da se uradi

### 1. Proveri da crtanje uopšte radi ⬅️ ovde smo stali

Na **telefonu** (desktop preusmerava na „samo za telefon").

**Sa postojećim nalogom** (prijavljen si) — ne treba ti nov nalog i ne treba da
pališ gate:

```
fitmess.app/onboarding/klon
```

Isti ekran, ali odmah upisuje klona na tvoj nalog. Posle stoji i u
**Podešavanja → Tvoj klon**, sa „Napravi ponovo".

**Kao nov posetilac** (odjavljen, ili privatni prozor):

```
fitmess.app/klon
```

Ubaci 5–20 slika → „Napravi klona" → čeka do dva minuta.

| Šta vidiš | Šta znači | Šta dalje |
|---|---|---|
| Crtež | Radi | Idi na korak 3 |
| „Crtanje trenutno ne radi kod nas — nije do tvojih slika" | Ključ ili naziv modela | Korak 2 |
| „Ne vidim… probaj sa drugim slikama" | Model radi, odbio baš te slike | Probaj druge slike |

Poruke su namerno razdvojene: do 24.08. je svaki kvar govorio „probaj druge
slike", pa bi čovek slikao dvadeset novih zbog zida koji je naš.

### 2. Ako je pukao ključ ili model

Otvori `fitmess.app/admin/modeli` (link stoji na `/admin`). Ta stranica pita
Google **sa servera**, na **oba načina** — kao `?key=` i kao `x-goog-api-key`
zaglavlje — i ispiše koji modeli za slike postoje na ključu. Ključ se nigde ne
prikazuje.

- **Nijedan model za slike** → ključ nema pristup image modelima. Treba nov iz
  Google AI Studio, ili uključiti naplatu za taj model.
- **Postoji model, ali drugog naziva** → upiši ga u Vercel kao
  `GEMINI_IMAGE_MODEL`. Bez deploya.
- **Zaglavlje radi a `?key=` ne** → to je već pokriveno u kodu (vidi „Zamke"),
  ali ako se pojavi negde drugde, to je razlog.

⚠️ **Ključ `AQ.Ab8RN6…` je bio izložen na slici u chatu 24.08. Rotiraj ga**
(Google AI Studio → obriši stari, napravi nov, upiši u Vercel).

### 3. Kad crtanje radi — upali klon

U Vercelu:

```
KLON_OBAVEZAN=true
```

Tog trenutka, bez deploya:

- „Započni" na landingu vodi na `/klon` umesto na `/upitnik`
- Nalog bez klona ne može u aplikaciju — vraća se na `/onboarding/klon`

Gasi se isto tako brzo (obriši promenljivu ili stavi bilo šta osim `true`).

**Gate namerno hvata i postojeće naloge.** Pita „ima li ovaj nalog klona" i ne
razlikuje nov od starog, pa u trenutku paljenja svaki dosadašnji korisnik ide na
ekran za klona i pravi svog. To je **odluka, ne propust** (24.08.) — klon je ono
čime se aplikacija predstavlja, pa ga imaju svi ili niko.

Praktična posledica: pali ga onog dana kad možeš da gledaš u Vercel logove.
Gasi se za minut ako nešto krene naopako.

### 4. Ostalo, po redu važnosti

- **Pravnik.** U politici privatnosti sada piše da je klon neophodan za
  korišćenje aplikacije, jer je to istina kad se upali. Slike lica su na granici
  biometrije, a pristanak koji je uslov za uslugu teško prolazi kao „slobodno
  dat" po GDPR-u. Pitanje za pravnika pre sledeće submisije u store.
- **Šabloni odeće.** Cela poenta zbog koje je šablon fiksan. Nije početo.
- **Granica po adresi** je 3 klona dnevno (`KLON_DAILY_IP_LIMIT` u
  `src/lib/avatar/klon-ip-cap.ts`). Menja se jednom konstantom.
- **Cena.** Nijedan klon još nije nacrtan, pa se prava cena po korisniku ne zna.
  Grep `[gemini] usage` u Vercel logovima daje tačne brojeve posle prvog.

---

## ✅ Šta je napravljeno

### Tok

```
landing → „Započni" → /klon → /upitnik → registracija → /onboarding/klon → /danas
                       ▲                                      ▲
                  crta, ne čuva                    prikači ostavljenog klona
                  (nema naloga)                    (sad postoji user_id)
```

`/klon` je javan i pre-auth. `/onboarding/klon` je isti ekran iza prijave — traži
slike samo ako ostavljenog klona nema (Google prijava pravo sa `/prijava`,
obrisan pregledač, pao upload).

### Gde šta živi

| Fajl | Šta radi |
|---|---|
| `src/lib/avatar/clone-prompt.ts` | **Likovni pravac — jedna konstanta.** Kadar, poza, pozadina, kontura, neutralna odeća. |
| `src/lib/avatar/klon-stash.ts` | Crtež u pregledaču (IndexedDB) dok nema naloga |
| `src/lib/avatar/klon-ip-cap.ts` | Granica potrošnje na javnom endpointu |
| `src/lib/avatar/klon-gate.ts` | Prekidač `KLON_OBAVEZAN` |
| `src/components/avatar/klon-screen.tsx` | Ekran, oba režima (`javni` / `nalog`) |
| `src/app/api/klon/route.ts` | Javno crtanje. **Ne čuva ništa.** |
| `src/app/api/klon/sacuvaj/route.ts` | Prikači klona na nalog posle prijave |
| `src/app/admin/modeli/page.tsx` | Dijagnostika ključa i modela |
| `src/app/(app)/profil/page.tsx` | Red „Tvoj klon" → vodi na `/onboarding/klon` |
| `src/lib/ai/gemini.ts` | `generateAvatarClone`, `postToModel`, `cloneErrorSr` |
| `supabase/migrations/0033–0035` | `avatar_clones`, `profiles.klon_at`, `klon_ip_usage` |

Sve tri migracije su **primenjene na Supabase 24.08.**

### Promenljive u Vercelu

| Promenljiva | Stanje | Čemu služi |
|---|---|---|
| `KLON_OBAVEZAN` | **nije postavljena** = isključeno | `true` pali gate i pomera CTA |
| `GEMINI_IMAGE_MODEL` | nije postavljena | Ispravlja naziv modela kad ga Google preimenuje |

---

## 📌 Odluke, i zašto (da se ne prežvakavaju)

**Šablon je fiksan i živi u kodu.** Menja se čovek, ne crtež. Test drži da se
dva prompta smeju razlikovati **samo** po broju slika. Bez tog invarianta svaki
budući šablon odeće mora da se kroji po korisniku.

**Model je Nano Banana Pro i to je zahtev, ne podešavanje.** Jeftiniji image
modeli beže sa šablona — drugi kadar, druga debljina linije, pozadina koja luta.
`GEMINI_IMAGE_MODEL` služi da se **ispravi** ime, nikad da se spusti na Flash.

**Izvorne slike se ne čuvaju nigde.** Ni pre naloga, ni posle. Idu inline u
zahtev i propadaju čim crtež stigne — isto kako `gemini.ts` već radi sa glasom.
To nije ušteda prostora nego obećanje koje ekran daje, i politika privatnosti ga
sada ponavlja.

**Pre naloga se ne pravi anoniman red u bazi.** Izmisliti ga znači držati tuđe
lice na nečemu što niko ne može ni da preuzme ni da obriše.

**`profiles.klon_at` duplira „postoji red u `avatar_clones`", namerno.**
Middleware čita `profiles` na svakoj navigaciji; da pita tabelu čiji redovi nose
base64 PNG, najtopliji upit u aplikaciji bi vukao slike.

**Marker se upisuje samo ako je slika stvarno legla.** Marker za nesačuvanog
klona pušta u app čoveka koji nema avatara — tačno stanje zbog kog gate postoji.

**Ekran zadržava „Odjavi se".** Nije rupa nego razlika između obaveznog koraka i
naloga iz kog se ne može izaći kad crtanje uporno puca.

**Pravne stranice prolaze kroz gate, i test to drži.** Play traži da brisanje
naloga radi bez instalacije, a recenzent ne sme da naleti na zid od selfija. Ako
taj test pocrveni, sledeća submisija je odbijena.

---

## ⚠️ Zamke — nađene na teži način

**1. Google odbija noviji format ključa kad ide kao `?key=`.** Klasični AI Studio
ključevi (`AIza…`) putuju kao query parametar; noviji (`AQ.…`) se tako odbijaju i
primaju se samo kao `x-goog-api-key` zaglavlje. Odbijanje je `400
API_KEY_INVALID` — izgleda **tačno kao pokvaren ključ**, ne kao pogrešno predat.
Koštalo popodneva. `postToModel` sada probao query pa, samo na tu grešku,
ponovi sa zaglavljem.

**2. Server Action seče telo zahteva na 10MB PRE nego što akcija krene.** Zato je
downscale na 768px budžet zahteva, ne podešavanje kvaliteta. Odbijen zahtev
**baca**, ne vraća grešku — bez `try/catch` na klijentu ekran zauvek stoji na
„Crtamo".

**3. Image model vraća sliku u `inlineData`, pored rečenice teksta.**
`postGenerateContent` spaja tekstualne delove i puca na prazan string, pa slika
mora svoj transport. I svoj tajmaut: 45s otkazuje potpuno zdrav zahtev, treba
180s.

**4. Prekidač mora da pomera i CTA, ne samo zid.** Prva verzija je gasila gate
ali je landing i dalje slao svakog posetioca na `/klon`. Na dan kad model ne
radi to zamenjuje zaključana vrata pokvarenim.

**5. `x-forwarded-for` se čita s KRAJA.** Klijent kontroliše početak liste, pa bi
`[0]` dao svakom zahtevu nov identitet i granica bi bila ukras. Test to drži.

**6. localStorage nije mesto za PNG.** Base64 je trećinu veći od bajtova, kvota
od ~5MB važi za sve što origin drži, i preko nje `setItem` **baca** — čoveku koji
je upravo čekao dva minuta. Zato IndexedDB.

---

## 🧪 Kako se testira crtanje lokalno

Uz `GEMINI_API_KEY` u `.env` i 5–20 slika u `klon-proba/` (folder je u
`.gitignore`):

```bash
npx vitest run src/lib/avatar/__tests__/clone.integration.test.ts
```

Izlaz je `klon-proba/klon.png`. Bez ključa ili bez dovoljno slika, ceo fajl se
preskače uz glasnu poruku. Ako kadar ili stil nisu dobri, menja se **samo**
konstanta u `clone-prompt.ts` pa se pusti opet.
