/**
 * Okret -- likovni pravac za avatar koji se okreće, u jednoj datoteci.
 *
 * Nastavak `clone-prompt.ts` i njegovog jedinog invarijanta: ŠABLON JE ISTI ZA
 * SVAKOGA, menja se samo čovek. Razlika je u tome šta izlazi napolje. Klon je
 * crtež; okret je NIZ FOTOGRAFIJA jedne osobe iz više uglova, koje korisnik
 * prevlačenjem prsta vrti kao da gleda 3D model.
 *
 * TOK, i zašto je video u sredini:
 *
 *     slike -> referentni portret -> JEDAN kadar po šablonu -> orbit video
 *           -> frejmovi isečeni iz videa -> video se briše
 *
 * Video NIKAD ne stiže do aplikacije. On je alat u fabrici: postoji dva minuta
 * na serveru i baca se. Postoji iz dva razloga, oba nezamenjiva. Prvi -- pet
 * nezavisno generisanih uglova je pet malo različitih ljudi (uvo se pomeri,
 * kragna se promeni, svetlo odluta), i to niko ne primeti na pojedinačnoj
 * slici, ali skrol upoređuje susedne kadrove i iluzija pukne. Video model po
 * konstrukciji drži isto lice kroz sve frejmove; to mu je jedini posao. Drugi
 * -- jedan snimak se plaća jednom, a iz njega se seče proizvoljno mnogo
 * frejmova, pa BROJ UGLOVA NE UTIČE NA CENU.
 *
 * Čist modul: nema React, nema DOM, nema mreže. Ulaz je broj slika, izlaz je
 * string. `src/lib/ai/veo.ts` je ono što ga zaista šalje.
 */

/**
 * v2 -- prepisano posle prvog ručnog testa (28.08.2026), na kom v1 nije ni
 * približno pogodio referencu. Tri izmene, i sve tri vrede pamćenja jer se
 * ponavljaju na svakom sledećem šablonu:
 *
 * 1. POZADINA NIJE BELA NEGO SVETLO SIVA, sa blagim padom ka uglovima.
 *    „Pure white, no gradient" modelu kaže „izrezan lik na belom" i vraća
 *    nalepnicu umesto fotografije. Referenca je bešavni sivi papir.
 * 2. FOTOGRAFSKI REČNIK RADI, PRIDEVI NE. „Mora da izgleda kao prava
 *    fotografija" je slaba instrukcija; 85mm, f/5.6 i dva softboksa pod 45°
 *    pomeraju rezultat u klaster pravih fotografija.
 * 3. ZABRANA RADI BOLJE OD MOLBE. Odeljak `NE OVAKO` nabraja ono što sliku
 *    odaje kao generisanu -- retuš, bloom, plitka dubinska oštrina, savršena
 *    simetrija -- umesto da se nada da neće doći samo od sebe.
 *
 * ⚠️ v2 JOŠ NIJE POTVRĐEN NA SLICI. Upisan je ovde jer je v1 dokazano pogrešan
 * (bela pozadina i zabrana uzimanja odeće sa slika, oboje suprotno odluci), pa
 * je najbolji poznati nacrt bolji od poznato lošeg. Klupa `/admin/okret` ima
 * polje za prepis, i tek kad tekst legne na slici, ovaj komentar gubi upozorenje.
 */
export const OKRET_PROMPT_VERSION = "v2";

/**
 * KADAR JE ODLUČEN: glava i ramena, kao na referenci. 28.08.2026.
 *
 * Ranije su ovde stajale tri varijante (glava i ramena / od struka naviše /
 * cela figura) i birale su se gledanjem. Odluka je pala na portret i varijante
 * su obrisane umesto ostavljene „za svaki slučaj" -- mrtav izbor u kodu je
 * grana koju svaki sledeći čovek mora da pročita da bi zaključio da ne radi
 * ništa.
 *
 * ŠTA TA ODLUKA KOŠTA, da se zna a ne da se prežvakava: avatar iz kog se ne
 * vidi telo ne može da pokaže napredak, i ne može da nosi šablone odeće koje
 * `docs/klon.md` vodi kao poentu zbog koje je šablon uopšte fiksan. Portret je
 * ono čime se aplikacija PREDSTAVLJA, a ne instrument koji meri. Ako se to
 * jednom promeni, menja se ceo šablon, ne dodaje se varijanta pored.
 */
export const OKRET_ASPECT = "3:4" as const;

/** Koliko slika ekran traži. Isti razlozi kao kod klona: ispod pet model crta
 *  jednu fotografiju umesto čoveka, iznad dvadeset se samo produžava upload. */
export const MIN_OKRET_SLIKA = 5;
export const MAX_OKRET_SLIKA = 20;

/**
 * Korak jedan od dva: referentni portret -- NAMERNO ISTI TEKST KAO KOD KLONA.
 *
 * Posao je identičan: iz gomile telefonskih slika izvuci jedno verno lice, bez
 * ulepšavanja. Klon ga koristi da bi crtež ličio na čoveka, okret da bi
 * fotografija ličila na čoveka. Da je ovde prepisan, dve kopije istog teksta bi
 * se razišle prvi put kad neko popravi samo jednu -- pa se uvozi.
 *
 * Trik je nađen na teži način 24.08.2026 (vidi `clone-prompt.ts`): traženje
 * gotovog rezultata iz jednog poteza vraća stranca sa ispravnom frizurom, jer
 * se lice spere pre nego što išta sličnosti stigne. Portret nikad ne stigne do
 * korisnika -- skela je za drugi poziv i propada sa izvornim slikama.
 */
export { CLONE_PORTRAIT_PROMPT as OKRET_PORTRET_PROMPT } from "@/lib/avatar/clone-prompt";

/**
 * Aparat, objektiv i svetlo -- najjači deo celog šablona.
 *
 * Ovo je odeljak zbog kog v2 postoji. Model ne zna šta znači „izgleda kao prava
 * fotografija", ali savršeno zna šta je 85mm portretni objektiv na f/5.6 ispred
 * bešavnog papira sa dva softboksa -- to je opis desetina hiljada stvarnih
 * fotografija u njegovim podacima, i imenovati ga je jedini pouzdan način da se
 * rezultat pomeri iz klastera „AI portret" u klaster „studijska fotografija".
 *
 * Ravno svetlo sa obe strane nije estetska sitnica nego uslov da orbit uopšte
 * radi: čim postoji jak izvor sa jedne strane, lice na 0° i lice na 80° postaju
 * dve različite fotografije i niz se raspadne kad se prevuče prstom.
 */
const APARAT_I_SVETLO = `
APARAT I SVETLO -- po ovome se prepoznaje da je fotografija:
- Aparat punog kadra, portretni objektiv od 85mm, blenda oko f/5.6, tako da je
  celo lice oštro -- od vrha nosa do ušiju.
- Bešavni papir SVETLO SIVE boje: osetno svetliji od srednje sive, ali NIJE
  čisto beo, sa vrlo blagim potamnjenjem ka uglovima. Čovek je fotografisan
  ISPRED pozadine, nije izrezan i nalepljen na nju.
- Dva velika softboksa, sa svake strane po jedan, pod 45 stepeni, jednake
  jačine, uz meko dopunsko svetlo spreda. Senke postoje ali su vrlo meke:
  jedva vidljiva ispod vilice i ispod nosa. Nijedna tvrda, nijedna na pozadini.
- Neutralan balans belog, prirodna boja, bez kolor-gradinga, bez toplog i bez
  hladnog tona.
- Oštro i visoke rezolucije. Vidljiva tekstura kože i pore, pojedinačne dlake
  na liniji kose, prirodan sjaj na čelu i nosu.
`.trim();

/**
 * Zabrane. Odvojeno od svega ostalog jer se čitaju kao lista, a ne kao proza.
 *
 * Svaka stavka je jedan konkretan način na koji slika odaje da je generisana.
 * Modeli na ovakvu listu reaguju osetno jače nego na isti sadržaj upleten u
 * rečenice iznad -- ista pojava zbog koje `okretNegativePrompt()` postoji kao
 * zasebno polje.
 */
const NE_OVAKO = `
NE OVAKO -- ovo su stvari po kojima se vidi da slika nije prava:
- Bez retuširanja kože, bez zaglađivanja, bez uklanjanja nepravilnosti.
- Bez blooma, bez sjaja, bez HDR-a, bez zgnječenih senki, bez vinjete, bez zrna.
- Bez filmskog svetla, bez svetla po ivici lika, bez obojenog svetla, bez
  dramatične senke.
- Bez plitke dubinske oštrine, bez zamućene pozadine.
- Bez plastične i voštane kože. Bez savršeno simetričnog lica.
- Nije render, nije ilustracija, nije 3D lik, nije slika u ulju.
- Bez poda, bez linije horizonta, bez ugla sobe, bez ijednog predmeta, bez
  teksta, bez logotipa, bez vodenog žiga.
`.trim();

/**
 * Odeća -- pravilo je OKRENUTO u odnosu na klon, i to je odluka, ne propust.
 *
 * `clone-prompt.ts` izričito ZABRANJUJE uzimanje odeće sa fotografija, jer je
 * kod crteža odeća šablon koji korisnik kasnije bira. Ovde je obrnuto:
 * izmišljena odeća izgleda generički i odmah oda da slika nije prava, dok odeća
 * sa korisnikove slike izgleda kao on. Odluka od 28.08.2026.
 *
 * Rečenica „radije onaj koji najbolje VIDIŠ nego onaj koji ti se najviše
 * SVIĐA" nosi celo pravilo. Bez nje model bira komad koji mu se čini lepšim, a
 * ne onaj o kom zaista ima podatke -- pa opet izmišlja, samo sa alibijem.
 */
const ODECA = `
ODEĆA -- UZIMA SE SA FOTOGRAFIJA, NIKAD SE NE IZMIŠLJA:
- Pregledaj priložene fotografije i izaberi JEDAN komad odeće koji se vidi
  najjasnije i najpotpunije. Radije onaj koji najbolje VIDIŠ nego onaj koji ti
  se najviše SVIĐA.
- Reprodukuj tačno taj komad: boju, kroj, izrez, kragnu, dužinu rukava, tkaninu
  i njeno tkanje, i svaki vidljiv detalj -- dugmad, paspul, ivicu, teksturu.
- Ne mešaj komade sa različitih fotografija. Jedan komad, sa jedne fotografije.
- Ne izmišljaj odeću i ne zamenjuj je čistijom, novijom ili uopštenijom
  verzijom.
- Ako je izabrani komad na izvornoj fotografiji delimično van kadra, nastavi ga
  uverljivo, ali mu nikad ne menjaj boju ni vrstu.
- Zadrži naočare ako ih osoba stalno nosi. Ne dodaji nakit, sat, kapu ni
  slušalice kojih na fotografijama nema.
`.trim();

/** Kadar. Tri broja i jedan rez -- ono što se najlakše popravlja kad promaši. */
const KADAR = `
KADAR:
- Glava i ramena. Rez ide na sredini grudi, oba ramena cela u kadru.
- Frontalno, lice okrenuto pravo u objektiv, pogled u objektiv.
- Glava centrirana, zauzima oko 45% visine slike, prazan prostor iznad temena.
- Neutralan izraz, usne opuštene i zatvorene, bez osmeha.
- Portretni format 3:4.
`.trim();

/** Šta se sa fotografija uzima, i pod kojim uslovom. */
const IDENTITET = `
SA FOTOGRAFIJA UZIMAŠ:
- Oblik lica i vilice, ton kože, boju i oblik očiju.
- Frizuru: dužinu, oblik, boju, liniju čela.
- Dlake na licu ako ih ima.
- Građu: širinu ramena i obim vrata.
- Odeću, tačno po pravilu iznad.

ISKRENO, BEZ RUGANJA I BEZ ULEPŠAVANJA:
- Prikaži građu onakvu kakva jeste -- ni mršaviju ni krupniju nego što je.
- Ne sužavaj lice, ne simetrizuj ga, ne popunjavaj usne, ne podmlađuj.
- Zadrži madeže, pege, ožiljke, neujednačen ten i bradu kakvi jesu.
- Ovaj čovek predstavlja korisnika u aplikaciji koju otvara svakog dana.

REZULTAT:
- Tačno jedna osoba, tačno jedna slika.
- Bez okvira, bez kolaža, bez više poza na istoj slici.
`.trim();

/**
 * Cela instrukcija za PRVI KADAR (frontalno, 0°) -- ono iz čega orbit kreće.
 *
 * Prva rečenica imenuje ŽANR, i to nije ukras. Referenca je fotografija naočara
 * za veb-prodavnicu -- uzak, prepoznatljiv žanr sa svojim pravilima kadriranja
 * i svetla. Model tačno zna koji skup slika je to, pa jedna imenovana odrednica
 * vredi više od deset prideva iza nje.
 *
 * Broj slika se modelu kaže naglas namerno: kad mu se kaže „ovih N slika je
 * ista osoba", on ih uprosečava umesto da gomilu skoro istih snimaka pročita
 * kao nekoliko različitih ljudi -- što je tačno ono što se dešava kad korisnik
 * ubaci pet fotografija iz iste večeri.
 */
export function buildOkretKadarPrompt(
  brojSlika: number,
  imaReferentniPortret = false
): string {
  return [
    `Fotografija za veb-prodavnicu naočara i odeće: jedna osoba, glava i`,
    `ramena, ispred bešavne svetlo sive studijske pozadine.`,
    ``,
    `Priloženo je ${brojSlika} fotografija JEDNE ISTE OSOBE, snimljenih u`,
    `različitim prilikama. Pogledaj ih sve zajedno i izvedi kako ta osoba`,
    `zaista izgleda -- ne prepisuj nijednu pojedinačnu sliku.`,
    ...(imaReferentniPortret
      ? [
          ``,
          `POSLEDNJA priložena slika je referentni portret te iste osobe.`,
          `Lice mora da bude TO lice -- ista vilica, isti nos, iste oči, ista`,
          `linija kose. Ostale fotografije služe za građu i za odeću.`,
        ]
      : []),
    ``,
    APARAT_I_SVETLO,
    ``,
    KADAR,
    ``,
    ODECA,
    ``,
    IDENTITET,
    ``,
    NE_OVAKO,
  ].join("\n");
}

/**
 * Kuda se glava okrene do kraja snimka.
 *
 * Imenovano po TOME GDE NOS ZAVRŠI U KADRU, a ne po „levo/desno" osobe, i to
 * namerno: „okrene se ulevo" znači jedno gledaocu a drugo osobi, i ta zabuna
 * košta jedan ceo snimak pre nego što se primeti. Gde nos pokazuje u slici je
 * jednoznačno i proverljivo golim okom.
 */
export type OkretSmer = "nos-levo" | "nos-desno";

export const OKRET_SMEROVI: readonly OkretSmer[] = ["nos-levo", "nos-desno"];

/**
 * DVA SNIMKA, NE JEDAN. Nađeno na snimku od 28.08.2026.
 *
 * Prvi pokušaj je tražio luk „od 45° levo do 45° desno" u jednom snimku. To je
 * bilo nemoguće, i greška je bila u instrukciji a ne u modelu: KOD SLIKE-U-VIDEO
 * ULAZNA SLIKA JE NULTI FREJM. Kamera fizički ne može da krene sa -45° kad
 * snimak počinje tačno tamo gde je fotografija. Model je tu protivrečnost
 * razrešio jedino kako je mogao -- otišao do profila pa se VRATIO na frontalu,
 * i ostatak snimka prostajao.
 *
 * Merenje na tom snimku: 10 sekundi ukupno, od čega ~3,5s pravog okreta
 * (0° -> ~90°), ~2s povratka i ~4,5s stajanja. Upotrebljivo je bilo oko
 * trećine, i to samo na JEDNU stranu.
 *
 * Zato dva snimka, oba SA ISTE fotografije, svaki na svoju stranu po 90°:
 *
 *     [nos-levo, obrnut]  +  fotografija  +  [nos-desno]
 *          9 kadrova            1 kadar        9 kadrova   = 19 kadrova, 180°
 *
 * Dve dobiti, i druga je veća nego što izgleda. Prva -- ništa se ne troši na
 * povratak, pa je ceo snimak upotrebljiv. Druga -- PRAVA FOTOGRAFIJA JE U
 * SREDINI NIZA, a ne na kraju. Greška identiteta raste sa udaljenošću od
 * sidra, pa je najgori kadar sada na 90° od stvarne slike umesto na 180°.
 */
export const OKRET_LUK_PO_SNIMKU = 90;

/**
 * Instrukcija za jedan orbit snimak -- najosetljiviji tekst u celoj datoteci.
 *
 * Tri stvari se ponavljaju do dosade, jer su tri načina na koja se okret
 * raspadne, a svaki izgleda kao da model „ne valja":
 *
 * 1. KAMERA SE KREĆE, ČOVEK NE. Ako se čovek okreće, ramena i glava se
 *    pomeraju i svaki frejm je druga poza. Ako kamera obilazi oko njega, on je
 *    nepomičan predmet -- što je tačno ono što 3D model i jeste.
 * 2. NEMA PROMENE IZRAZA. Video modeli vole da „ožive" lice: trepne, nasmeši
 *    se, udahne. U nizu koji se skroluje to izgleda kao da avatar ima grč.
 * 3. NEMA ZUMA I NEMA POMERANJA VISINE. Ako se rastojanje menja, glava raste i
 *    opada dok prevlačiš prst, i ceo utisak 3D-a nestaje.
 *
 * Uz njih, jedna nova i najvažnija: JEDAN SMER, BEZ POVRATKA. Rečenica
 * „ne vraćaj se" stoji izričito, jer je povratak ono što je model uradio sam od
 * sebe kad mu je prvi put dat protivrečan luk.
 *
 * Pozadina se izričito drži SVETLO SIVOM kroz ceo snimak, ista kao na ulaznom
 * kadru. Bez toga video model rado „očisti" pozadinu u belo negde na sredini
 * luka, i onda se pola frejmova ne slaže sa drugom polovinom.
 */
export function buildOkretVideoPrompt(
  smer: OkretSmer,
  stepeni = OKRET_LUK_PO_SNIMKU
): string {
  const ivica = smer === "nos-levo" ? "LEVOJ" : "DESNOJ";

  return [
    `Studijski portret na bešavnoj svetlo sivoj pozadini. Kamera polako kruži`,
    `oko osobe sa priložene slike.`,
    ``,
    `Snimak POČINJE tačno na priloženoj fotografiji -- frontalno, lice u`,
    `objektiv. Odatle kamera kreće u JEDNOM SMERU i ide ${stepeni} stepeni, do`,
    `punog profila u kom nos pokazuje ka ${ivica} ivici kadra.`,
    ``,
    `SAMO JEDAN SMER, BEZ POVRATKA:`,
    `- Kamera se ni u jednom trenutku ne vraća ka polaznoj tački.`,
    `- Ne staje, ne usporava i ne stoji na kraju. Snimak se završava u profilu.`,
    `- Ceo snimak je jedan neprekidan luk, od prvog do poslednjeg kadra.`,
    ``,
    `OSOBA JE POTPUNO NEPOMIČNA, kao statua:`,
    `- Ne okreće se, ne pomera glavu, ne pomera ramena, ne prebacuje težinu.`,
    `- Izraz lica se ne menja ni za trunku. Ne trepće, ne smeši se, ne govori,`,
    `  ne miče obrve.`,
    `- Kosa i odeća se ne pomeraju. Nema vetra i nema disanja koje se vidi.`,
    ``,
    `KAMERA:`,
    `- Ostaje na istoj visini kroz ceo snimak, u visini očiju.`,
    `- Ostaje na istom rastojanju kroz ceo snimak. Bez zuma, bez primicanja i`,
    `  bez odmicanja.`,
    `- Kreće se ravnomerno, istom brzinom od prvog do poslednjeg kadra, bez`,
    `  zastajanja i bez usporavanja na krajevima.`,
    ``,
    `NIŠTA DRUGO SE NE MENJA:`,
    `- Pozadina ostaje ista bešavna svetlo siva od prvog do poslednjeg kadra,`,
    `  sa istim blagim potamnjenjem ka uglovima.`,
    `- Svetlo ostaje isto, ravnomerno sa obe strane, bez senki koje putuju po`,
    `  licu ili po pozadini.`,
    `- Odeća, frizura, naočare i lice ostaju identični priloženoj slici, na`,
    `  svakom uglu.`,
    ``,
    `Bez rezova, bez druge scene, bez teksta i bez muzike. Jedan neprekidan`,
    `kadar, kao snimak sa okretne platforme u fotografskom studiju.`,
  ].join("\n");
}

/**
 * Ono što se modelu izričito zabranjuje, u zasebnom polju.
 *
 * ⚠️ SIVA SE OVDE NE ZABRANJUJE. U v1 je stajalo „grey background", a šablon
 * sada svetlo sivu TRAŽI -- dve instrukcije koje se tuku, i to na način koji
 * se plaća celim jednim orbitom pre nego što se primeti.
 */
export function okretNegativePrompt(): string {
  return [
    "osoba se okreće",
    "osoba se pomera",
    "glava se okreće",
    "trepće",
    "smeši se",
    "menja izraz lica",
    "govori",
    "hoda",
    "zum",
    "promena visine kamere",
    // Ovo troje je ono što je pojelo dve trećine prvog snimka.
    "kamera se vraća",
    "kamera staje",
    "kamera menja smer",
    "rez",
    "promena scene",
    "druga osoba",
    "senka na podu",
    "senke koje putuju",
    "obojena pozadina",
    "tamna pozadina",
    "pozadina sa šarom",
    "tekst",
    "vodeni žig",
    "crtež",
    "ilustracija",
    "3D render",
    "lik iz video igre",
    "plastična koža",
    "izobličene naočare",
  ].join(", ");
}

/** Šta je provera broja slika zaključila, sa rečenicom koja se pokazuje. */
export type OkretBrojVerdikt = { ok: true } | { ok: false; error_sr: string };

/** Pravilo 5-20 na jednom mestu, da ekran i ruta ne mogu da se raziđu. */
export function proveriBrojSlika(broj: number): OkretBrojVerdikt {
  if (broj < MIN_OKRET_SLIKA) {
    return {
      ok: false,
      error_sr: `Treba nam bar ${MIN_OKRET_SLIKA} slika. Dodaj još ${MIN_OKRET_SLIKA - broj}.`,
    };
  }
  if (broj > MAX_OKRET_SLIKA) {
    return {
      ok: false,
      error_sr: `Najviše ${MAX_OKRET_SLIKA} slika odjednom. Izbaci ${broj - MAX_OKRET_SLIKA}.`,
    };
  }
  return { ok: true };
}

/**
 * Na kojim uglovima se seku frejmovi iz videa.
 *
 * Vraća VREMENA u sekundama, ne uglove: video prelazi luk ravnomerno, pa je
 * i-ti ugao na i-tom delu trajanja. Prvi i poslednji frejm se namerno preskaču
 * za mrvicu -- na samom početku i kraju snimka modeli vole da ubace jedan
 * mutan ili pomeren kadar, i taj jedan kadar je tačno onaj na koji korisnik
 * naleti kad odvrne okret do kraja.
 */
export function okretVremenaFrejmova(
  trajanjeSek: number,
  brojFrejmova: number,
  marginaSek = 0.15
): number[] {
  if (brojFrejmova < 2) return [trajanjeSek / 2];

  const pocetak = marginaSek;
  const kraj = Math.max(pocetak, trajanjeSek - marginaSek);
  const korak = (kraj - pocetak) / (brojFrejmova - 1);

  return Array.from({ length: brojFrejmova }, (_, i) =>
    Number((pocetak + i * korak).toFixed(3))
  );
}

/**
 * Spaja dva snimka u jedan niz kadrova, od profila do profila.
 *
 * Oba snimka kreću sa ISTE fotografije, svaki na svoju stranu. Da bi se dobio
 * neprekidan luk, levi se okreće naopako i stavlja ispred, a fotografija ide
 * tačno u sredinu:
 *
 *     [nos-levo, obrnut]  +  fotografija  +  [nos-desno]
 *          9 kadrova           1 kadar        9 kadrova   = 19 kadrova
 *
 * Nulti frejm svakog snimka JESTE ta ista fotografija, pa se izostavlja iz oba
 * niza -- inače bi se ista slika pojavila tri puta zaredom u sredini, i skrol
 * bi na sredini luka za tren "zastao".
 *
 * `kadar` je izvorna fotografija, a ne frejm iz snimka: ona je jedina koja nije
 * prošla kroz video model i zato je najoštrija u celom nizu. Ujedno je i sidro
 * -- greška identiteta raste sa udaljenošću od nje, pa stoji na sredini gde je
 * najdalji kadar udaljen 90°, a ne 180°.
 */
export function spojiOkret(
  kadar: string,
  nosLevo: readonly string[],
  nosDesno: readonly string[]
): string[] {
  return [...nosLevo].reverse().concat(kadar, [...nosDesno]);
}

/**
 * Koliko se kadrova seče iz JEDNOG snimka.
 *
 * Devet po strani plus izvorna fotografija daje 19 kadrova na 180°, odnosno
 * jedan na svakih 10 stepeni -- gustina na kojoj prevlačenje prstom deluje
 * neprekidno. Ispod desetak ukupno se vidi da preskače.
 *
 * Ne utiče na cenu: snimak je već plaćen, sečenje je besplatno.
 */
export const OKRET_FREJMOVA_PO_SNIMKU = 9;
