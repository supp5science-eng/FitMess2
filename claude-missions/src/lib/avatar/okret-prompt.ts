/**
 * Okret -- likovni pravac za avatar koji se okreće, u jednoj datoteci.
 *
 * Nastavak `clone-prompt.ts` i njegovog jedinog invarijanta: ŠABLON JE ISTI ZA
 * SVAKOGA, menja se samo čovek. Razlika je u tome šta izlazi napolje. Klon je
 * crtež; okret je NIZ FOTOGRAFIJA jedne osobe iz više uglova, koje korisnik
 * prevlačenjem prsta vrti kao da gleda 3D model.
 *
 * ZAŠTO NIJE PRAVI 3D. Probano 24.08.2026: klon nacrtan kao četiri pogleda ->
 * image-to-3D -> mesh (vidi `src/app/admin/klon3d`). Lice preživi rekonstrukciju
 * kao vosak. Referenca po kojoj se ovo radi izgleda fotografski zato što JESTE
 * fotografija, pa kadrovi ostaju slike i posle poslednjeg koraka.
 *
 * TOK, i zašto je video u sredini:
 *
 *     slike -> referentni portret -> JEDAN kadar po šablonu -> orbit video
 *           -> frejmovi isečeni iz videa
 *
 * Pet nezavisno generisanih uglova je pet malo različitih ljudi -- uvo se
 * pomeri, kragna se promeni, svetlo odluta. Kao pojedinačne slike to niko ne
 * primeti, ali skrol upoređuje susedne kadrove i iluzija pukne. Video model po
 * konstrukciji drži isto lice kroz sve frejmove; to mu je jedini posao. Uz to,
 * jedan video se plaća jednom, a iz njega se seče proizvoljno mnogo frejmova --
 * broj uglova ne utiče na cenu.
 *
 * Čist modul: nema React, nema DOM, nema mreže. Ulaz su varijanta i broj slika,
 * izlaz je string. `src/lib/ai/veo.ts` je ono što ga zaista šalje.
 */

/**
 * Diže se kad se tekst ispod promeni tako da promeni sliku. Upisuje se uz svaki
 * napravljen okret, da bi prepravka stila kasnije umela da nađe okrete crtane
 * po starom i ponudi im novo snimanje umesto da dve estetike stoje jedna pored
 * druge u istoj aplikaciji.
 */
export const OKRET_PROMPT_VERSION = "v1";

/**
 * Koliko se čoveka vidi u kadru. OVO JE OTVORENA ODLUKA, i zato su obe
 * varijante ovde umesto da je jedna izabrana u kodu.
 *
 * `portret` -- glava i ramena, tačno kao referenca. Najlepše izgleda i
 *   najsigurnije se generiše: model ima najviše piksela za lice, a lice je
 *   jedino po čemu se prepoznaje da je to baš taj čovek.
 *
 * `figura` -- cela figura. Ružnije i teže, ali JEDINO ovo može kasnije da
 *   pokaže telo koje se menja i da nosi šablone odeće, a to su dve stvari koje
 *   `docs/klon.md` vodi kao poentu zbog koje je šablon uopšte fiksan.
 *
 * Bira se gledanjem, ne raspravom -- `/admin/okret` postoji da bi se obe
 * napravile na istom čoveku i stavile jedna pored druge.
 */
export type OkretKadar = "portret" | "figura";

export const OKRET_KADROVI: readonly OkretKadar[] = ["portret", "figura"];

/** Koliko slika ekran traži. Isti razlozi kao kod klona: ispod pet model crta
 *  jednu fotografiju umesto čoveka, iznad dvadeset se samo produžava upload. */
export const MIN_OKRET_SLIKA = 5;
export const MAX_OKRET_SLIKA = 20;

/**
 * Odnos stranica po varijanti.
 *
 * Portret ide 3:4 jer je to kadar reference. Figura ide 9:16 jer čovek u punoj
 * visini u 3:4 ostavlja pola slike na prazan vazduh sa strane, a piksele treba
 * potrošiti na čoveka.
 */
export function okretAspect(kadar: OkretKadar): "3:4" | "9:16" {
  return kadar === "portret" ? "3:4" : "9:16";
}

/**
 * Fiksni deo -- isti za svakog korisnika, zauvek (po verziji).
 *
 * Sve po čemu su dva okreta uporediva stoji ovde kao instrukcija, a ne kao
 * stvar ukusa modela. Tri odluke vrede objašnjenja:
 *
 * - POZADINA je čisto bela, bez senke na podu. Aplikacija je štampa na belom
 *   papiru (`--paper` je `#ffffff` i u vebu i u nativnoj) -- avatar sa sivom
 *   pozadinom bi na svakom ekranu bio pravougaonik koji pluta. Bela pozadina
 *   ujedno je i ono što referenca radi.
 * - SVETLO je ravno i sa obe strane, bez tvrdih senki. Ovo je jedini razlog
 *   zbog kog orbit uopšte izgleda kao jedan čovek: čim postoji jak izvor sa
 *   jedne strane, lice na 0° i lice na 80° su dve različite fotografije.
 * - ODEĆA je jednobojna i pripijena. Ponavlja odluku koju je projekat već
 *   jednom platio: široka duksa krije tačno ono što ova aplikacija meri.
 */
const ZAJEDNICKO = `
POZADINA:
- Čisto bela, ravnomerna, bez teksture i bez prelaza.
- Bez senke na podu, bez horizonta, bez zida koji se vidi kao površina.
- Bez ijednog drugog objekta, bez teksta, bez logotipa, bez vodenog žiga.

SVETLO:
- Ravnomerno, meko studijsko svetlo sa obe strane, jednako jako.
- Bez tvrdih senki, bez jakog svetla sa jedne strane, bez odsjaja.
- Ovo je fotografija, a ne render: koža ima poru i teksturu, oči imaju vlagu.

ŠTA UZIMAŠ SA PRILOŽENIH FOTOGRAFIJA -- samo identitet:
- Oblik lica i vilice, ton kože, boju i tip očiju.
- Frizuru: dužinu, oblik, boju, liniju čela.
- Dlake na licu ako ih ima, i naočare ako ih osoba stalno nosi.
- Građu tela: širinu ramena, obim vrata, obim struka.

ŠTA NIKAKO NE UZIMAŠ SA FOTOGRAFIJA:
- Odeću, pozadinu, osvetljenje, pozu, ugao i kadar sa slike.
- Druge ljude, kućne ljubimce i predmete koji se na slikama zateknu.

ISKRENO, BEZ RUGANJA I BEZ ULEPŠAVANJA:
- Prikaži građu onakvu kakva jeste -- ni mršaviju ni krupniju nego što je.
- Ne sužavaj lice, ne simetrizuj ga, ne popunjavaj usne, ne podmlađuj.
- Ne uklanjaj madeže, pege ni neravnine.
- Bez podsmeha. Ovaj čovek predstavlja korisnika u aplikaciji koju otvara
  svakog dana.

REZULTAT:
- Tačno jedna osoba na slici, tačno jedna slika.
- Bez okvira, bez kolaža, bez više poza na istoj slici.
`.trim();

/** Kadar za varijantu `portret` -- referenca, doslovno. */
const KADAR_PORTRET = `
KADAR (fiksan -- iz njega se kasnije izvodi okret, pa mora biti isti svaki put):
- Glava i ramena. Rez ide na sredini grudi, ramena cela u kadru.
- Frontalno, lice okrenuto pravo u objektiv, pogled u objektiv.
- Glava centrirana, zauzima oko 45% visine slike, prazan prostor iznad temena.
- Neutralan izraz, usne opuštene i zatvorene, bez osmeha.
- Portretni format 3:4.

ODEĆA:
- Jednobojna tamna majica sa kragnom, bez šara i bez natpisa.
- Bez nakita, bez sata, bez kape, bez slušalica.
`.trim();

/** Kadar za varijantu `figura` -- ono što nosi odeću i telo koje se menja. */
const KADAR_FIGURA = `
KADAR (fiksan -- iz njega se kasnije izvodi okret, pa mora biti isti svaki put):
- Cela figura, od temena do stopala, ništa nije odsečeno.
- Frontalno, lice okrenuto pravo u objektiv, težina na obe noge.
- Ruke opuštene niz telo, blago odvojene od trupa, šake vidljive.
- Figura centrirana, zauzima oko 85% visine slike, prazan prostor iznad glave.
- Neutralan izraz, usne opuštene i zatvorene, bez osmeha.
- Uspravan format 9:16.

ODEĆA (privremena -- korisnik je kasnije bira, zato je sada namerno neutralna):
- Jednobojna pripijena sportska majica kratkih rukava i jednobojan šorc.
- Bele patike bez brenda.
- Bez natpisa, bez šara, bez nakita, bez sata, bez kape.
`.trim();

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
 * Cela instrukcija za PRVI KADAR (frontalno, 0°) -- ono iz čega orbit kreće.
 *
 * Broj slika se modelu kaže naglas namerno: kad mu se kaže "ovih N slika je
 * ista osoba", on ih uprosečava umesto da gomilu skoro istih snimaka pročita
 * kao nekoliko različitih ljudi -- što je tačno ono što se dešava kad korisnik
 * ubaci pet fotografija iz iste večeri.
 */
export function buildOkretKadarPrompt(
  kadar: OkretKadar,
  brojSlika: number,
  imaReferentniPortret = false
): string {
  return [
    `Priloženo je ${brojSlika} fotografija JEDNE ISTE OSOBE, snimljenih u`,
    `različitim prilikama. Pogledaj ih sve zajedno i izvedi kako ta osoba`,
    `zaista izgleda -- ne prepisuj nijednu pojedinačnu sliku.`,
    ...(imaReferentniPortret
      ? [
          ``,
          `POSLEDNJA priložena slika je referentni portret te iste osobe.`,
          `Lice mora da bude TO lice -- ista vilica, isti nos, iste oči, ista`,
          `linija kose. Ostale fotografije služe samo za građu.`,
        ]
      : []),
    ``,
    `Napravi FOTOGRAFIJU te osobe po šablonu ispod. Šablon je fiksan i važi za`,
    `svakog korisnika; jedino što se menja od osobe do osobe je sam čovek.`,
    `Ovo mora da izgleda kao prava fotografija snimljena u studiju, a ne kao`,
    `crtež, ilustracija, 3D render ili lik iz video igre.`,
    ``,
    kadar === "portret" ? KADAR_PORTRET : KADAR_FIGURA,
    ``,
    ZAJEDNICKO,
  ].join("\n");
}

/**
 * Instrukcija za orbit video -- najosetljiviji tekst u celoj funkciji.
 *
 * Tri stvari se ponavljaju do dosade, jer su tri načina na koja se okret
 * raspadne, a svaki izgleda kao da model "ne valja":
 *
 * 1. KAMERA SE KREĆE, ČOVEK NE. Ako se čovek okreće, ramena i kukovi se
 *    pomeraju i svaki frejm je druga poza. Ako se kamera obilazi oko njega, on
 *    je nepomičan predmet -- što je tačno ono što 3D model i jeste.
 * 2. NEMA PROMENE IZRAZA. Video modeli vole da "ožive" lice: trepne, nasmeši
 *    se, udahne. U nizu koji se skroluje to izgleda kao da avatar ima grč.
 * 3. NEMA ZUMA I NEMA POMERANJA VISINE. Ako se rastojanje menja, glava raste i
 *    opada dok prevlačiš prst, i ceo utisak 3D-a nestaje.
 *
 * `stepeni` je luk koji kamera pređe. Podrazumevano 180 (profil do profila,
 * tačno kao referenca) -- potiljak se namerno ne traži, jer ga model mora da
 * izmisli i izmisliće drugu frizuru nego što je napred.
 */
export function buildOkretVideoPrompt(kadar: OkretKadar, stepeni = 180): string {
  const pola = Math.round(stepeni / 2);

  return [
    `Kamera polako kruži oko osobe sa fotografije, u jednom neprekidnom,`,
    `ravnomernom pokretu, od ${pola} stepeni sa jedne strane do ${pola} stepeni`,
    `sa druge -- ukupno ${stepeni} stepeni. Kreće se SAMO kamera.`,
    ``,
    `OSOBA JE POTPUNO NEPOMIČNA, kao statua:`,
    `- Ne okreće se, ne pomera glavu, ne pomera ramena, ne prebacuje težinu.`,
    `- Izraz lica se ne menja ni za trunku. Ne trepće, ne smeši se, ne govori.`,
    `- Kosa i odeća se ne pomeraju. Nema vetra i nema disanja koje se vidi.`,
    ``,
    `KAMERA:`,
    `- Ostaje na istoj visini, u visini ${kadar === "portret" ? "očiju" : "grudi"}.`,
    `- Ostaje na istom rastojanju. Bez zuma, bez primicanja i odmicanja.`,
    `- Kreće se ravnomerno, istom brzinom od početka do kraja, bez zastajanja.`,
    ``,
    `SVE OSTALO SE NE MENJA:`,
    `- Pozadina ostaje čisto bela od prvog do poslednjeg kadra.`,
    `- Svetlo ostaje isto, ravnomerno sa obe strane, bez senki koje putuju.`,
    `- Odeća, frizura i lice ostaju identični onome sa priložene slike.`,
    ``,
    `Bez rezova, bez druge scene, bez teksta i bez muzike. Jedan neprekidan`,
    `kadar, kao snimak sa okretne platforme u fotografskom studiju.`,
  ].join("\n");
}

/** Ono što se modelu izričito zabranjuje. Veo ovo prima odvojeno od prompta i
 *  na njega reaguje jače nego na "nemoj" unutar glavnog teksta. */
export function okretNegativePrompt(): string {
  return [
    "osoba se okreće",
    "osoba se pomera",
    "trepće",
    "smeši se",
    "menja izraz lica",
    "hoda",
    "zum",
    "promena kadra",
    "rez",
    "druga osoba",
    "senka na podu",
    "obojena pozadina",
    "tekst",
    "vodeni žig",
    "crtež",
    "ilustracija",
    "3D render",
    "lik iz video igre",
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
