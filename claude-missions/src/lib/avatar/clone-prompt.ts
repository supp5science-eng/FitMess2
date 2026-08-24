/**
 * The klon: art direction, in code, as ONE constant.
 *
 * The product idea in one line -- the TEMPLATE never changes, only the person
 * does. Every user gets the same drawing: same framing, same pose, same flat
 * background, same line weight, same neutral outfit. What the model is allowed
 * to take from the uploaded photos is the IDENTITY and nothing else -- face,
 * hair, skin tone, build. Not the clothes they happened to wear, not the room
 * they stood in, not the angle they held the phone at.
 *
 * That constraint is the whole feature, and it is why the prompt lives here
 * instead of in a database row an operator can tweak: two klons drawn a month
 * apart have to be able to stand next to each other. Outfit templates (the next
 * screen) can only work if the body underneath them is drawn the same way every
 * time -- otherwise every shirt has to be re-cut per user.
 *
 * Pure module: no React, no DOM, no network. Input is a photo count, output is
 * a string. `src/lib/ai/gemini.ts` is what actually sends it.
 */

/**
 * Bumped whenever the wording below changes in a way that changes the picture.
 * Written onto every generated row (`avatar_clones.prompt_version`), so a style
 * rewrite can find the klons drawn by the old one and offer them a re-draw
 * instead of silently leaving two art styles in the same app.
 */
export const CLONE_PROMPT_VERSION = "v1";

/**
 * How many photos the screen asks for.
 *
 * The floor is not arbitrary: from one or two shots the model latches onto that
 * shot's lighting and angle and draws the PHOTO rather than the person. Five is
 * where a likeness starts to survive the stylisation. The ceiling is where more
 * photos stop adding likeness and only add upload time and cost.
 */
export const MIN_CLONE_PHOTOS = 5;
export const MAX_CLONE_PHOTOS = 20;

/**
 * The fixed half of the prompt -- identical for every user, forever (per
 * version). Everything that makes two klons comparable is stated here as an
 * instruction, not left to the model's taste:
 *
 * - FRAMING is fixed, because the outfit templates will be drawn against it.
 * - BACKGROUND is a flat single colour with no shadow, because the app
 *   composites the klon onto its own themed surface (light AND dark) -- a
 *   photographic background would box it into a grey rectangle on both.
 * - The OUTFIT is deliberately minimal and tight. This repeats a decision the
 *   project already made once and paid for: a wide hoodie hides exactly what
 *   this app measures. Outfits are their own screen.
 * - The BUILD is honest but never caricatured. This app's whole tone is
 *   zero-shame; a model left to its own devices will happily exaggerate weight,
 *   and one cruel drawing on day one is an uninstall.
 */
const STYLE_TEMPLATE = `
STIL (identičan za svakog korisnika -- ne menjaj ga ni po čemu):
- Čista vektorska ilustracija, ravne boje, bez teksture i bez šrafure.
- Debela, ujednačena tamna kontura oko svake forme; unutrašnje linije tanje.
- Blaga stilizacija, prijateljska ali ne dečja: prepoznatljiv čovek, ne karikatura.
- Bez gradijenata osim jednog vrlo blagog na koži; bez sjaja, bez odsjaja.

KADAR (fiksan -- na njemu se kasnije crta odeća, pa mora da bude isti svaki put):
- Cela figura, od temena do stopala, ništa nije odsečeno.
- Frontalno, lice okrenuto pravo u gledaoca, težina na obe noge.
- Ruke opušteno niz telo, blago odvojene od trupa, šake vidljive.
- Figura centrirana, zauzima oko 85% visine slike, prazan prostor iznad glave.
- Neutralan, miran izraz lica sa jedva primetnim osmehom.
- Portretni format 3:4.

POZADINA:
- Jedna ravna, svetlo neutralna boja. Bez senke, bez poda, bez horizonta.
- Bez ijednog drugog objekta, bez teksta, bez logotipa, bez vodenog žiga.

ODEĆA (privremena -- korisnik je kasnije bira, zato je sada namerno neutralna):
- Jednobojna pripijena sportska majica bez rukava i jednobojan sportski šorc.
- Bele patike bez brenda.
- Bez natpisa, bez šara, bez nakita, bez sata, bez kape.

ŠTA UZIMAŠ SA FOTOGRAFIJA -- samo identitet:
- Oblik lica i vilice, ton kože, boju i tip očiju.
- Frizuru: dužinu, oblik, boju, liniju čela.
- Dlake na licu ako ih ima, i naočare ako ih osoba stalno nosi.
- Građu tela: visinu u odnosu na ramena, širinu ramena, obim struka.

ŠTA NIKAKO NE UZIMAŠ SA FOTOGRAFIJA:
- Odeću, pozadinu, osvetljenje, pozu, ugao i kadar sa slike.
- Druge ljude, kućne ljubimce i predmete koji se na slikama zateknu.

ISKRENO, BEZ RUGANJA:
- Nacrtaj građu onakvu kakva jeste -- ni mršaviju ni krupniju nego što je.
- Nemoj preuveličavati nijedan deo tela, ni u jednom smeru.
- Bez podsmeha, bez humora na račun osobe. Ovaj lik predstavlja korisnika u
  aplikaciji koju otvara svakog dana.

REZULTAT:
- Tačno jedna figura na slici, tačno jedna slika.
- Bez okvira, bez kolaža, bez više poza na istoj slici.
`.trim();

/**
 * The whole instruction sent with the photos.
 *
 * The photo count is stated to the model on purpose: told "these N images are
 * the same person", it averages across them instead of treating a batch of
 * near-duplicates as several people -- which is the failure mode when the user
 * uploads five shots from one evening.
 */
export function buildClonePrompt(photoCount: number): string {
  return [
    `Priloženo je ${photoCount} fotografija JEDNE ISTE OSOBE, snimljenih u`,
    `različitim prilikama. Pogledaj ih sve zajedno i izvedi kako ta osoba`,
    `zaista izgleda -- ne prepisuj nijednu pojedinačnu sliku.`,
    ``,
    `Nacrtaj tu osobu kao lik po šablonu ispod. Šablon je fiksan i važi za`,
    `svakog korisnika; jedino što se menja od osobe do osobe je sam lik.`,
    ``,
    STYLE_TEMPLATE,
  ].join("\n");
}

/** What the count check concluded, with the sentence to show when it failed. */
export type PhotoCountVerdict = { ok: true } | { ok: false; error_sr: string };

/**
 * The 5-20 rule, in one place so the screen, the server action and the tests
 * cannot drift apart on it. The screen disables its button below the floor, but
 * the action re-checks: `FormData` arrives from a client we do not control.
 */
export function checkPhotoCount(count: number): PhotoCountVerdict {
  if (count < MIN_CLONE_PHOTOS) {
    return {
      ok: false,
      error_sr: `Treba nam bar ${MIN_CLONE_PHOTOS} slika da bismo pogodili kako izgledaš. Dodaj još ${MIN_CLONE_PHOTOS - count}.`,
    };
  }
  if (count > MAX_CLONE_PHOTOS) {
    return {
      ok: false,
      error_sr: `Najviše ${MAX_CLONE_PHOTOS} slika odjednom. Izbaci ${count - MAX_CLONE_PHOTOS} pa probaj ponovo.`,
    };
  }
  return { ok: true };
}
